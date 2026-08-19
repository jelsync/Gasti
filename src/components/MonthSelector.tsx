import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthYear, nextMonth, previousMonth, type MonthYear } from '@/utils/date';

interface MonthSelectorProps {
  value: MonthYear;
  onChange: (value: MonthYear) => void;
  className?: string;
}

export function MonthSelector({ value, onChange, className }: MonthSelectorProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-[var(--radius)] border border-border bg-card p-1 ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={() => onChange(previousMonth(value))}
        aria-label="Mes anterior"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[9rem] text-center text-sm font-medium capitalize">
        {formatMonthYear(value.month, value.year)}
      </span>
      <button
        type="button"
        onClick={() => onChange(nextMonth(value))}
        aria-label="Mes siguiente"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
