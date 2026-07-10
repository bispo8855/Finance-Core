import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildResultAlerts } from '@/domain/finance/resultAlerts';
import { SemanticResult } from '@/domain/finance/semanticResult';

export function ResultAlerts({ result }: { result: SemanticResult }) {
  const alerts = buildResultAlerts(result);
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={cn(
            'flex items-center gap-3 p-4 rounded-lg border',
            a.tone === 'amber'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
              : 'bg-muted/40 border-border'
          )}
        >
          {a.tone === 'amber' ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          )}
          <p className={cn('text-sm font-medium', a.tone === 'amber' ? 'text-amber-800 dark:text-amber-400' : 'text-muted-foreground')}>
            {a.message}
          </p>
        </div>
      ))}
    </div>
  );
}
