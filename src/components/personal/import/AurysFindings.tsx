// ============================================================================
// Aurys Personal — "O que o Aurys encontrou" (AP4C.1b).
// PRESENTACIONAL e PURO: recebe um ImportSummary e mostra os 9 blocos + avisos.
// NÃO aplica nada, NÃO decide nada — encantamento, não fechamento.
// Frase central: "O Aurys leu seu extrato. Nada foi aplicado ainda — você vai
// revisar antes."
// ============================================================================

import { ImportSummary } from '@/domain/personal/import/personalImportInference';

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function fmtMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
}

interface BlockProps {
  title: string;
  count?: number;
  value?: number | null;
  hint?: string;
  tone?: 'default' | 'muted';
  children?: React.ReactNode;
}

function Block({ title, count, value, hint, tone = 'default', children }: BlockProps) {
  return (
    <div className={`rounded-xl border p-4 ${tone === 'muted' ? 'bg-muted/40' : 'bg-card'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {typeof count === 'number' && (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {count} {count === 1 ? 'item' : 'itens'}
          </span>
        )}
      </div>
      {typeof value === 'number' && (
        <p className="mt-1 text-lg font-bold tabular-nums">{brl(value)}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export interface AurysFindingsProps {
  summary: ImportSummary;
  titularRaw?: string | null;
  fileName?: string | null;
}

export default function AurysFindings({ summary, titularRaw, fileName }: AurysFindingsProps) {
  const s = summary;
  const parciais = s.period.mesesParciais;
  const fixasTotal = s.fixasProvaveis.reduce((a, f) => a + f.amount, 0);
  const rendasTotal = s.rendasProvaveis.reduce((a, r) => a + r.amount, 0);
  const faturaTotal = s.pagamentosFatura.reduce((a, l) => a + l.amount, 0);

  return (
    <div className="space-y-6">
      {/* Frase central — encantamento + garantia de que nada foi aplicado */}
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-2xl font-bold tracking-tight">O que o Aurys encontrou</h1>
        <p className="mt-2 text-base text-muted-foreground">
          O Aurys leu seu extrato. Nada foi aplicado ainda — você vai revisar antes.
        </p>
        <p className="mt-3 text-xs text-muted-foreground/80">
          {fileName ? <>Arquivo: <span className="font-medium">{fileName}</span>. </> : null}
          {titularRaw ? <>Titular identificado: <span className="font-medium">{titularRaw}</span>. </> : null}
          Período {s.period.from || '—'} a {s.period.to || '—'} · {s.counts.linhas} lançamentos lidos.
        </p>
      </div>

      {/* Avisos importantes */}
      <div className="space-y-2">
        {s.saldo.valor != null && (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <span className="font-medium">Saldo encontrado:</span>{' '}
            <span className="tabular-nums">{brl(s.saldo.valor)}</span>{' '}
            <span className="text-muted-foreground">
              (fonte: {s.saldo.fonte === 'movimento' ? 'movimentação' : 'rodapé do extrato'})
            </span>
          </div>
        )}
        {parciais.length > 0 && (
          <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            <span className="font-medium">Período parcial.</span>{' '}
            {parciais.map(fmtMonth).join(', ')} {parciais.length === 1 ? 'está incompleto' : 'estão incompletos'} —
            a leitura do dia a dia fica aproximada. Dois ou três meses completos dão uma leitura melhor.
          </div>
        )}
        {s.alertaContaMista && (
          <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            <span className="font-medium">Atenção:</span> {s.alertaContaMista}
          </div>
        )}
        <div className="rounded-lg border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
          Nada foi aplicado ainda. Você vai revisar antes.
        </div>
      </div>

      {/* 9 blocos */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Block
          title="Saldo encontrado"
          value={s.saldo.valor}
          hint={
            s.saldo.valor == null
              ? 'Não encontramos um saldo explícito no arquivo.'
              : `Fonte: ${s.saldo.fonte === 'movimento' ? 'coluna de saldo da movimentação' : 'rodapé do extrato'}.`
          }
        />
        <Block
          title="Rendas prováveis"
          count={s.rendasProvaveis.length}
          value={rendasTotal || undefined}
          hint="Créditos recorrentes ou com cara de salário/provento."
        />
        <Block
          title="Contas fixas prováveis"
          count={s.fixasProvaveis.length}
          value={fixasTotal || undefined}
          hint="Compromissos que se repetem (moradia, assinaturas, dívidas…)."
        />
        <Block
          title="Transferências próprias"
          count={s.transferenciasProprias.length}
          tone="muted"
          hint="PIX/TED entre suas contas — ignoradas (não são gasto nem renda)."
        />
        <Block
          title="Pagamentos de fatura"
          count={s.pagamentosFatura.length}
          value={faturaTotal || undefined}
          tone="muted"
          hint="Pagamento do cartão — ignorado aqui (a despesa está na fatura)."
        />
        <Block
          title="Gastos variáveis"
          count={s.counts.variaveis}
          value={s.gastosVariaveis.total || undefined}
          hint="O dia a dia, por categoria."
        >
          {s.gastosVariaveis.byCategory.length > 0 && (
            <ul className="mt-3 space-y-1">
              {s.gastosVariaveis.byCategory.slice(0, 6).map((c) => (
                <li key={c.category} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{c.category}</span>
                  <span className="tabular-nums font-medium">{brl(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>
        <Block
          title="Itens em dúvida"
          count={s.duvidosos.length}
          hint="Não tivemos certeza — você decide no próximo passo."
        />
        <Block
          title="Atípicos / one-offs"
          tone="muted"
          hint="Ainda não separamos gastos atípicos automaticamente — isso chega num próximo passo."
        />
        <Block
          title="Ignorados"
          count={s.ignorados.length}
          tone="muted"
          hint="Estornos, reembolsos e afins — fora da leitura de rotina."
        />
      </div>
    </div>
  );
}
