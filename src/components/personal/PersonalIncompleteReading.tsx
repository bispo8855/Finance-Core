// ============================================================================
// Aurys Personal — estado HONESTO de leitura incompleta (AP4C.1c-2.1).
// Presentacional e PURO. Mostra só o que sabemos (saldo, renda) e o que falta —
// NUNCA sobra estrutural, projeções, disponível prudente ou frases de rotina.
// O que falta vem do resultado real de podeGerarLeituraConfiavel (gate.missing).
// ============================================================================

import { Link } from 'react-router-dom';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface PersonalIncompleteReadingProps {
  saldoAtual: number | null;   // null = ainda não conhecemos conta/saldo
  renda: { label: string; amount: number }[];
  missing: string[];           // gate.missing (ex.: 'dia a dia', 'cartão/fatura', 'contas fixas')
}

export default function PersonalIncompleteReading({ saldoAtual, renda, missing }: PersonalIncompleteReadingProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-xl font-bold tracking-tight">Sua leitura ainda está incompleta.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Já conheço seu saldo e parte da sua renda. Ainda preciso entender seus gastos do dia a dia,
          contas fixas e cartão para calcular quanto realmente sobra.
        </p>
      </div>

      {/* O que já sabemos */}
      <div className="grid gap-3 sm:grid-cols-2">
        {saldoAtual != null && (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Saldo atual</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{brl(saldoAtual)}</p>
          </div>
        )}
        {renda.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Renda identificada</p>
            <ul className="mt-1 space-y-0.5">
              {renda.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-muted-foreground">{r.label}</span>
                  <span className="tabular-nums font-medium">{brl(r.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* O que falta (do gate real) */}
      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Ainda falta:</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-200">
            {missing.map((m) => <li key={m}>• {m}</li>)}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/personal/import" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Importar extrato
        </Link>
        <span className="text-xs text-muted-foreground">Envie um extrato CSV/Excel para completar sua leitura.</span>
      </div>
    </div>
  );
}
