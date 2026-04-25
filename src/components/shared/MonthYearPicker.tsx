import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const monthNames = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const fullMonthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface MonthYearPickerProps {
  date: Date;
  onChange: (d: Date) => void;
}

export function MonthYearPicker({ date, onChange }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [localYear, setLocalYear] = useState(date.getFullYear());
  const [localMonth, setLocalMonth] = useState(date.getMonth());
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync state when popup opens
  useEffect(() => {
    if (open) {
      setLocalYear(date.getFullYear());
      setLocalMonth(date.getMonth());
      // Give focus to the popover so we can capture keyboard events
      setTimeout(() => contentRef.current?.focus(), 50);
    }
  }, [open, date]);

  const handlePrev = () => {
    const d = new Date(date);
    d.setMonth(d.getMonth() - 1);
    onChange(d);
  };
  
  const handleNext = () => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    onChange(d);
  };

  const handleSelectMonth = (monthIndex: number, year: number = localYear) => {
    const d = new Date(date);
    d.setFullYear(year);
    d.setMonth(monthIndex);
    onChange(d);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (localMonth === 0) {
        setLocalMonth(11);
        setLocalYear(y => y - 1);
      } else {
        setLocalMonth(m => m - 1);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (localMonth === 11) {
        setLocalMonth(0);
        setLocalYear(y => y + 1);
      } else {
        setLocalMonth(m => m + 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setLocalYear(y => y + 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setLocalYear(y => y - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectMonth(localMonth, localYear);
    }
  };

  return (
    <div className="flex gap-1 bg-muted rounded-lg p-0.5 items-center w-fit">
      <button 
        onClick={handlePrev}
        className="px-2 py-1.5 rounded-md text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="px-3 py-1.5 flex items-center justify-center gap-1.5 rounded-md text-xs font-medium bg-card shadow-sm text-foreground uppercase tracking-wider min-w-[140px] hover:bg-accent hover:text-accent-foreground transition-colors group">
            <span>{fullMonthNames[date.getMonth()]} <span className="opacity-70 group-hover:opacity-100 transition-opacity">/ {date.getFullYear()}</span></span>
            <ChevronDown className="w-3.5 h-3.5 opacity-50 ml-0.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          ref={contentRef}
          className="w-64 p-3 rounded-xl shadow-lg focus:outline-none" 
          align="center"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {/* Year Selector */}
          <div className="flex items-center justify-between mb-4 px-1">
            <button 
              onClick={() => setLocalYear(y => y - 1)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-semibold text-sm">
              {localYear}
            </div>
            <button 
              onClick={() => setLocalYear(y => y + 1)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-4 gap-2">
            {monthNames.map((m, i) => (
              <button
                key={i}
                onClick={() => handleSelectMonth(i)}
                className={cn(
                  "py-2 rounded-md text-xs font-medium transition-all",
                  localMonth === i
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground",
                  date.getMonth() === i && date.getFullYear() === localYear && localMonth !== i && "ring-1 ring-primary/30"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="mt-3 text-[10px] text-muted-foreground/60 text-center w-full font-medium">
            Use as setas para navegar e Enter para confirmar
          </div>
        </PopoverContent>
      </Popover>

      <button 
        onClick={handleNext}
        className="px-2 py-1.5 rounded-md text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm transition-all"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
