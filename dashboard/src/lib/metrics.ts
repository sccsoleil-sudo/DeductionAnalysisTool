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

export interface Filters {
  divisions: string[];
  customers: string[];
  basis: PeriodBasis;
  asOf: Date;
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

export function inYtd(row: ClaimRow, asOf: Date, year: number, basis: PeriodBasis): boolean {
  const d = dateFor(row, basis);
  if (!d) return false;
  const { start, end } = ytdWindow(asOf, year);
  return d >= start && d <= end;
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
  asOf: Date,
  year: number,
  basis: PeriodBasis,
): PeriodTotals {
  const windowRows = allRows.filter((r) => inYtd(r, asOf, year, basis));
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
  const snapshot = new Date(year, asOf.getMonth(), asOf.getDate(), 23, 59, 59, 999);

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

/** Monthly deduction totals for the given year, indexed Jan..Dec. */
export function monthlySeries(
  rows: ClaimRow[],
  year: number,
  basis: PeriodBasis,
): number[] {
  const months = new Array(12).fill(0);
  for (const row of rows) {
    if (row.isExcluded) continue;
    const d = dateFor(row, basis);
    if (!d || d.getFullYear() !== year) continue;
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
  asOf: Date,
  currentYear: number,
  basis: PeriodBasis,
  limit = 8,
): CustomerComparison[] {
  const current = new Map<string, number>();
  const previous = new Map<string, number>();

  for (const row of rows) {
    if (row.isExcluded) continue;
    if (inYtd(row, asOf, currentYear, basis)) {
      current.set(row.customerName, (current.get(row.customerName) ?? 0) + row.amount);
    } else if (inYtd(row, asOf, currentYear - 1, basis)) {
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
  asOf: Date,
  year: number,
  basis: PeriodBasis,
): { total: number; count: number } {
  const rows = allRows.filter(
    (r) =>
      r.reasonCode === CODIFICATION.reasonCodes.amazonPotential &&
      r.isAmazon &&
      !r.isExcluded &&
      inYtd(r, asOf, year, basis),
  );
  return { total: sum(rows), count: rows.length };
}
