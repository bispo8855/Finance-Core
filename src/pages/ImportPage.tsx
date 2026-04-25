import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, ArrowLeft, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { ImportBatch, ImportSource, ImportMode } from '@/types/import';
import { processImportFile } from '@/services/importEngine';
import ImportUploadStep from '@/components/import/ImportUploadStep';
import ImportLoadingStep from '@/components/import/ImportLoadingStep';
import ImportReviewDashboard from '@/components/import/ImportReviewDashboard';
import { supabaseFinanceService } from '@/services/finance/supabaseFinanceService';
import { toast } from 'sonner';

type ImportStep = 'upload' | 'loading' | 'review' | 'success';

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [loadingStage, setLoadingStage] = useState<'reading' | 'interpreting' | 'grouping'>('reading');
  const [importedCount, setImportedCount] = useState(0);

  const handleUpload = async (file: File, source: ImportSource, mode: ImportMode) => {
    try {
      setStep('loading');
      setLoadingStage('reading');
      
      // Simular um tempo de leitura para efeito de feedback visual
      await new Promise(r => setTimeout(r, 800));
      setLoadingStage('interpreting');
      
      // Ler arquivo real com o service importEngine
      const buffer = await file.arrayBuffer();
      
      await new Promise(r => setTimeout(r, 600));
      setLoadingStage('grouping');
      
      const newBatch = await processImportFile(buffer, file.name, file.name.endsWith('.csv') ? 'csv' : 'xlsx', source, mode);
      
      // 5. Motor de Conciliação e Duplicidade
      try {
        const snapshot = await supabaseFinanceService.getSnapshot();
        const pendingTitles = snapshot.titles.filter(t => t.status === 'previsto' && (t.side === 'receber' || t.side === 'pagar'));
        const existingDescriptions = new Set(snapshot.documents.map(d => d.description));
        
        for (const event of newBatch.events) {
          // A. Verificação de Duplicidade (Cross-Reference)
          if (existingDescriptions.has(event.title)) {
            event.flags = [...(event.flags || []), 'duplicate'];
            event.status = 'pendente';
            event.confidence = 'revisar';
          }

          // B. Verificação de Conciliação Inteligente
          // Prioridade 1: Match por Referência (ORDER_ID)
          let matchFound = false;
          if (event.reference && (mode === 'bank' || (mode === 'sales' && ['repasse', 'liberacao', 'transferencia', 'deposito', 'antecipacao'].includes(event.primaryType)))) {
            const idPattern = `[#${event.reference}]`;
            const refCandidates = pendingTitles.filter(t => (t.description || '').includes(idPattern));
            
            if (refCandidates.length === 1) {
              event.reconciliationId = refCandidates[0].id;
              event.reconciliationType = 'match';
              event.confidence = 'alta';
              event.explanation = (event.explanation || '') + ' | Conciliado via ID do pedido.';
              matchFound = true;
            } else if (refCandidates.length > 1) {
              event.reconciliationType = 'multiple';
              event.confidence = 'revisar';
              event.explanation = (event.explanation || '') + ` | Conflito: múltiplos lançamentos com o mesmo ID (${event.reference}).`;
              matchFound = true; // Impede o fallback para evitar match errado
            }
          }

          // Prioridade 2: Fallback por Valor + Data (apenas se não houver match por ID)
          if (!matchFound && mode !== 'generic') {
            const isLiquidation = ['repasse', 'liberacao', 'transferencia', 'deposito', 'antecipacao'].includes(event.primaryType);
            const shouldConciliate = mode === 'bank' || (mode === 'sales' && isLiquidation);
            
            if (shouldConciliate) {
              const eventValue = Math.abs(event.netAmount);
              const eventDate = new Date(event.date);
              const dayMargin = mode === 'bank' ? 3 : 7;
              
              const valCandidates = pendingTitles.filter(t => {
                const sameValue = Math.abs(t.value - eventValue) < 0.01;
                const tDate = new Date(t.dueDate);
                const diffDays = Math.abs(tDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
                return sameValue && diffDays <= dayMargin;
              });

              if (valCandidates.length === 1) {
                event.reconciliationId = valCandidates[0].id;
                event.reconciliationType = 'match';
                if (mode === 'bank') event.confidence = 'alta';
              } else if (valCandidates.length > 1) {
                event.reconciliationType = 'multiple';
                event.confidence = 'revisar';
              } else {
                event.reconciliationType = 'none';
                if (mode === 'bank') event.explanation = (event.explanation || '') + ' | Criado como Entrada Avulsa (sem título correspondente).';
              }
            }
          }
          
          if (mode === 'generic') event.confidence = 'revisar';
        }
      } catch (err) {
        console.warn("Não foi possível realizar a conciliação automática", err);
      }

      await new Promise(r => setTimeout(r, 500));
      
      setBatch(newBatch);
      setStep('review');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error('Erro ao processar arquivo', { description: msg });
      setStep('upload');
    }
  };

  const handleImportSuccess = (count: number) => {
    setImportedCount(count);
    setStep('success');
  };

  const resetFlow = () => {
    setBatch(null);
    setImportedCount(0);
    setStep('upload');
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-[1200px] mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
            Importação Inteligente
          </h2>
          <p className="text-slate-500 mt-1">
            Escolha o tipo de arquivo e deixe o Aurys estruturar seu financeiro centavo por centavo.
          </p>
        </div>
        
        {step !== 'upload' && (
          <Button variant="outline" onClick={resetFlow} className="text-slate-600">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancelar e Voltar
          </Button>
        )}
      </div>

      <div className="mt-8">
        {step === 'upload' && <ImportUploadStep onUpload={handleUpload} />}
        {step === 'loading' && <ImportLoadingStep stage={loadingStage} />}
        {step === 'review' && batch && <ImportReviewDashboard batch={batch} onReset={resetFlow} onImportSuccess={handleImportSuccess} />}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-200 rounded-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">Importação Concluída!</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                Registramos <strong className="text-emerald-600">{importedCount} eventos</strong> financeiros no seu sistema. Suas contas a receber já foram atualizadas.
              </p>
            </div>
            <div className="pt-4 flex gap-4">
              <Button variant="outline" onClick={resetFlow}>Importar outro arquivo</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
