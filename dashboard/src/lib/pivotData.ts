import { formatDateGranularity, isoDate } from './format';
import type { ClaimRow } from './types';

export const PIVOT_ATTRIBUTES = [
  'Division',
  'Customer',
  'Reason Code',
  'Reference Key 2',
  'Outcome',
  'Amount',
  'Claim Date',
  'Claim Month',
  'Claim Quarter',
  'Claim Year',
  'Clearing Date',
  'Dispute Status',
  'Business Area',
  'Status',
  'Sheet',
  'Amazon',
  'Excluded',
  'Customer Number',
] as const;

export type PivotAttribute = (typeof PIVOT_ATTRIBUTES)[number];

/** 2D array for react-pivottable — header row first. */
export function buildPivotData(rows: ClaimRow[]): (string | number)[][] {
  const body = rows.map((row) => [
    row.division,
    row.customerName,
    row.reasonCode,
    row.refKey2 || '(blank)',
    row.outcome,
    row.amount,
    formatDateGranularity(row.journalEntryDate, 'date'),
    formatDateGranularity(row.journalEntryDate, 'month'),
    formatDateGranularity(row.journalEntryDate, 'quarter'),
    formatDateGranularity(row.journalEntryDate, 'year'),
    row.clearingDate ? isoDate(row.clearingDate) : '',
    row.disputeStatus || '(blank)',
    row.businessArea || '(blank)',
    row.isOpen ? 'Open' : 'Closed',
    row.sheet,
    row.isAmazon ? 'Yes' : 'No',
    row.isExcluded ? 'Yes' : 'No',
    row.customerNumber,
  ]);
  return [[...PIVOT_ATTRIBUTES], ...body];
}
