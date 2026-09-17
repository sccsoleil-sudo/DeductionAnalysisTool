export type Outcome =
  | 'Open'
  | 'Recovered'
  | 'Write-Off'
  | 'COM Write-Off'
  | 'Refuse to Pay'
  | 'Actual Shortage'
  | 'Excluded'
  | 'Unclassified'
  | string; // R16 penalty category labels

export interface ClaimRow {
  key: string;
  sheet: string;
  customerName: string;
  customerNumber: string;
  assignment: string;
  paymentReference: string;
  invoiceReference: string;
  journalEntry: string;
  itemText: string;
  disputeReason: string;
  disputeStatus: string;
  reasonCode: string;
  refKey2: string;
  businessArea: string;
  division: string;
  amount: number;
  journalEntryDate: Date | null;
  clearingDate: Date | null;
  clearingJournalEntry: string;
  isOpen: boolean;
  isExcluded: boolean;
  isAmazon: boolean;
  outcome: Outcome;
}

export interface ParseWarning {
  level: 'error' | 'warning' | 'info';
  message: string;
}

export interface ParseResult {
  rows: ClaimRow[];
  fileName: string;
  sheetsUsed: string[];
  sheetsSkipped: string[];
  warnings: ParseWarning[];
  openClosedSource: 'Clearing Status' | 'Clearing Date / Clearing Journal Entry' | 'none';
}

export interface PeriodTotals {
  deductionsReceived: number;
  recovered: number;
  writeOffTotal: number;
  /** Cleared COM WO codes. */
  comWriteOff: number;
  /** Cleared codes containing WO but not COM-prefixed. */
  plainWriteOff: number;
  /** COM* without WO that has a Clearing Date — included in Lost (writeOffTotal). */
  refuseToPay: number;
  actualShortage: number;
  openInPeriod: number;
  unclassified: number;
  excluded: number;
  recoveryRate: number;
  openArBalance: number;
  rowCount: number;
}

export interface NamedTotal {
  name: string;
  value: number;
  count: number;
}

export interface BaselineDiff {
  added: number;
  updated: number;
  removed: number;
  baselineName: string;
  baselineDate: string;
}
