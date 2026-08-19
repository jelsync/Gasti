import { cn } from '@/lib/utils';

interface ProgressBarProps {
  /** Porcentaje 0-100 (puede exceder 100 para indicar sobregiro). */
  value: number;
  color?: string;
  className?: string;
}

export function ProgressBar({ value, color, className }: ProgressBarProps) {
  const width = Math.min(100, Math.max(0, value));
  const over = value > 100;
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${width}%`,
          backgroundColor: over ? 'var(--danger)' : (color ?? 'var(--primary)'),
        }}
      />
    </div>
  );
}
