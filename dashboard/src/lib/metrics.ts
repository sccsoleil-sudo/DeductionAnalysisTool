import {
  CODIFICATION,
  DIVISION_ORDER,
  PENALTY_CATEGORY_ORDER,
  UNCLASSIFIED,
  UNKNOWN_DIVISION,
} from '../config/codification';
import { disputeLabelFor, openBucketFor } from './classify';
import type { ClaimRow, NamedTotal, PeriodTotals } from './types';

export type PeriodBasis = 'journal' | 'clearing';

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export interface Filters {
  divisions: string[];
  customers: string[];
  basis: PeriodBasis;
  asOf: Date;
  /** Calendar months included in analysis (0 = Jan … 11 = Dec). */
  months: number[];
}

/** Default YTD month selection: January through the as-of month. */
export function defaultMonths(asOf: Date): number[] {
  return Array.from({ length: asOf.getMonth() + 1 }, (_, i) => i);
}

export function isYtdMonthSelection(months: number[], asOf: Date): boolean {
  const expected = defaultMonths(asOf);
  if (months.length !== expected.length) return false;
  return expected.every((m, i) => months[i] === m);
}

/** Human label for charts, e.g. "2026 YTD" or "2026 Jan–Aug" or "2026 (Mar, Jun)". */
export function yearPeriodLabel(year: number, filters: Filters): string {
  const sorted = [...filters.months].sort((a, b) => a - b);
  if (sorted.length === 0) return String(year);
  if (sorted.length === 12) return String(year);
  if (isYtdMonthSelection(sorted, filters.asOf) && year === filters.asOf.getFullYear()) {
    return `${year} YTD`;
  }
  if (year === filters.asOf.getFullYear() - 1 && isYtdMonthSelection(sorted, filters.asOf)) {
    return `${year} YTD`;
  }
  const contiguous = sorted.every((m, i) => i === 0 || m === sorted[i - 1]! + 1);
  if (contiguous) {
    return `${year} ${MONTH_LABELS[sorted[0]!]}–${MONTH_LABELS[sorted[sorted.length - 1]!]}`;
  }
  return `${year} (${sorted.map((m) => MONTH_LABELS[m]).join(', ')})`;
}

export function periodRangeLabel(filters: Filters): string {
  const sorted = [...filters.months].sort((a, b) => a - b);
  if (sorted.length === 12) return 'Full calendar year';
  if (isYtdMonthSelection(sorted, filters.asOf)) {
    return `Jan 1 → ${MONTH_LABELS[filters.asOf.getMonth()]} ${filters.asOf.getDate()}`;
  }
  if (sorted.every((m, i) => i === 0 || m === sorted[i - 1]! + 1)) {
    return `${MONTH_LABELS[sorted[0]!]}–${MONTH_LABELS[sorted[sorted.length - 1]!]}`;
  }
  return sorted.map((m) => MONTH_LABELS[m]).join(', ');
}

export function sum<T>(items: T[], pick: (item: T) => number): number;
export function sum(items: ClaimRow[]): number;
export function sum<T>(items: T[], pick?: (item: T) => number): number {
  const get = pick ?? ((item: T) => (item as unknown as ClaimRow).amount);
  let total = 0;
  for (const item of items) total += get(item);
  return total;
}

export function latestJournalDate(rows: ClaimRow[]): Date {
  let max = 0;
  for (const row of rows) {
    const t = row.journalEntryDate?.getTime();
    if (t !== undefined && t > max) max = t;
  }
  return max > 0 ? new Date(max) : new Date();
}

function dateFor(row: ClaimRow, basis: PeriodBasis): Date | null {
  return basis === 'clearing' ? row.clearingDate : row.journalEntryDate;
}

/** Jan 1 through the same month/day as `asOf`, for the given year. */
export function ytdWindow(asOf: Date, year: number): { start: Date; end: Date } {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, asOf.getMonth(), asOf.getDate(), 23, 59, 59, 999);
  return { start, end };
}

/**
 * Whether a row falls in the analysis window for a given year.
 * Month must be selected; the as-of month is capped at the as-of day for YTD parity.
 */
export function inPeriod(row: ClaimRow, filters: Filters, year: number): boolean {
  const d = dateFor(row, filters.basis);
  if (!d || d.getFullYear() !== year) return false;
  if (!filters.months.includes(d.getMonth())) return false;

  const capMonth = filters.asOf.getMonth();
  if (d.getMonth() === capMonth) {
    const cap = new Date(year, capMonth, filters.asOf.getDate(), 23, 59, 59, 999);
    return d <= cap;
  }
  return true;
}

/** @deprecated Use inPeriod — kept for the Node verify script. */
export function inYtd(row: ClaimRow, asOf: Date, year: number, basis: PeriodBasis): boolean {
  return inPeriod(row, { divisions: [], customers: [], basis, asOf, months: defaultMonths(asOf) }, year);
}

export function applyFilters(rows: ClaimRow[], filters: Filters): ClaimRow[] {
  const divisions = new Set(filters.divisions);
  const customers = new Set(filters.customers);
  return rows.filter((row) => {
    if (divisions.size > 0 && !divisions.has(row.division)) return false;
    if (customers.size > 0 && !customers.has(row.customerName)) return false;
    return true;
  });
}

/**
 * Open AR balance: booked on or before `asOf` and not yet cleared as of that date.
 * Uses Clearing Date so prior-year balances are a true point-in-time snapshot
 * rather than today's open items filtered by year.
 */
export function openArBalance(rows: ClaimRow[], asOf: Date): number {
  let total = 0;
  for (const row of rows) {
    if (row.isExcluded) continue;
    const booked = row.journalEntryDate;
    if (!booked || booked > asOf) continue;
    const cleared = row.clearingDate;
    if (cleared && cleared <= asOf) continue;
    if (!cleared && !row.isOpen) continue;
    total += row.amount;
  }
  return total;
}

export function periodTotals(
  allRows: ClaimRow[],
  filters: Filters,
  year: number,
): PeriodTotals {
  const windowRows = allRows.filter((r) => inPeriod(r, filters, year));
  const included = windowRows.filter((r) => !r.isExcluded);

  const byOutcome = (test: (o: string) => boolean) =>
    sum(included.filter((r) => test(r.outcome)));

  const recovered = byOutcome((o) => o === 'Recovered');
  const comWriteOff = byOutcome((o) => o === 'COM Write-Off');
  const plainWriteOff = byOutcome((o) => o === 'Write-Off');
  const writeOffTotal = comWriteOff + plainWriteOff;
  const refuseToPay = byOutcome((o) => o === 'Refuse to Pay');
  const actualShortage = byOutcome((o) => o === 'Actual Shortage');
  const openInPeriod = byOutcome((o) => o === 'Open');
  const unclassified = byOutcome((o) => o === UNCLASSIFIED);

  const closedUniverse = recovered + writeOffTotal + refuseToPay + actualShortage;
  const snapshot = new Date(
    year,
    filters.asOf.getMonth(),
    filters.asOf.getDate(),
    23,
    59,
    59,
    999,
  );

  return {
    deductionsReceived: sum(included),
    recovered,
    writeOffTotal,
    comWriteOff,
    plainWriteOff,
    refuseToPay,
    actualShortage,
    openInPeriod,
    unclassified,
    excluded: sum(windowRows.filter((r) => r.isExcluded)),
    recoveryRate: closedUniverse === 0 ? 0 : (recovered / closedUniverse) * 100,
    openArBalance: openArBalance(allRows, snapshot),
    rowCount: included.length,
  };
}

function aggregate(
  rows: ClaimRow[],
  keyOf: (r: ClaimRow) => string,
  order?: string[],
): NamedTotal[] {
  const map = new Map<string, NamedTotal>();
  for (const row of rows) {
    const name = keyOf(row);
    const entry = map.get(name) ?? { name, value: 0, count: 0 };
    entry.value += row.amount;
    entry.count += 1;
    map.set(name, entry);
  }
  if (order) {
    const ordered = order.filter((n) => map.has(n)).map((n) => map.get(n)!);
    const extras = [...map.values()].filter((e) => !order.includes(e.name));
    return [...ordered, ...extras.sort((a, b) => b.value - a.value)];
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export function byDivision(rows: ClaimRow[]): NamedTotal[] {
  return aggregate(
    rows.filter((r) => !r.isExcluded),
    (r) => r.division,
    [...DIVISION_ORDER, UNKNOWN_DIVISION],
  );
}

export function byPenaltyCategory(rows: ClaimRow[]): NamedTotal[] {
  const closed = rows.filter(
    (r) => !r.isExcluded && !r.isOpen && r.reasonCode === CODIFICATION.reasonCodes.penalty,
  );
  return aggregate(closed, (r) => r.outcome, PENALTY_CATEGORY_ORDER);
}

export function byCustomer(rows: ClaimRow[], limit = 5): NamedTotal[] {
  return aggregate(
    rows.filter((r) => !r.isExcluded),
    (r) => r.customerName,
  ).slice(0, limit);
}

export function byOutcome(rows: ClaimRow[]): NamedTotal[] {
  return aggregate(
    rows.filter((r) => !r.isExcluded),
    (r) => r.outcome,
  );
}

export function byDisputeStatus(rows: ClaimRow[]): NamedTotal[] {
  return aggregate(
    rows.filter((r) => !r.isExcluded && r.isOpen),
    (r) => disputeLabelFor(r.disputeStatus),
  );
}

export function byOpenBucket(rows: ClaimRow[]): NamedTotal[] {
  return aggregate(
    rows.filter((r) => !r.isExcluded && r.isOpen),
    (r) => openBucketFor(r.refKey2, r.disputeStatus),
    ['Potential Lost', 'Recoverable', 'Pending - In Analysis'],
  );
}

/** Monthly deduction totals for the given year, indexed Jan..Dec. Unselected months are zero. */
export function monthlySeries(rows: ClaimRow[], year: number, filters: Filters): number[] {
  const months = new Array(12).fill(0);
  for (const row of rows) {
    if (row.isExcluded) continue;
    const d = dateFor(row, filters.basis);
    if (!d || d.getFullYear() !== year) continue;
    if (!filters.months.includes(d.getMonth())) continue;
    months[d.getMonth()] += row.amount;
  }
  return months;
}

export interface CustomerComparison {
  name: string;
  current: number;
  previous: number;
  delta: number;
}

export function customerComparison(
  rows: ClaimRow[],
  filters: Filters,
  currentYear: number,
  limit = 8,
): CustomerComparison[] {
  const current = new Map<string, number>();
  const previous = new Map<string, number>();

  for (const row of rows) {
    if (row.isExcluded) continue;
    if (inPeriod(row, filters, currentYear)) {
      current.set(row.customerName, (current.get(row.customerName) ?? 0) + row.amount);
    } else if (inPeriod(row, filters, currentYear - 1)) {
      previous.set(row.customerName, (previous.get(row.customerName) ?? 0) + row.amount);
    }
  }

  const names = new Set([...current.keys(), ...previous.keys()]);
  return [...names]
    .map((name) => {
      const c = current.get(name) ?? 0;
      const p = previous.get(name) ?? 0;
      return { name, current: c, previous: p, delta: c - p };
    })
    .sort((a, b) => Math.abs(b.current) - Math.abs(a.current))
    .slice(0, limit);
}

export function distinctValues(rows: ClaimRow[], pick: (r: ClaimRow) => string): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const value = pick(row);
    if (value) set.add(value);
  }
  return [...set].sort();
}

/** R17 Amazon potential shortage — supplemental card, never part of R02 totals. */
export function amazonPotentialShortage(
  allRows: ClaimRow[],
  filters: Filters,
  year: number,
): { total: number; count: number } {
  const rows = allRows.filter(
    (r) =>
      r.reasonCode === CODIFICATION.reasonCodes.amazonPotential &&
      r.isAmazon &&
      !r.isExcluded &&
      inPeriod(r, filters, year),
  );
  return { total: sum(rows), count: rows.length };
}
