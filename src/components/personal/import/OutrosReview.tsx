// ============================================================================
// Aurys Personal — revisão dirigida dos maiores "Outros" (AP4C.1d).
// Presentacional e CONTROLADO. Pergunta humana por item; "Sim, é pessoal" abre
// o seletor de categoria (11 categorias reais, sem "Outros"). Não recalcula
// nada aqui — a página aplica adjustSummaryForReview e reconstrói o preview.
// ============================================================================

import { PERSONAL_CATEGORIES, PersonalCategory } from '@/domain/personal/import/personalCategories';
import { OutrosItem, OutrosDecisions, OutrosDecision } from '@/domain/personal/import/outrosReview';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const CATEGORIAS = PERSONAL_CATEGORIES.filter((c) => c !== 'Outros') as readonly PersonalCategory[];

export interface OutrosReviewProps {
  items: OutrosItem[];
  decisions: OutrosDecisions;
  onChange: (next: OutrosDecisions) => void;
  outrosPct: number;
}

export default function OutrosReview({ items, decisions, onChange, outrosPct }: OutrosReviewProps) {
  if (items.length === 0) return null;
  const set = (id: string, d: OutrosDecision) => onChange({ ...decisions, [id]: d });

  const OPTS: { kind: OutrosDecision['kind']; label: string }[] = [
    { kind: 'pessoal', label: 'Sim, é pessoal' },
    { kind: 'pontual', label: 'Foi pontual' },
    { kind: 'negocio', label: 'É da empresa' },
    { kind: 'duvida', label: 'Não sei' },
  ];

  return (
    <div className="mt-3 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Revise os maiores gastos em Outros</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Estes poucos itens concentram a maior parte do que ainda está sem categoria ({Math.round(outrosPct * 100)}% dos gastos variáveis).
      </p>

      <ul className="mt-3 space-y-4">
        {items.map((it) => {
          const d = decisions[it.id];
          return (
            <li key={it.id} className="border-t pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{it.description}</span>
                <span className="shrink-0 tabular-nums text-sm">{brl(it.amount)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Esse gasto faz parte da sua rotina?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {OPTS.map((o) => (
                  <button
                    key={o.kind}
                    type="button"
                    onClick={() => set(it.id, o.kind === 'pessoal' ? { kind: 'pessoal', category: d?.category } : { kind: o.kind })}
                    className={`rounded-full px-3 py-1 text-xs ${d?.kind === o.kind ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {d?.kind === 'pessoal' && (
                <div className="mt-2">
                  <label className="text-xs text-muted-foreground">Categoria: </label>
                  <select
                    aria-label={`Categoria de ${it.description}`}
                    className="ml-1 rounded border px-2 py-1 text-xs"
                    value={d.category ?? ''}
                    onChange={(e) => set(it.id, { kind: 'pessoal', category: (e.target.value || undefined) as PersonalCategory | undefined })}
                  >
                    <option value="">Escolha…</option>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
