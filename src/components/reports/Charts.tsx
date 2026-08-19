import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/utils/format';

const AXIS_COLOR = '#94a3b8';
const GRID_COLOR = 'rgba(148, 163, 184, 0.2)';
const INCOME_COLOR = '#10b981';
const EXPENSE_COLOR = '#ef4444';
const PRIMARY_COLOR = '#0d9488';

const currencyTick = (value: number) => {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
};

const tooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  color: 'var(--foreground)',
  fontSize: '0.8rem',
};

export interface PieDatum {
  name: string;
  value: number;
  color: string;
}

export function CategoryPieChart({ data }: { data: PieDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: '0.8rem', color: AXIS_COLOR }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export interface MonthDatum {
  label: string;
  income: number;
  expense: number;
  balance: number;
}

export function IncomeExpenseBarChart({ data }: { data: MonthDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS_COLOR, fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: 12 }}
          tickFormatter={currencyTick}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: GRID_COLOR }}
          formatter={(value, name) => [
            formatCurrency(Number(value)),
            name === 'income' ? 'Ingresos' : 'Gastos',
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: '0.8rem' }}
          formatter={(value) => (value === 'income' ? 'Ingresos' : 'Gastos')}
        />
        <Bar dataKey="income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BalanceLineChart({ data }: { data: MonthDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS_COLOR, fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: 12 }}
          tickFormatter={currencyTick}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [formatCurrency(Number(value)), 'Balance']}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke={PRIMARY_COLOR}
          strokeWidth={2.5}
          dot={{ r: 3, fill: PRIMARY_COLOR }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
