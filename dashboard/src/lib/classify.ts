import { CODIFICATION, UNCLASSIFIED, UNKNOWN_DIVISION } from '../config/codification';
import type { Outcome } from './types';

/** Uppercase, trim, and collapse internal whitespace so "com  wo" matches "COM WO". */
export function normalizeCode(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase().replace(/\s+/g, ' ');
}

export function isExcludedCode(refKey2: string): boolean {
  if ((CODIFICATION.excludedRefKey2Exact as readonly string[]).includes(refKey2)) return true;
  return CODIFICATION.excludedRefKey2Contains.some((part) => refKey2.includes(part));
}

export function divisionFor(businessArea: string): string {
  return CODIFICATION.divisions[businessArea] ?? UNKNOWN_DIVISION;
}

export function isAmazonRow(customerName: string, assignment: string, customerNumber: string): boolean {
  if (customerName.includes(CODIFICATION.amazon.nameContains)) return true;
  return CODIFICATION.amazon.customerNumbers.some(
    (num) => assignment.includes(num) || customerNumber.includes(num),
  );
}

const penaltyByCode = new Map(CODIFICATION.penaltyCategories.map((c) => [c.code, c.label]));

/** First token of Item Text (text before the first space), normalized like a code. */
export function firstWord(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return normalizeCode(trimmed.split(/\s+/, 1)[0] ?? '');
}

/**
 * Code used to classify an R16 row. Blank Reference Key 2 falls back to the
 * first word of Item Text (e.g. "FR late fill" → FR).
 */
export function penaltyLookupCode(refKey2: string, itemText = ''): string {
  return refKey2.trim() === '' ? firstWord(itemText) : refKey2;
}

/** Penalty category from the lookup code. Cleared COM / COM WO / WO COM → Refused. */
export function penaltyCategoryFromRefKey2(refKey2: string, itemText = ''): string {
  const code = penaltyLookupCode(refKey2, itemText);
  if (isExcludedCode(code)) return 'Excluded';
  if ((CODIFICATION.recoveredRefKey2 as readonly string[]).includes(code)) return 'Recovered';
  if (code.includes(CODIFICATION.refuseToPayPrefix)) return 'Refused';
  if (code.includes(CODIFICATION.writeOffContains)) return 'Write-off';
  return penaltyByCode.get(code) ?? UNCLASSIFIED;
}

/**
 * Outcome for a shortage (R02/R17) row.
 *
 * Follows the Section 7 decision tree, with one refinement: write-off is tested
 * before the COM prefix so that "COM WO" lands in its own bucket. Both are Lost
 * either way, so totals are unchanged — it only lets the Lost KPI separate the
 * COM portion, which Finance asked to see called out.
 */
export function classifyShortage(refKey2: string, isOpen: boolean): Outcome {
  if (isExcludedCode(refKey2)) return 'Excluded';
  // SHO is an actual shortage whether or not the line is cleared yet.
  if (refKey2 === CODIFICATION.actualShortageCode) return 'SHO';
  if (isOpen) return 'Open';
  if ((CODIFICATION.recoveredRefKey2 as readonly string[]).includes(refKey2)) return 'Recovered';
  if (CODIFICATION.shortageRecoveredContains.some((part) => refKey2.includes(part))) return 'Recovered';
  // Cleared COM, COM WO, and WO COM are Refused. Plain WO is Write-off. SHO stays its own bucket.
  if (refKey2.includes(CODIFICATION.refuseToPayPrefix)) return 'Refused';
  if (refKey2.includes(CODIFICATION.writeOffContains)) return 'Write-off';
  return UNCLASSIFIED;
}

/** Outcome for a penalty (R16) row — open still tracked as Open for status views. */
export function classifyPenalty(refKey2: string, isOpen: boolean, itemText = ''): Outcome {
  const code = penaltyLookupCode(refKey2, itemText);
  if (isExcludedCode(code)) return 'Excluded';
  if (isOpen) return 'Open';
  return penaltyCategoryFromRefKey2(code);
}

export function classify(
  reasonCode: string,
  refKey2: string,
  isOpen: boolean,
  itemText = '',
): Outcome {
  return reasonCode === CODIFICATION.reasonCodes.penalty
    ? classifyPenalty(refKey2, isOpen, itemText)
    : classifyShortage(refKey2, isOpen);
}

/** Label used when an open shortage line is drawn on the combined outcome chart. */
export function openChartBucket(refKey2: string): 'Potential Lost' | 'With Client' {
  return refKey2.includes('COM') ? 'Potential Lost' : 'With Client';
}
