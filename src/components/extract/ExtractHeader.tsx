import { Activity, BookOpen } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ExtractHeader() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Activity className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Extrato Inteligente</h1>
          <p className="text-muted-foreground">Entenda o caminho do seu dinheiro e o impacto real no seu caixa.</p>
        </div>
      </div>

      <Alert className="bg-primary/5 border-primary/10 max-w-2xl">
        <BookOpen className="h-4 w-4 text-primary" />
        <AlertTitle className="text-sm font-semibold text-primary">Diferença Importante</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          O <strong>Extrato</strong> foca em movimentações que afetaram o seu caixa hoje. 
          Já o <strong>Histórico</strong> mostra o registro original dos documentos e parcelas lançadas.
        </AlertDescription>
      </Alert>
    </div>
  );
}
