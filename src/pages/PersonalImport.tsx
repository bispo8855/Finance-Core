// ============================================================================
// Aurys Personal — rota /personal/import (AP4C.1b).
// Fluxo: usuário envia CSV/XLSX → parser+inferência no cliente → grava STAGING
// (batch + items) → tela "O que o Aurys encontrou". NADA é aplicado em
// personal_*; a revisão/aplicação fica para AP4C.1c em diante.
// ============================================================================

import { Link } from 'react-router-dom';
import { usePersonalImport } from '@/hooks/personal/usePersonalImport';
import ImportUploadCard from '@/components/personal/import/ImportUploadCard';
import AurysFindings from '@/components/personal/import/AurysFindings';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
            <span>Aurys</span>
            <span className="text-muted-foreground/30">|</span>
            <span>Personal</span>
          </div>
          <Link to="/personal/overview" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            ← Voltar ao meu mês
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function PersonalImport() {
  const { status, result, error, runImport, reset } = usePersonalImport();
  const isProcessing = status === 'parsing' || status === 'saving';

  return (
    <Shell>
      {status === 'done' && result ? (
        <div className="space-y-6">
          <AurysFindings summary={result.summary} titularRaw={result.titularRaw} fileName={result.fileName} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Enviar outro extrato
            </button>
            <span className="text-xs text-muted-foreground">
              A revisão e a aplicação do que o Aurys encontrou chegam no próximo passo.
            </span>
          </div>
        </div>
      ) : (
        <ImportUploadCard onFile={runImport} isProcessing={isProcessing} error={error} />
      )}
    </Shell>
  );
}
