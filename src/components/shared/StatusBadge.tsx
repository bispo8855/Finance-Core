import { cn } from '@/lib/utils';
import { TitleStatus } from '@/types/financial';

const statusConfig: Record<TitleStatus, { label: string; className: string }> = {
  previsto: { label: 'Previsto', className: 'bg-accent text-accent-foreground' },
  pago: { label: 'Pago', className: 'bg-success-subtle text-positive' },
  recebido: { label: 'Recebido', className: 'bg-success-subtle text-positive' },
  atrasado: { label: 'Atrasado', className: 'bg-destructive-subtle text-negative' },
  renegociado: { label: 'Renegociado', className: 'bg-warning-subtle text-warning' },
  cancelado: { label: 'Cancelado', className: 'bg-muted text-muted-foreground line-through' },
};

export function StatusBadge({ status }: { status: TitleStatus }) {
  const config = statusConfig[status] || statusConfig['previsto'];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
