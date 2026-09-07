// ============================================================================
// Aurys Personal — rota REAL /personal/overview (AP4B.2a).
// Wrapper fino: usePersonalData (banco real via adapter) → estados → PersonalOverview.
// Prova o caminho ponta a ponta:
//   auth → getOrCreatePersonalWorkspace → RLS (workspace_type='personal')
//        → personalService → personalInputsAdapter → motor AP2 → tela
//
// ⚠️ §4.1 — EMPTY STATE HONESTO: sem dados mínimos NÃO chamamos a tela de diagnóstico.
// buildPersonalMonth com arrays vazios daria zeros, e zero não é leitura — é ausência
// de informação. Vender isso como diagnóstico seria mentir (Princípio 4).
// Dados mínimos = pelo menos 1 CONTA e 1 RENDA (sem os dois não há trajetória possível).
// ============================================================================

import PersonalOverview from './PersonalOverview';
import PersonalIncompleteReading from '@/components/personal/PersonalIncompleteReading';
import { usePersonalData } from '@/hooks/personal/usePersonalData';
import { readingIsReliable } from '@/domain/personal/personalReadingGate';

// Mês/hoje a partir do relógio real (a rota real não é determinística como a demo).
function currentMonthISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function todayISO(d: Date): string {
  return `${currentMonthISO(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">
          <span>Aurys</span>
          <span className="text-muted-foreground/30">|</span>
          <span>Personal</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function PersonalRealOverview() {
  const now = new Date();
  const monthISO = currentMonthISO(now);
  const today = todayISO(now);

  const { inputs, isLoading, error, declaredNoCards, declaredNoFixedCommitments } = usePersonalData(monthISO, today);

  if (isLoading) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Preparando seu espaço Personal…</p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="rounded-lg border border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20 p-4">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            Não foi possível carregar seus dados agora.
          </p>
          <p className="mt-1 text-xs text-red-700/80 dark:text-red-400/80">Tente novamente em instantes.</p>
        </div>
      </Shell>
    );
  }

  // GATE HONESTO: só produzimos a leitura completa quando podeGerarLeituraConfiavel
  // aprova (mesma regra do onboarding). Sem isso, mostrar saldo/renda + o que falta —
  // NUNCA sobra/projeção/prudente com gasto ausente virando zero.
  const gate = inputs
    ? readingIsReliable(inputs, { declaredNoCards, declaredNoFixedCommitments })
    : { ok: false, missing: ['conta', 'renda', 'dia a dia'] };

  if (!inputs || !gate.ok) {
    const saldoAtual = inputs && inputs.accounts.length > 0
      ? inputs.accounts.reduce((s, a) => s + a.currentBalance, 0)
      : null;
    const renda = (inputs?.incomeSources ?? [])
      .filter((i) => i.nature === 'rotina')
      .map((i) => ({ label: i.label, amount: i.amount }));
    return (
      <Shell>
        <PersonalIncompleteReading saldoAtual={saldoAtual} renda={renda} missing={gate.missing} />
      </Shell>
    );
  }

  // Leitura confiável → a tela de verdade (sem selo de demo).
  return <PersonalOverview inputs={inputs!} monthISO={monthISO} today={today} />;
}
