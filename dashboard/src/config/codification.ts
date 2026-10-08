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
  /** Shortage only: Reference Key 2 containing any of these is Recovered (e.g. APPROVED). */
  shortageRecoveredContains: ['APPROVED'] as const,

  /** Substring marking an internal write-off, e.g. WO, WO01, COM WO. */
  writeOffContains: 'WO',

  /** Substring marking a cleared Refused line: COM, COM WO, or WO COM. */
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

  /**
   * Workbook in the Deduction Management SharePoint folder.
   * A bookmark can override the name with ?sp=FileName.xlsx.
   */
  sharePointWorkbookFile: 'Logistics master data.xlsx',

  /**
   * When true, a copy of the dashboard opened from SharePoint reads the workbook by itself.
   * Off by default: the workbook is only read from SharePoint when you click "Refresh from SharePoint".
   */
  sharePointAutoLoad: false,

  /**
   * Default recipients for the penalty key metrics email, e.g. ['name@loreal.com'].
   * Leave empty to choose recipients in the email window.
   */
  penaltyEmailRecipients: [] as string[],
  /** Folder that holds the dashboard page and the workbook. Sharing-link query parameters are not part of this path. */
  sharePointOrigin: 'https://loreal.sharepoint.com',
  sharePointFolderPath:
    '/sites/ame-canada/supplychain/Customer First/Credit Management/Deduction Management',
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
