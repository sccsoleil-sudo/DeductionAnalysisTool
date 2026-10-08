import * as XLSX from 'xlsx';
import { CODIFICATION } from '../config/codification';
import {
  classify,
  divisionFor,
  isAmazonRow,
  isExcludedCode,
  normalizeCode,
  penaltyLookupCode,
} from './classify';
import type { ClaimRow, ParseResult, ParseWarning } from './types';

/** A sheet must carry all of these to be treated as data rather than a pivot/scratch tab. */
const REQUIRED_COLUMNS = [
  'Reason Code',
  'Amount (CoCode Crcy)',
  'Customer Name',
  'Journal Entry Date',
];

const KEY_COLUMNS = [
  'Customer Name',
  'Assignment',
  'Payment Reference',
  'Reference',
  'Reason Code',
  'Journal Entry',
  'Amount (CoCode Crcy)',
];

type RawRow = Record<string, unknown>;

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = text(value).replace(/[\s,]/g, '').replace(/^\((.*)\)$/, '-$1');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // Excel serial date (days since 1899-12-30).
  if (typeof value === 'number') {
    if (value < 1 || value > 200000) return null;
    // Excel serials are calendar dates. Build a local date from the UTC day so
    // US time zones do not shift the claim date back by one day.
    const utc = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (Number.isNaN(utc.getTime())) return null;
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  }
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Header names are trimmed but otherwise matched exactly, per the codification book. */
function normalizeHeaders(rows: RawRow[]): RawRow[] {
  return rows.map((row) => {
    const out: RawRow = {};
    for (const [key, value] of Object.entries(row)) {
      out[key.trim()] = value;
    }
    return out;
  });
}

function buildKey(row: RawRow): string {
  return KEY_COLUMNS.map((c) => text(row[c])).join('|');
}

export function isBaselineFilename(fileName: string): boolean {
  const stem = fileName.replace(/\.[^.]+$/, '');
  return stem.replace(/[^a-z0-9]/gi, '').toLowerCase() === CODIFICATION.autoBaselineFilename;
}

/**
 * Some exports declare a used range thousands of columns wide (a stray formatted cell far to the
 * right). Reading that range expands every row to that width and exhausts browser memory, so
 * shrink the range to the cells that actually hold a value.
 */
function trimSheetRange(sheet: XLSX.WorkSheet): void {
  const data = (sheet as unknown as { '!data'?: Array<Array<{ v?: unknown } | undefined> | undefined> })['!data'];
  if (!data) return;
  let lastRow = -1;
  let lastCol = -1;
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r];
    if (!row) continue;
    row.forEach((cell, c) => {
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        if (c > lastCol) lastCol = c;
        lastRow = r;
      }
    });
  }
  if (lastRow < 0 || lastCol < 0) return;
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });
}

export function parseWorkbookBuffer(buffer: ArrayBuffer, fileName: string): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', dense: true, cellDates: false, cellNF: false, cellStyles: false });

  const warnings: ParseWarning[] = [];
  const sheetsUsed: string[] = [];
  const sheetsSkipped: string[] = [];
  const rows: ClaimRow[] = [];

  const seenKeys = new Map<string, number>();
  let unparseableDates = 0;
  let unknownReasonCodes = 0;
  const unknownReasonSamples = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    trimSheetRange(sheet);

    const raw = normalizeHeaders(
      XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: true }),
    );

    if (raw.length === 0) {
      sheetsSkipped.push(`${sheetName} (empty)`);
      continue;
    }

    const headers = new Set(Object.keys(raw[0]));
    const missing = REQUIRED_COLUMNS.filter((c) => !headers.has(c));
    if (missing.length > 0) {
      sheetsSkipped.push(`${sheetName} (missing ${missing.join(', ')})`);
      continue;
    }

    sheetsUsed.push(sheetName);

    for (const rawRow of raw) {
      const reasonCode = normalizeCode(rawRow['Reason Code']);
      if (!reasonCode) continue;

      const refKey2 = normalizeCode(rawRow['Reference Key 2']);
      const businessArea = normalizeCode(rawRow['Business Area']);
      const clearingJournalEntry = text(rawRow['Clearing Journal Entry']);
      const clearingDate = toDate(rawRow['Clearing Date']);
      const journalEntryDate = toDate(rawRow['Journal Entry Date']);

      // Closed when either a Clearing Date or a Clearing Journal Entry is present.
      const isOpen = clearingDate === null && clearingJournalEntry === '';

      if (journalEntryDate === null) unparseableDates += 1;

      const known = Object.values(CODIFICATION.reasonCodes) as string[];
      if (!known.includes(reasonCode)) {
        unknownReasonCodes += 1;
        if (unknownReasonSamples.size < 5) unknownReasonSamples.add(reasonCode);
        continue;
      }

      const customerName = text(rawRow['Customer Name']);
      const assignment = text(rawRow['Assignment']);
      const customerNumber = text(rawRow['Customer']);
      const itemText = text(rawRow['Item Text']);
      const lookupCode =
        reasonCode === CODIFICATION.reasonCodes.penalty
          ? penaltyLookupCode(refKey2, itemText)
          : refKey2;

      let key = buildKey(rawRow);
      const seen = seenKeys.get(key);
      if (seen === undefined) {
        seenKeys.set(key, 1);
      } else {
        seenKeys.set(key, seen + 1);
        key = `${key}#${seen}`;
      }

      rows.push({
        key,
        sheet: sheetName,
        customerName,
        customerNumber,
        assignment,
        paymentReference: text(rawRow['Payment Reference']),
        invoiceReference: text(rawRow['Reference'] ?? rawRow['Invoice Reference']),
        journalEntry: text(rawRow['Journal Entry']),
        itemText,
        disputeReason: text(rawRow['Dispute Reason']),
        disputeStatus: normalizeCode(rawRow['Dispute Status']),
        reasonCode,
        refKey2,
        businessArea,
        division: divisionFor(businessArea),
        amount: num(rawRow['Amount (CoCode Crcy)']),
        journalEntryDate,
        clearingDate,
        clearingJournalEntry,
        isOpen,
        isExcluded: isExcludedCode(lookupCode),
        isAmazon: isAmazonRow(customerName.toUpperCase(), assignment, customerNumber),
        outcome: classify(reasonCode, refKey2, isOpen, itemText),
      });
    }
  }

  if (rows.length === 0) {
    warnings.push({
      level: 'error',
      message: `No usable rows found. Every sheet must contain the columns: ${REQUIRED_COLUMNS.join(', ')}.`,
    });
  }
  if (sheetsSkipped.length > 0) {
    warnings.push({
      level: 'info',
      message: `Skipped ${sheetsSkipped.length} non-data sheet(s): ${sheetsSkipped.join('; ')}.`,
    });
  }
  if (rows.length > 0) {
    warnings.push({
      level: 'info',
      message:
        'Closed means a Clearing Date or a Clearing Journal Entry is present. Both blank means open.',
    });
  }
  if (unparseableDates > 0) {
    warnings.push({
      level: 'warning',
      message: `${unparseableDates.toLocaleString()} row(s) have an unreadable Claim Date (Journal Entry Date) and are excluded from period views.`,
    });
  }
  if (unknownReasonCodes > 0) {
    warnings.push({
      level: 'warning',
      message: `${unknownReasonCodes.toLocaleString()} row(s) dropped: Reason Code not in ${Object.values(
        CODIFICATION.reasonCodes,
      ).join('/')} (e.g. ${[...unknownReasonSamples].join(', ')}).`,
    });
  }
  const duplicates = [...seenKeys.values()].filter((n) => n > 1).length;
  if (duplicates > 0) {
    warnings.push({
      level: 'info',
      message: `${duplicates.toLocaleString()} business key(s) appear more than once; each occurrence is kept as its own line.`,
    });
  }

  return {
    rows,
    fileName,
    sheetsUsed,
    sheetsSkipped,
    warnings,
    openClosedSource: rows.length > 0 ? 'Clearing Date / Clearing Journal Entry' : 'none',
  };
}

export async function parseWorkbook(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  return parseWorkbookBuffer(buffer, file.name);
}
