import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/lib/utils';

type Tone = 'income' | 'expense' | 'primary' | 'neutral';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
}

const toneStyles: Record<Tone, { text: string; badge: string }> = {
  income: { text: 'text-income', badge: 'bg-income-soft text-income' },
  expense: { text: 'text-expense', badge: 'bg-expense-soft text-expense' },
  primary: { text: 'text-primary', badge: 'bg-accent text-accent-foreground' },
  neutral: { text: 'text-foreground', badge: 'bg-muted text-muted-foreground' },
};

export function StatCard({ label, value, icon: Icon, tone = 'neutral' }: StatCardProps) {
  const styles = toneStyles[tone];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', styles.badge)}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <p className={cn('mt-3 text-2xl font-bold tabular-nums', styles.text)}>
        {formatCurrency(value)}
      </p>
    </Card>
  );
}
