import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, FileSearch, RefreshCcw, LayoutTemplate } from 'lucide-react';

interface ImportLoadingStepProps {
  stage: 'reading' | 'interpreting' | 'grouping';
}

export default function ImportLoadingStep({ stage }: ImportLoadingStepProps) {
  
  const getProgress = () => {
    switch (stage) {
      case 'reading': return 33;
      case 'interpreting': return 66;
      case 'grouping': return 90; // Never 100 until done
      default: return 0;
    }
  };

  return (
    <Card className="max-w-md mx-auto shadow-sm border-slate-200 mt-12 py-8">
      <CardContent className="flex flex-col items-center justify-center space-y-8">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
          <div className="relative bg-white rounded-full p-6 shadow-sm border border-slate-100 flex items-center justify-center z-10">
            {stage === 'reading' && <FileSearch className="w-12 h-12 text-primary animate-pulse" />}
            {stage === 'interpreting' && <RefreshCcw className="w-12 h-12 text-primary animate-spin-slow" />}
            {stage === 'grouping' && <LayoutTemplate className="w-12 h-12 text-primary animate-bounce" />}
          </div>
        </div>

        <div className="text-center space-y-2 w-full px-6">
          <h3 className="text-xl font-semibold text-slate-800">
            {stage === 'reading' && 'Lendo arquivo...'}
            {stage === 'interpreting' && 'Interpretando transações...'}
            {stage === 'grouping' && 'Agrupando por eventos...'}
          </h3>
          <p className="text-slate-500 text-sm">
            {stage === 'reading' && 'Extraindo colunas e dados brutos da planilha'}
            {stage === 'interpreting' && 'Classificando taxas, fretes, vendas e deduções'}
            {stage === 'grouping' && 'Consolidando transações usando IDs e datas'}
          </p>
          
          <div className="pt-4">
            <Progress value={getProgress()} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
