// ============================================================================
// Aurys Personal — rota /personal/import/review/:batchId (AP4C.1c-2).
// Liga a UI de revisão ao planner/executor REAIS: carrega batch+items do
// staging e os dados pessoais, monta o preview com buildApplyPlan, e no clique
// final aplica via applyBatch (idempotente). Nada é aplicado antes do clique.
// ============================================================================

import { useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadImportBatch, applyBatch, setImportBatchScope, persistItemDecisions } from '@/services/personal/personalImportService';
import { loadPersonalData } from '@/services/personal/personalService';
import { buildApplyPlan, ImportBatchRow, ImportItemRow } from '@/domain/personal/import/applyPlan';
import { batchNeedsReimport } from '@/domain/personal/import/applyContract';
import { ImportSummary } from '@/domain/personal/import/personalImportInference';
import {
  initialReviewState, buildDecisions, canApply, dailyCandidate, needsScope,
  planPreview, itemDecisionsFromPlan, ReviewState,
} from '@/domain/personal/import/reviewDecisions';
import ReviewPanel from '@/components/personal/import/ReviewPanel';

function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
            <span>Aurys</span><span className="text-muted-foreground/30">|</span><span>Personal</span>
          </div>
          <Link to="/personal/import" className="text-xs font-medium text-muted-foreground hover:text-foreground">← Importação</Link>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function PersonalImportReview() {
  const { batchId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const batchQuery = useQuery({
    queryKey: ['personal', 'importBatch', batchId],
    queryFn: () => loadImportBatch(batchId),
    enabled: !!batchId,
  });
  const workspaceId: string | null = batchQuery.data?.batch?.workspace_id ?? null;

  const dataQuery = useQuery({
    queryKey: ['personal', 'data', workspaceId],
    queryFn: () => loadPersonalData(workspaceId as string),
    enabled: !!workspaceId,
  });

  const summary = (batchQuery.data?.batch?.summary_json ?? null) as ImportSummary | null;
  const items = (batchQuery.data?.items ?? []) as ImportItemRow[];
  const today = todayISO();

  const [state, setState] = useState<ReviewState | null>(null);
  const effectiveState: ReviewState | null = state ?? (summary ? initialReviewState(summary, today) : null);

  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const reimportRequired = useMemo(
    () => items.length > 0 && batchNeedsReimport(items.map((i) => ({ inferred_kind: i.inferred_kind, group_key: i.group_key }))),
    [items],
  );

  // Monta o batch com o escopo escolhido na UI e roda o planner p/ preview.
  const plan = useMemo(() => {
    if (!summary || !effectiveState || !batchQuery.data?.batch || !dataQuery.data) return null;
    const b = batchQuery.data.batch as unknown as ImportBatchRow;
    // Coalesce: o saldo mostrado vem do summary_json; se a coluna detected_balance
    // estiver ausente (batch antigo), usa o saldo do summary para o plano bater com a UI.
    const batchRow: ImportBatchRow = {
      ...b,
      account_scope: effectiveState.scope ?? b.account_scope,
      detected_balance: b.detected_balance ?? summary.saldo.valor,
      balance_source: b.balance_source ?? summary.saldo.fonte,
      summary_json: summary,
    };
    return buildApplyPlan({ batch: batchRow, items, decisions: buildDecisions(effectiveState), existingPersonalData: dataQuery.data });
  }, [summary, effectiveState, batchQuery.data, dataQuery.data, items]);

  if (batchQuery.isLoading || (!!workspaceId && dataQuery.isLoading)) {
    return <Shell><p className="text-sm text-muted-foreground">Carregando revisão…</p></Shell>;
  }
  if (batchQuery.error || !summary || !effectiveState) {
    return <Shell><p className="text-sm text-red-700">Não foi possível carregar este lote de importação.</p></Shell>;
  }

  const accounts = (dataQuery.data?.accounts ?? []).map((a) => ({ id: a.id, label: a.label }));
  const daily = dailyCandidate(summary);
  const gate = canApply(effectiveState, summary);
  const preview = plan ? planPreview(plan) : null;

  async function onApply() {
    if (inFlight.current) return; // trava duplo clique
    inFlight.current = true;
    setApplying(true);
    setApplyError(null);
    const st = effectiveState!;
    try {
      if (st.scope) await setImportBatchScope(batchId, st.scope);

      // RETRY SEGURO: nunca reusa o plano em memória (pode estar stale após uma
      // aplicação parcial). Recarrega staging + dados pessoais e RECONSTRÓI o
      // plano com o estado atual — itens já vinculados viram skip; target criado
      // mas não vinculado é reconhecido pelo dedupe forte (reconcile).
      const fresh = await loadImportBatch(batchId);
      const b = fresh.batch as unknown as ImportBatchRow | null;
      if (!b || !b.summary_json) throw new Error('Lote de importação indisponível.');
      const freshData = await loadPersonalData(b.workspace_id);
      const freshItems = fresh.items as unknown as ImportItemRow[];
      const freshSummary = b.summary_json as ImportSummary | null;
      const batchRow: ImportBatchRow = {
        ...b,
        account_scope: st.scope ?? b.account_scope,
        detected_balance: b.detected_balance ?? freshSummary?.saldo?.valor ?? null,
        balance_source: b.balance_source ?? freshSummary?.saldo?.fonte ?? null,
      };
      const freshPlan = buildApplyPlan({ batch: batchRow, items: freshItems, decisions: buildDecisions(st), existingPersonalData: freshData });
      if (freshPlan.blocked) throw new Error(freshPlan.blockedReason ?? 'Não é possível aplicar este lote.');

      await persistItemDecisions(itemDecisionsFromPlan(freshPlan));
      await applyBatch(freshPlan);
      await qc.invalidateQueries({ queryKey: ['personal', 'data'] });
      await qc.invalidateQueries({ queryKey: ['personal', 'importBatch', batchId] });
      navigate('/personal/overview');
    } catch (e) {
      setApplyError((e as Error)?.message ?? 'Não foi possível aplicar agora. Tente novamente.');
      setApplying(false);
      inFlight.current = false; // permite retry seguro (idempotência item-a-item)
      // Recarrega para o preview refletir o que já foi aplicado antes da falha.
      qc.invalidateQueries({ queryKey: ['personal', 'importBatch', batchId] });
      qc.invalidateQueries({ queryKey: ['personal', 'data'] });
    }
  }

  return (
    <Shell>
      <ReviewPanel
        summary={summary}
        state={effectiveState}
        onChange={setState}
        accounts={accounts}
        needsScope={needsScope(summary)}
        daily={daily}
        preview={preview}
        gate={gate}
        applying={applying}
        applyError={applyError}
        reimportRequired={reimportRequired}
        onReimport={() => navigate('/personal/import')}
        onApply={onApply}
      />
    </Shell>
  );
}
