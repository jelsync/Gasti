import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatMoney } from '@/utils/format';
import type { Currency } from '@/types/models';
import { cn } from '@/lib/utils';
import { HIDDEN_AMOUNT, PrivacyToggle } from '@/components/ui/PrivacyToggle';
import { usePrivacy } from '@/contexts/privacy';

type Tone = 'income' | 'expense' | 'primary' | 'neutral';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
  currency?: Currency;
  secondaryValue?: number;
  secondaryCurrency?: Currency;
  privacyKey?: string;
}

const toneStyles: Record<Tone, { text: string; badge: string }> = {
  income: { text: 'text-income', badge: 'bg-income-soft text-income' },
  expense: { text: 'text-expense', badge: 'bg-expense-soft text-expense' },
  primary: { text: 'text-primary', badge: 'bg-accent text-accent-foreground' },
  neutral: { text: 'text-foreground', badge: 'bg-muted text-muted-foreground' },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  currency = 'HNL',
  secondaryValue,
  secondaryCurrency = 'USD',
  privacyKey,
}: StatCardProps) {
  const { isHidden } = usePrivacy();
  const styles = toneStyles[tone];
  const hidden = privacyKey ? isHidden(privacyKey) : false;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1">
          {privacyKey && <PrivacyToggle privacyKey={privacyKey} />}
          <span
            className={cn('flex h-9 w-9 items-center justify-center rounded-full', styles.badge)}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </div>
      <div className={cn('mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1', styles.text)}>
        <span className="text-2xl font-bold tabular-nums">
          {hidden ? HIDDEN_AMOUNT : formatMoney(value, currency)}
        </span>
        {!hidden && secondaryValue !== undefined && secondaryValue !== 0 && (
          <span className="text-lg font-bold tabular-nums">
            {formatMoney(secondaryValue, secondaryCurrency)}
          </span>
        )}
      </div>
    </Card>
  );
}
