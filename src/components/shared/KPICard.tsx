import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  variant?: 'default' | 'featured' | 'positive' | 'negative' | 'warning';
  subtitle?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: 'bg-card border-border shadow-sm',
  featured: 'bg-muted/20 border-border/40 shadow-md ring-1 ring-primary/5',
  positive: 'bg-positive/5 border-positive/10 shadow-sm',
  negative: 'bg-destructive/5 border-destructive/10 shadow-sm',
  warning: 'bg-warning/5 border-warning/10 shadow-sm',
};

const iconBg = {
  default: 'bg-accent/50 text-accent-foreground',
  featured: 'bg-primary/10 text-primary',
  positive: 'bg-positive/10 text-positive',
  negative: 'bg-destructive/10 text-negative',
  warning: 'bg-warning/10 text-warning',
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
