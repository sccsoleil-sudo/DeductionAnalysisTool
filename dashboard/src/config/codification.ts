/**
 * Single source of truth for L'Oreal Logistics codification rules.
 *
 * Finance owns these values. Changing a code here changes the whole dashboard —
 * no other file hard-codes a business code.
 */

export interface PenaltyCategory {
  code: string;
  label: string;
}

export const CODIFICATION = {
  reasonCodes: {
    shortage: 'R02',
    penalty: 'R16',
    amazonPotential: 'R17',
  },

  /**
   * Reference Key 2 values dropped from every KPI, chart and table.
   * PMT = SAP payment offset (exact). Any code containing XX (e.g. XXX, XXXX, XXXXX).
   * Their totals are surfaced separately as an "excluded" footnote.
   */
  excludedRefKey2Exact: ['PMT'] as const,
  /** Substrings — Ref Key 2 containing any of these is excluded (*XX*). */
  excludedRefKey2Contains: ['XX'] as const,

  /** Closed items carrying these codes count as money recovered. Blank = Payback. */
  recoveredRefKey2: ['', 'PAYBACK', 'RET', 'RT', 'R1R2'],

  /** Substring marking an internal write-off, e.g. WO, WO01, COM WO. */
  writeOffContains: 'WO',

  /** Prefix marking a customer refusal to pay, e.g. COM, COMM, COM01. */
  refuseToPayPrefix: 'COM',

  /** Confirmed physical shortage — reserved separately from write-offs. */
  actualShortageCode: 'SHO',

  /** R16 penalty buckets, in the fixed business-priority display order. */
  penaltyCategories: [
    { code: 'FR', label: 'Fill Rate' },
    { code: 'EDI', label: 'EDI' },
    { code: 'PREP', label: 'DC Charges' },
    { code: 'SHIP', label: 'Delivery' },
    { code: 'KAM', label: 'Commercial' },
  ] as PenaltyCategory[],

  divisions: {
    '02AA': 'CPD',
    '02AB': 'PPD',
    '02AC': 'LPD',
    '02AD': 'LDB',
  } as Record<string, string>,

  amazon: {
    nameContains: 'AMAZON',
    customerNumbers: ['10118507'],
  },

  /** Raw SAP dispute status -> label shown to management. */
  disputeStatusLabels: {
    'NOT JUSTIFIED': 'To Be Paid',
    'UNDER REVIEW': 'With Client',
    NEW: 'To Analyze (Internal)',
    CLOSED: 'Closed',
  } as Record<string, string>,

  /** Open R02 items in these dispute statuses are considered recoverable. */
  recoverableDisputeStatuses: ['UNDER REVIEW', 'NOT JUSTIFIED'],

  /** Uploading a file whose alphanumeric name matches this becomes the baseline. */
  autoBaselineFilename: 'logisticsmasterv1',
} as const;

export const UNCLASSIFIED = 'Unclassified';
export const UNKNOWN_DIVISION = 'Unknown';

/** Human-readable exclusion rule for footnotes (e.g. "PMT, *XX*"). */
export function excludedCodesLabel(): string {
  const exact = [...CODIFICATION.excludedRefKey2Exact];
  const patterns = CODIFICATION.excludedRefKey2Contains.map((s) => `*${s}*`);
  return [...exact, ...patterns].join(', ');
}

export const DIVISION_ORDER = Object.values(CODIFICATION.divisions);

export const PENALTY_CATEGORY_ORDER = [
  ...CODIFICATION.penaltyCategories.map((c) => c.label),
  UNCLASSIFIED,
];
