import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  variant?: 'default' | 'positive' | 'negative' | 'warning';
  subtitle?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: 'bg-card',
  positive: 'bg-card border-l-4 border-l-success',
  negative: 'bg-card border-l-4 border-l-destructive',
  warning: 'bg-card border-l-4 border-l-warning',
};

const iconBg = {
  default: 'bg-accent text-accent-foreground',
  positive: 'bg-success-subtle text-positive',
  negative: 'bg-destructive-subtle text-negative',
  warning: 'bg-warning-subtle text-warning',
};

export function KPICard({ title, value, icon: Icon, variant = 'default', subtitle, onClick }: KPICardProps) {
  return (
    <div 
      className={cn(
        'rounded-xl border p-6 shadow-sm animate-fade-in transition-colors', 
        variantStyles[variant],
        onClick && 'cursor-pointer hover:bg-muted/50 group'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn('text-xl font-bold', variant === 'positive' && 'text-positive', variant === 'negative' && 'text-negative')}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn('rounded-lg p-2', iconBg[variant])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
