// ============================================================================
// Aurys Personal — painel de REVISÃO + aplicação (AP4C.1c-2). Presentacional e
// CONTROLADO (state via props + onChange). Não chama planner/executor/banco: a
// página faz isso. Nada é aplicado antes do clique final em "Aplicar".
// ============================================================================

import { ImportSummary } from '@/domain/personal/import/personalImportInference';
import {
  ReviewState, AccountChoice, DailyCandidate, ApplyGate,
  incomeGroupKey, fixedGroupKey, isSingleOccurrence,
} from '@/domain/personal/import/reviewDecisions';
import { PlanPreview } from '@/domain/personal/import/reviewDecisions';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const plural = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`;
const fmtDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '—';
};

export interface ReviewPanelProps {
  summary: ImportSummary;
  state: ReviewState;
  onChange: (next: ReviewState) => void;
  accounts: { id: string; label: string }[];
  needsScope: boolean;
  daily: DailyCandidate;
  preview: PlanPreview | null;
  gate: ApplyGate;
  applying: boolean;
  applyError: string | null;
  reimportRequired: boolean;
  onReimport: () => void;
  onApply: () => void;
}

export default function ReviewPanel(p: ReviewPanelProps) {
  const { summary: s, state, onChange } = p;
  const set = (patch: Partial<ReviewState>) => onChange({ ...state, ...patch });

  // ---- Batch antigo: bloqueia tudo e pede reimportação ----
  if (p.reimportRequired) {
    return (
      <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/20">
        <h2 className="text-lg font-bold">Precisamos reimportar este extrato</h2>
        <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">
          Este extrato foi importado antes da atualização da análise. Envie-o novamente para aplicar os dados com segurança.
        </p>
        <button type="button" onClick={p.onReimport} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Importar novamente
        </button>
      </div>
    );
  }

  const negocio = state.scope === 'negocio';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revisar e aplicar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confira o que o Aurys encontrou. Nada é salvo até você clicar em aplicar.</p>
      </div>

      {/* ESCOPO PF/PJ */}
      {p.needsScope && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Esta conta é…</h2>
          <p className="mt-1 text-xs text-muted-foreground">O extrato tem sinais de uso misto pessoa física / empresa.</p>
          <div className="mt-3 space-y-2">
            {([['pessoal', 'Pessoal'], ['misto', 'Misto'], ['negocio', 'Da empresa']] as const).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input type="radio" name="scope" checked={state.scope === v} onChange={() => set({ scope: v })} />
                {label}
              </label>
            ))}
          </div>
        </section>
      )}

      {negocio ? (
        <section className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Conta de empresa: nada será aplicado no seu Personal. Para finanças da empresa, use o Aurys Business.
          </p>
        </section>
      ) : (
        <>
          {/* SALDO / CONTA */}
          {s.saldo.valor != null && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Saldo encontrado: <span className="tabular-nums">{brl(s.saldo.valor)}</span></h2>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={state.useBalance} onChange={(e) => set({ useBalance: e.target.checked })} />
                Usar este saldo
              </label>
              {state.useBalance && (
                <div className="mt-3 space-y-2 pl-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="acct" checked={state.accountChoice?.mode === 'existing'} onChange={() => set({ accountChoice: { mode: 'existing', accountId: p.accounts[0]?.id } })} />
                    Conta existente
                  </label>
                  {state.accountChoice?.mode === 'existing' && (
                    <select
                      aria-label="Conta existente"
                      className="ml-6 rounded border px-2 py-1 text-sm"
                      value={state.accountChoice.accountId ?? ''}
                      onChange={(e) => set({ accountChoice: { mode: 'existing', accountId: e.target.value } })}
                    >
                      <option value="">Selecione…</option>
                      {p.accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="acct" checked={state.accountChoice?.mode === 'new'} onChange={() => set({ accountChoice: { mode: 'new', label: '' } })} />
                    Criar nova conta
                  </label>
                  {state.accountChoice?.mode === 'new' && (
                    <input
                      aria-label="Nome da nova conta"
                      placeholder="Ex.: Nubank"
                      className="ml-6 rounded border px-2 py-1 text-sm"
                      value={state.accountChoice.label ?? ''}
                      onChange={(e) => set({ accountChoice: { mode: 'new', label: e.target.value } })}
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {/* RENDAS */}
          {s.rendasProvaveis.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Rendas prováveis</h2>
              <ul className="mt-3 space-y-3">
                {s.rendasProvaveis.map((i) => {
                  const gk = incomeGroupKey(i);
                  const sel = state.income[gk] ?? { checked: false };
                  const single = isSingleOccurrence(i);
                  return (
                    <li key={gk}>
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={sel.checked} onChange={(e) => set({ income: { ...state.income, [gk]: { ...sel, checked: e.target.checked } } })} />
                          {i.description}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{brl(i.amount)}</span>
                      </label>
                      {sel.checked && single && (
                        <div className="ml-6 mt-2 rounded bg-muted/50 p-2 text-xs">
                          <span className="font-medium">Isso entra todo mês?</span>
                          <span className="ml-2 inline-flex gap-2">
                            <button type="button" onClick={() => set({ income: { ...state.income, [gk]: { ...sel, recurringAnswer: 'sim' } } })}
                              className={`rounded px-2 py-0.5 ${sel.recurringAnswer === 'sim' ? 'bg-primary text-primary-foreground' : 'border'}`}>Sim</button>
                            <button type="button" onClick={() => set({ income: { ...state.income, [gk]: { ...sel, recurringAnswer: 'nao' } } })}
                              className={`rounded px-2 py-0.5 ${sel.recurringAnswer === 'nao' ? 'bg-primary text-primary-foreground' : 'border'}`}>Não</button>
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* FIXAS */}
          {s.fixasProvaveis.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Contas fixas prováveis</h2>
              <ul className="mt-3 space-y-2">
                {s.fixasProvaveis.map((f) => {
                  const gk = fixedGroupKey(f);
                  const sel = state.fixed[gk] ?? { checked: false };
                  return (
                    <li key={gk} className="flex items-center justify-between gap-3 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={sel.checked} onChange={(e) => set({ fixed: { ...state.fixed, [gk]: { checked: e.target.checked } } })} />
                        {f.description}
                      </label>
                      <span className="tabular-nums text-muted-foreground">{brl(f.amount)} · dia {f.dayOfMonth}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* TRANSFERÊNCIAS / FATURAS (somente leitura) */}
          <section className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p><span className="font-medium text-foreground">{s.transferenciasProprias.length}</span> transferências próprias e <span className="font-medium text-foreground">{s.pagamentosFatura.length}</span> pagamentos de fatura foram ignorados (não entram na leitura).</p>
          </section>

          {/* DUVIDOSOS (somente leitura) */}
          {s.duvidosos.length > 0 && (() => {
            const total = s.duvidosos.reduce((a, d) => a + d.line.amount, 0);
            const saidas = s.duvidosos.filter((d) => d.line.direction === 'saida');
            const entradas = s.duvidosos.filter((d) => d.line.direction === 'entrada');
            const material = s.gastosVariaveis.total > 0 && saidas.reduce((a, d) => a + d.line.amount, 0) / s.gastosVariaveis.total > 0.10;
            return (
              <section className="rounded-xl border bg-muted/40 p-4 text-sm">
                <p className="text-muted-foreground">{plural(s.duvidosos.length, 'item', 'itens')} · {brl(total)} {s.duvidosos.length === 1 ? 'ficou' : 'ficaram'} em dúvida e não {s.duvidosos.length === 1 ? 'entra' : 'entram'} na leitura.</p>
                <p className="mt-1 text-xs text-muted-foreground">{plural(entradas.length, 'entrada', 'entradas')} · {plural(saidas.length, 'saída', 'saídas')}.</p>
                {material && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">Há saídas em dúvida relevantes — isso reduz a confiança do dia a dia.</p>}
              </section>
            );
          })()}

          {/* DIA A DIA — apresentação depende de quantos meses COMPLETOS há */}
          {p.daily.hasCandidate && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Dia a dia (gastos variáveis)</h2>

              {p.daily.completeMonths === 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">Dia a dia observado</p>
                  <p className="tabular-nums text-lg font-bold">{brl(s.gastosVariaveis.total)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Período observado: {fmtDate(s.period.from)} a {fmtDate(s.period.to)}
                  </p>
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Período insuficiente para estimar um mês típico. Importe pelo menos um mês completo para melhorar essa leitura.
                  </p>
                </div>
              )}

              {p.daily.completeMonths === 1 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">Estimativa de dia a dia</p>
                  <p className="tabular-nums text-lg font-bold">{brl(p.daily.normal)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">Baseado em apenas 1 mês completo — confiança baixa.</p>
                </div>
              )}

              {p.daily.completeMonths >= 2 && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                  <div><div className="text-xs text-muted-foreground">Mês leve</div><div className="tabular-nums font-medium">{brl(p.daily.min)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Mês normal</div><div className="tabular-nums font-medium">{brl(p.daily.normal)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Mês pesado</div><div className="tabular-nums font-medium">{brl(p.daily.heavy)}</div></div>
                </div>
              )}

              <p className="mt-2 text-xs text-muted-foreground">Ainda não separamos automaticamente todos os gastos pontuais.</p>

              {/* Confirmação só quando é permitida (≥1 mês completo e gates ok). 0 meses → não aplicável. */}
              {p.daily.canConfirm ? (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={state.dailyConfirmed} onChange={(e) => set({ dailyConfirmed: e.target.checked })} />
                  Este valor representa bem meu gasto mensal do dia a dia
                </label>
              ) : p.daily.completeMonths > 0 && p.daily.reason ? (
                <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">{p.daily.reason}</p>
              ) : null}
            </section>
          )}

          {/* PERFIL DE PAGAMENTO */}
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Como você paga a maior parte do dia a dia?</h2>
            <div className="mt-2 space-y-1.5">
              {([['maioria_cartao', 'Maioria no cartão'], ['meio_a_meio', 'Meio a meio'], ['maioria_pix', 'Maioria Pix/débito']] as const).map(([v, label]) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="profile" checked={state.profile === v} onChange={() => set({ profile: v })} />
                  {label}
                </label>
              ))}
            </div>
          </section>

          {/* PREVIEW */}
          {p.preview && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">O Aurys vai aplicar:</h2>
              <ul className="mt-2 space-y-1 text-sm">
                <li>{p.preview.saldo ? '1 saldo' : 'nenhum saldo'}</li>
                <li>{p.preview.rendas} renda(s)</li>
                <li>{p.preview.fixas} conta(s) fixa(s)</li>
                <li>dia a dia: {p.preview.daily ? 'sim' : 'não'}</li>
              </ul>
              {p.preview.dedupe > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Alguns itens já existem e não serão duplicados ({p.preview.dedupe}).</p>
              )}
              {!p.preview.onboardingConfiavel && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Ainda faltará: {p.preview.onboardingMissing.join(', ') || '—'}. Os dados confirmados serão salvos, mas a leitura completa ainda não será liberada.
                </p>
              )}
            </section>
          )}
        </>
      )}

      {/* AÇÃO */}
      {p.applyError && (
        <div className="rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{p.applyError}</div>
      )}
      {!p.gate.ok && p.gate.reasons.length > 0 && (
        <ul className="text-xs text-amber-700 dark:text-amber-300">{p.gate.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>
      )}
      <div>
        <button
          type="button"
          onClick={p.onApply}
          disabled={!p.gate.ok || p.applying}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {p.applying ? 'Aplicando…' : 'Aplicar dados confirmados'}
        </button>
      </div>
    </div>
  );
}
