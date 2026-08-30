// ============================================================================
// Aurys Personal — hook da entrada assistida por extrato (AP4C.1b).
// Garante o workspace personal, roda parser+inferência no cliente e grava o
// resultado NO STAGING (batch + items). NÃO aplica nas tabelas de entrada do
// Personal, não há passo de aplicação de lote, não monta os inputs do motor e
// não chama motor/adapter/Business.
// ============================================================================

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreatePersonalWorkspace } from '@/services/personal/personalService';
import { createImportBatch, insertImportItems } from '@/services/personal/personalImportService';
import { rowsFromFile, summarizeRows, hashContent, persistImport } from '@/domain/personal/import/importFlow';
import { ImportSummary } from '@/domain/personal/import/personalImportInference';

export type ImportStatus = 'idle' | 'parsing' | 'saving' | 'done' | 'error';

export interface ImportResult {
  summary: ImportSummary;
  batchId: string;
  itemCount: number;
  titularRaw: string | null;
  fileName: string;
}

export interface UsePersonalImportResult {
  workspaceReady: boolean;
  status: ImportStatus;
  result: ImportResult | null;
  error: string | null;
  runImport: (file: File) => Promise<void>;
  reset: () => void;
}

export function usePersonalImport(): UsePersonalImportResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Mesmo padrão do usePersonalData: idempotente, cacheado por sessão.
  const wsQuery = useQuery({
    queryKey: ['personal', 'workspace', userId],
    queryFn: () => getOrCreatePersonalWorkspace(userId as string),
    enabled: !!userId,
    staleTime: Infinity,
  });
  const workspaceId = wsQuery.data?.workspaceId ?? null;

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  const runImport = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    if (!workspaceId) {
      setError('Seu espaço ainda está sendo preparado. Tente novamente em instantes.');
      setStatus('error');
      return;
    }
    try {
      setStatus('parsing');
      const rows = await rowsFromFile(file);
      const parse = summarizeRows(rows);
      if (parse.summary.counts.linhas === 0) {
        setError(
          parse.parseIssues[0] ??
            'Não consegui ler os lançamentos (data / descrição / valor). Confira se o arquivo é um extrato CSV/XLSX.',
        );
        setStatus('error');
        return;
      }
      setStatus('saving');
      const hash = await hashContent(JSON.stringify(rows));
      const { batchId, itemCount } = await persistImport(
        workspaceId,
        { name: file.name, hash },
        parse,
        { createImportBatch, insertImportItems },
      );
      setResult({ summary: parse.summary, batchId, itemCount, titularRaw: parse.titularRaw, fileName: file.name });
      setStatus('done');
    } catch (e) {
      setError((e as Error)?.message ?? 'Falha ao processar o extrato.');
      setStatus('error');
    }
  }, [workspaceId]);

  return { workspaceReady: !!workspaceId, status, result, error, runImport, reset };
}
