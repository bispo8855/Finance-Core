// ============================================================================
// Aurys Personal — upload do extrato (AP4C.1b).
// Drag & drop + seletor de arquivo. Aceita CSV/XLSX. Apenas dispara onFile —
// o parsing/persistência vivem no hook. "Prefiro preencher manualmente" é só
// visual por enquanto (AP4C ainda não religa o wizard manual).
// ============================================================================

import { useRef, useState } from 'react';

export interface ImportUploadCardProps {
  onFile: (file: File) => void;
  isProcessing?: boolean;
  error?: string | null;
}

const ACCEPT = '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function ImportUploadCard({ onFile, isProcessing, error }: ImportUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file && !isProcessing) onFile(file);
  };

  return (
    <div className="space-y-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Importar extrato</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Envie o extrato da sua conta. Dois ou três meses dão uma leitura melhor.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Enviar extrato (CSV ou XLSX)"
        onClick={() => !isProcessing && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isProcessing) inputRef.current?.click();
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 bg-card hover:border-primary/50'
        } ${isProcessing ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => pick(e.target.files)}
        />
        {isProcessing ? (
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            O Aurys está lendo seu extrato…
          </div>
        ) : (
          <>
            <p className="text-sm font-medium">
              Arraste o arquivo aqui ou <span className="text-primary underline">clique para escolher</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Formatos aceitos: CSV ou XLSX.</p>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Alternativa manual — apenas visual por enquanto (não religada no AP4C.1b). */}
      <div className="pt-1">
        <button
          type="button"
          disabled
          title="Em breve"
          className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 opacity-70 cursor-not-allowed"
        >
          Prefiro preencher manualmente
        </button>
      </div>
    </div>
  );
}
