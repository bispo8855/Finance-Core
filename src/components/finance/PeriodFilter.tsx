import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PeriodOption } from '@/lib/dateUtils';

interface PeriodFilterProps {
  value: PeriodOption;
  onChange: (value: PeriodOption) => void;
  className?: string;
}

export function PeriodFilter({ value, onChange, className }: PeriodFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PeriodOption)}>
      <SelectTrigger className={className || "w-[180px]"}>
        <SelectValue placeholder="Período" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="current_month">Mês Atual</SelectItem>
        <SelectItem value="previous_month">Mês Anterior</SelectItem>
        <SelectItem value="last_3_months">Últimos 3 Meses</SelectItem>
        <SelectItem value="all">Todos os períodos</SelectItem>
      </SelectContent>
    </Select>
  );
}
