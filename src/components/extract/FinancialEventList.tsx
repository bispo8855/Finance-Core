import { FinancialEvent } from "@/domain/extract";
import { FinancialEventCard } from "./FinancialEventCard";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialEventListProps {
  events: FinancialEvent[];
}

export function FinancialEventList({ events }: FinancialEventListProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
        <p className="text-muted-foreground">Nenhuma movimentação financeira encontrada neste período.</p>
      </div>
    );
  }

  // Group events by date
  const groups: { [date: string]: FinancialEvent[] } = {};
  events.forEach(event => {
    if (!groups[event.date]) {
      groups[event.date] = [];
    }
    groups[event.date].push(event);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    
    // Capitalize first letter (e.g. "20 de Março")
    const label = format(date, "d 'de' MMMM", { locale: ptBR });
    return label;
  };

  return (
    <div className="space-y-8">
      {sortedDates.map((date) => (
        <div key={date} className="space-y-3">
          <div className="flex items-baseline gap-3 px-1">
            <h3 className="text-sm font-bold text-foreground/80">{getDateLabel(date)}</h3>
            <div className="h-px bg-muted flex-1" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {groups[date].length} {groups[date].length === 1 ? 'evento' : 'eventos'}
            </span>
          </div>
          <div className="space-y-3">
            {groups[date].map((event) => (
              <FinancialEventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
