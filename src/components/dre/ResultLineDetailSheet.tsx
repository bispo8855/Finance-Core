import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { cn } from '@/lib/utils';

// Item genérico para o drill-down. Compatível com ResultContributor (linhas[].items)
// e com ExcludedItem (foraDoResultado[]) — origin é opcional.
export interface DetailItem {
  date: string;
  label: string;
  categoryName?: string;
  amount: number;
  origin?: string;
  semanticType: string;
  motivo: string;
}

export function ResultLineDetailSheet({
  open,
  onOpenChange,
  title,
  total,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  total?: number;
  items: DetailItem[];
}) {
  const sorted = [...items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {total !== undefined && (
            <SheetDescription>
              Total:{' '}
              <span className={cn('font-semibold tabular-nums', total < 0 ? 'text-negative' : 'text-positive')}>
                {formatCurrency(total)}
              </span>{' '}
              · {sorted.length} {sorted.length === 1 ? 'item' : 'itens'}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum item.</p>
          ) : (
            sorted.map((it, idx) => (
              <div key={idx} className="rounded-lg border p-3 space-y-1.5 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{it.label}</span>
                  <span className={cn('text-sm font-semibold tabular-nums shrink-0', it.amount < 0 ? 'text-negative' : 'text-positive')}>
                    {formatCurrency(it.amount)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(it.date)}</span>
                  {it.categoryName && (<><span>·</span><span>{it.categoryName}</span></>)}
                  {it.origin && (<><span>·</span><span>{it.origin}</span></>)}
                  <Badge variant="outline" className="text-[10px] font-normal">{it.semanticType}</Badge>
                </div>
                {it.motivo && <p className="text-xs text-muted-foreground/80 italic">{it.motivo}</p>}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
