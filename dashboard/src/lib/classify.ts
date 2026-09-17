import { CODIFICATION, UNCLASSIFIED, UNKNOWN_DIVISION } from '../config/codification';
import type { Outcome } from './types';

/** Uppercase, trim, and collapse internal whitespace so "com  wo" matches "COM WO". */
export function normalizeCode(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase().replace(/\s+/g, ' ');
}

export function isExcludedCode(refKey2: string): boolean {
  return (CODIFICATION.excludedRefKey2 as readonly string[]).includes(refKey2);
}

export function divisionFor(businessArea: string): string {
  return CODIFICATION.divisions[businessArea] ?? UNKNOWN_DIVISION;
}

export function disputeLabelFor(disputeStatus: string): string {
  return CODIFICATION.disputeStatusLabels[disputeStatus] ?? UNCLASSIFIED;
}

export function isAmazonRow(customerName: string, assignment: string, customerNumber: string): boolean {
  if (customerName.includes(CODIFICATION.amazon.nameContains)) return true;
  return CODIFICATION.amazon.customerNumbers.some(
    (num) => assignment.includes(num) || customerNumber.includes(num),
  );
}

const penaltyByCode = new Map(CODIFICATION.penaltyCategories.map((c) => [c.code, c.label]));

/**
 * Outcome for a shortage (R02/R17) row.
 *
 * Follows the Section 7 decision tree, with one refinement: write-off is tested
 * before the COM prefix so that "COM WO" lands in its own bucket. Both are Lost
 * either way, so totals are unchanged — it only lets the Write-off KPI separate the
 * COM portion, which Finance asked to see called out.
 */
export function classifyShortage(refKey2: string, isOpen: boolean): Outcome {
  if (isExcludedCode(refKey2)) return 'Excluded';
  if (isOpen) return 'Open';
  if ((CODIFICATION.recoveredRefKey2 as readonly string[]).includes(refKey2)) return 'Recovered';
  if (refKey2.includes(CODIFICATION.writeOffContains)) {
    return refKey2.startsWith(CODIFICATION.refuseToPayPrefix) ? 'COM Write-Off' : 'Write-Off';
  }
  if (refKey2.startsWith(CODIFICATION.refuseToPayPrefix)) return 'Refuse to Pay';
  if (refKey2 === CODIFICATION.actualShortageCode) return 'Actual Shortage';
  return UNCLASSIFIED;
}

/** Outcome for a penalty (R16) row. Open rows are excluded from penalty analytics. */
export function classifyPenalty(refKey2: string, isOpen: boolean): Outcome {
  if (isExcludedCode(refKey2)) return 'Excluded';
  if (isOpen) return 'Open';
  if ((CODIFICATION.recoveredRefKey2 as readonly string[]).includes(refKey2)) return 'Recovered';
  if (refKey2.includes(CODIFICATION.writeOffContains)) {
    return refKey2.startsWith(CODIFICATION.refuseToPayPrefix) ? 'COM Write-Off' : 'Write-Off';
  }
  if (refKey2.startsWith(CODIFICATION.refuseToPayPrefix)) return 'Refuse to Pay';
  return penaltyByCode.get(refKey2) ?? UNCLASSIFIED;
}

export function classify(reasonCode: string, refKey2: string, isOpen: boolean): Outcome {
  return reasonCode === CODIFICATION.reasonCodes.penalty
    ? classifyPenalty(refKey2, isOpen)
    : classifyShortage(refKey2, isOpen);
}

/** Open R02 sub-bucket used by the period summary donut. */
export function openBucketFor(refKey2: string, disputeStatus: string): string {
  const isPotentialLost =
    refKey2.startsWith(CODIFICATION.refuseToPayPrefix) ||
    refKey2.includes(CODIFICATION.writeOffContains);
  if (isPotentialLost) return 'Potential Lost';
  if ((CODIFICATION.recoverableDisputeStatuses as readonly string[]).includes(disputeStatus)) {
    return 'Recoverable';
  }
  return 'Pending - In Analysis';
}
