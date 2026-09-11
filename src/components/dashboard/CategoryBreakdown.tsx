import { CategoryIcon } from '@/components/CategoryIcon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatMoney, formatPercent } from '@/utils/format';
import type { CategorySummary, Currency } from '@/types/models';

interface CategoryBreakdownProps {
  items: CategorySummary[];
  total: number;
  limit?: number;
  currency?: Currency;
}

export function CategoryBreakdown({
  items,
  total,
  limit,
  currency = 'HNL',
}: CategoryBreakdownProps) {
  const list = limit ? items.slice(0, limit) : items;

  return (
    <ul className="space-y-4">
      {list.map((item) => {
        const share = total > 0 ? (item.total / total) * 100 : 0;
        return (
          <li key={item.categoryId ?? item.name}>
            <div className="mb-1.5 flex items-center gap-3">
              <CategoryIcon icon={item.icon} color={item.color} size="sm" />
              <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatMoney(item.total, currency)}
              </span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                {formatPercent(share)}
              </span>
            </div>
            <ProgressBar value={share} color={item.color} />
          </li>
        );
      })}
    </ul>
  );
}
