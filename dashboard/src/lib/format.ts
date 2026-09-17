const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

const currencyPrecise = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: number): string {
  return currency.format(value);
}

export function moneyPrecise(value: number): string {
  return currencyPrecise.format(value);
}

/** Chart axis / KPI headline formatting: $1.2M, $340K. */
export function compactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function percent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function count(value: number): string {
  return value.toLocaleString('en-CA');
}

export function isoDate(date: Date | null): string {
  if (!date) return '—';
  return date.toISOString().slice(0, 10);
}

export type DateGranularity = 'date' | 'month' | 'quarter' | 'year';

/** Format a date for pivot grouping — lexicographically sortable strings. */
export function formatDateGranularity(date: Date | null, granularity: DateGranularity): string {
  if (!date) return '';
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  if (granularity === 'year') return String(y);
  if (granularity === 'quarter') return `${y}-Q${Math.ceil(m / 3)}`;
  if (granularity === 'month') return `${y}-${String(m).padStart(2, '0')}`;
  return isoDate(date);
}

export function longDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Year-over-year change, guarding against a zero or sign-flipped base. */
export function variance(current: number, previous: number): { text: string; direction: 'up' | 'down' | 'flat' } {
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return { text: 'no change', direction: 'flat' };
  const direction = delta > 0 ? 'up' : 'down';
  if (previous === 0) return { text: `${compactMoney(delta)} vs nil`, direction };
  const pct = (delta / Math.abs(previous)) * 100;
  return { text: `${delta > 0 ? '+' : ''}${pct.toFixed(1)}% (${compactMoney(delta)})`, direction };
}
