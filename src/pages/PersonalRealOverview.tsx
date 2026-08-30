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

import { Link } from 'react-router-dom';
import PersonalOverview from './PersonalOverview';
import { usePersonalData } from '@/hooks/personal/usePersonalData';

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

  const { inputs, isLoading, error } = usePersonalData(monthISO, today);

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

  // Critério de dados mínimos: ao menos 1 conta E 1 renda. (dailySpending pode faltar —
  // o adapter sinaliza a premissa crítica; dado incompleto ≠ dado ausente.)
  const temMinimos = !!inputs && inputs.accounts.length > 0 && inputs.incomeSources.length > 0;

  if (!temMinimos) {
    return (
      <Shell>
        <div className="rounded-xl border bg-card p-6 max-w-2xl">
          <h1 className="text-xl font-bold tracking-tight">Seu espaço Personal está pronto.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Agora falta informar seus dados para gerar a leitura do seu mês.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            <li className={inputs && inputs.accounts.length > 0 ? 'line-through opacity-60' : ''}>
              • Ao menos uma conta com saldo atual
            </li>
            <li className={inputs && inputs.incomeSources.length > 0 ? 'line-through opacity-60' : ''}>
              • Ao menos uma fonte de renda
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              to="/personal/import"
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Importar extrato
            </Link>
            <span className="text-xs text-muted-foreground">
              Envie um extrato CSV/XLSX e o Aurys pré-organiza tudo para você revisar.
            </span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/70">
            Enquanto isso, você pode conferir a demonstração em <span className="font-medium">/personal/demo</span>.
          </p>
        </div>
      </Shell>
    );
  }

  // Com dados mínimos → a tela de verdade (sem selo de demo).
  return <PersonalOverview inputs={inputs!} monthISO={monthISO} today={today} />;
}
