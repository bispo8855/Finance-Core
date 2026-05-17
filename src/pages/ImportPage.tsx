import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, ArrowLeft, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { ImportBatch, ImportSource, ImportMode } from '@/types/import';
import { processImportFile } from '@/services/importEngine';
import { conciliateBatch, ConciliationStats } from '@/services/conciliationService';
import ImportUploadStep from '@/components/import/ImportUploadStep';
import ImportLoadingStep from '@/components/import/ImportLoadingStep';
import ImportReviewDashboard from '@/components/import/ImportReviewDashboard';
import { supabaseFinanceService } from '@/services/finance/supabaseFinanceService';
import { toast } from 'sonner';

type ImportStep = 'upload' | 'loading' | 'review' | 'success';

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [loadingStage, setLoadingStage] = useState<'reading' | 'interpreting' | 'grouping' | 'conciliating'>('reading');
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
      
      const hasAnyValidReference = newBatch.events.some(e => e.reference && e.reference.length > 0);
      if (!hasAnyValidReference && newBatch.events.length > 1) {
        toast.warning('Aviso sobre Agrupamento', {
          description: 'Não foi possível identificar um ID de pedido confiável. As vendas serão importadas individualmente.'
        });
      }
      
      // 5. Motor de Conciliação (agora via conciliationService)
      setLoadingStage('conciliating');
      await new Promise(r => setTimeout(r, 400));

      try {
        const snapshot = await supabaseFinanceService.getSnapshot();
        const { events: conciliatedEvents, stats } = conciliateBatch(newBatch.events, snapshot);
        
        newBatch.events = conciliatedEvents;

        // Feedback visual sobre resultados da conciliação
        showConciliationFeedback(stats);
        
      } catch (err) {
        console.warn("Não foi possível realizar a conciliação automática", err);
      }

      await new Promise(r => setTimeout(r, 300));
      
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

/**
 * Exibe toasts com feedback visual sobre o resultado da conciliação
 */
function showConciliationFeedback(stats: ConciliationStats) {
  if (stats.strong > 0) {
    toast.success(`✨ ${stats.strong} recebimento(s) conciliado(s) automaticamente`, {
      description: 'Vendas previstas serão liquidadas ao importar.',
      duration: 6000
    });
  }

  if (stats.medium > 0) {
    toast.info(`🔍 ${stats.medium} sugestão(ões) de conciliação encontrada(s)`, {
      description: 'Revise e confirme as correspondências sugeridas.',
      duration: 5000
    });
  }

  if (stats.pendingClassification > 0) {
    toast.warning(`⏳ ${stats.pendingClassification} movimentação(ões) pendente(s) de classificação`, {
      description: 'Classifique essas movimentações antes de aprovar para evitar impacto no DRE.',
      duration: 6000
    });
  }

  if (stats.duplicates > 0) {
    toast.warning(`⚠️ ${stats.duplicates} possível(is) duplicidade(s) detectada(s)`, {
      description: 'Verifique os eventos sinalizados antes de aprovar.',
      duration: 5000
    });
  }
}

