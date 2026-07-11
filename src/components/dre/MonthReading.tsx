import { cn } from '@/lib/utils';
import { MonthReadingSentence } from '@/domain/finance/monthReading';

export function MonthReading({ sentences }: { sentences: MonthReadingSentence[] }) {
  if (sentences.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Leitura do Mês</h3>
      </div>
      <div className="p-4 space-y-3">
        {sentences.map((s) => (
          <div key={s.id} className="flex items-start gap-2.5">
            <span
              className={cn(
                'mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0',
                s.tone === 'positive' && 'bg-emerald-500',
                s.tone === 'attention' && 'bg-amber-500',
                s.tone === 'neutral' && 'bg-muted-foreground/30',
              )}
            />
            <p className="text-sm leading-relaxed text-foreground">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
