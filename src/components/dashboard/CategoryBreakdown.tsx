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

interface MultiCurrencyCategoryBreakdownProps {
  hnlItems: CategorySummary[];
  usdItems: CategorySummary[];
  hnlTotal: number;
  usdTotal: number;
  limit?: number;
}

interface CombinedCategory {
  key: string;
  name: string;
  icon: string;
  color: string;
  hnl: number;
  usd: number;
}

/** Un solo listado visual, conservando porcentajes independientes por moneda. */
export function MultiCurrencyCategoryBreakdown({
  hnlItems,
  usdItems,
  hnlTotal,
  usdTotal,
  limit,
}: MultiCurrencyCategoryBreakdownProps) {
  const categories = new Map<string, CombinedCategory>();
  const add = (item: CategorySummary, currency: Currency) => {
    const key = item.categoryId ?? `name:${item.name}`;
    const current = categories.get(key) ?? {
      key,
      name: item.name,
      icon: item.icon,
      color: item.color,
      hnl: 0,
      usd: 0,
    };
    current[currency === 'HNL' ? 'hnl' : 'usd'] = item.total;
    categories.set(key, current);
  };

  hnlItems.forEach((item) => add(item, 'HNL'));
  usdItems.forEach((item) => add(item, 'USD'));
  const all = Array.from(categories.values());
  const visible = limit ? all.slice(0, limit) : all;

  return (
    <ul className="space-y-5">
      {visible.map((item) => {
        const currencies = [
          item.hnl > 0
            ? {
                currency: 'HNL' as const,
                amount: item.hnl,
                share: hnlTotal > 0 ? (item.hnl / hnlTotal) * 100 : 0,
              }
            : null,
          item.usd > 0
            ? {
                currency: 'USD' as const,
                amount: item.usd,
                share: usdTotal > 0 ? (item.usd / usdTotal) * 100 : 0,
              }
            : null,
        ].filter(
          (entry): entry is { currency: Currency; amount: number; share: number } => entry !== null,
        );

        return (
          <li key={item.key}>
            <div className="mb-2 flex items-center gap-3">
              <CategoryIcon icon={item.icon} color={item.color} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
              <div className="shrink-0 text-right">
                {currencies.map((entry) => (
                  <p key={entry.currency} className="text-sm font-semibold tabular-nums">
                    {formatMoney(entry.amount, entry.currency)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      · {formatPercent(entry.share)} {entry.currency}
                    </span>
                  </p>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 pl-11">
              {currencies.map((entry) => (
                <div key={entry.currency} className="grid grid-cols-[2rem_1fr] items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {entry.currency}
                  </span>
                  <ProgressBar value={entry.share} color={item.color} />
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
