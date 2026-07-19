import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { RecognitionMeta } from '@/domain/finance/recognitionMeta';
import { settlementLabel, SettlementTone } from '@/domain/finance/accrualView';

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
  // Só presente na base Econômica (accrual) — C1 popula em ResultContributor/ExcludedItem.
  recognitionMeta?: RecognitionMeta;
}

// Tons do badge de liquidação. NENHUM é de erro (untracked = informativo, §7 R7).
const TONE_CLASS: Record<SettlementTone, string> = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  neutral: 'border-border bg-muted text-muted-foreground',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
};

function MetaRow({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right tabular-nums', value < 0 ? 'text-negative' : 'text-foreground')}>
        {formatCurrency(value)}
      </dd>
    </>
  );
}

// Bloco compacto de liquidação (base Econômica).
function SettlementBlock({ meta }: { meta: RecognitionMeta }) {
  const { label, tone } = settlementLabel(meta.settlementStatus);
  return (
    <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5">
      <Badge variant="outline" className={cn('text-[10px] font-medium', TONE_CLASS[tone])}>{label}</Badge>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <MetaRow label="Reconhecido" value={meta.documentRecognizedAmount} />
        <MetaRow label="Impacto no resultado" value={meta.resultImpactAmount} />
        {meta.expectedSettlementAmount !== undefined && (
          <MetaRow label="Esperado a liquidar" value={meta.expectedSettlementAmount} />
        )}
        <MetaRow label="Liquidado" value={meta.documentSettledAmount} />
        <MetaRow label="Em aberto" value={meta.documentOpenAmount} />
      </dl>
      {meta.unexplainedDiff !== undefined && (
        <p className="text-[11px] text-muted-foreground">
          Diferença não explicada:{' '}
          <span className="font-medium tabular-nums text-foreground">{formatCurrency(meta.unexplainedDiff)}</span>
          {' '}— classifique como desconto, taxa, juros, estorno ou ajuste.
        </p>
      )}
    </div>
  );
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
                {/* Só na base Econômica: no Realizado recognitionMeta é undefined → bloco não aparece */}
                {it.recognitionMeta && <SettlementBlock meta={it.recognitionMeta} />}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
