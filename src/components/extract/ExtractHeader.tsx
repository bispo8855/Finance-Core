import { Activity } from "lucide-react";

export function ExtractHeader() {
  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Activity className="w-6 h-6 text-primary" />
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Extrato Inteligente</h1>
        <p className="text-muted-foreground">Entenda o caminho do seu dinheiro — agrupado por evento, não por lançamento.</p>
      </div>
    </div>
  );
}
