import type { ClaimRow, ParseResult } from './types';
import type { Filters } from './metrics';
import { defaultMonths } from './metrics';

const DB_NAME = 'lmd-dashboard';
const DB_VERSION = 1;
const STORE = 'session';
const META_KEY = 'lmd.session.meta.v1';

export type TabId = 'shortage' | 'penalty' | 'quality';

/** Compact row tuple — short keys in JSON add up over tens of thousands of lines. */
type StoredRow = [
  string, // key
  string, // sheet
  string, // customerName
  string, // customerNumber
  string, // assignment
  string, // paymentReference
  string, // invoiceReference
  string, // journalEntry
  string, // itemText
  string, // disputeReason
  string, // disputeStatus
  string, // reasonCode
  string, // refKey2
  string, // businessArea
  string, // division
  number, // amount
  string | null, // journalEntryDate
  string | null, // clearingDate
  string, // clearingJournalEntry
  number, // isOpen 0|1
  number, // isExcluded 0|1
  number, // isAmazon 0|1
  string, // outcome
];

interface StoredSession {
  v: 1;
  savedAt: string;
  tab: TabId;
  filters: {
    divisions: string[];
    customers: string[];
    basis: Filters['basis'];
    asOf: string;
    months?: number[];
  };
  parse: {
    fileName: string;
    sheetsUsed: string[];
    sheetsSkipped: string[];
    warnings: ParseResult['warnings'];
    openClosedSource: ParseResult['openClosedSource'];
    rows: StoredRow[];
  };
}

export interface SessionSnapshot {
  parse: ParseResult;
  filters: Filters;
  tab: TabId;
}

function toStoredRow(row: ClaimRow): StoredRow {
  return [
    row.key,
    row.sheet,
    row.customerName,
    row.customerNumber,
    row.assignment,
    row.paymentReference,
    row.invoiceReference,
    row.journalEntry,
    row.itemText,
    row.disputeReason,
    row.disputeStatus,
    row.reasonCode,
    row.refKey2,
    row.businessArea,
    row.division,
    row.amount,
    row.journalEntryDate?.toISOString() ?? null,
    row.clearingDate?.toISOString() ?? null,
    row.clearingJournalEntry,
    row.isOpen ? 1 : 0,
    row.isExcluded ? 1 : 0,
    row.isAmazon ? 1 : 0,
    row.outcome,
  ];
}

function fromStoredRow(row: StoredRow): ClaimRow {
  return {
    key: row[0],
    sheet: row[1],
    customerName: row[2],
    customerNumber: row[3],
    assignment: row[4],
    paymentReference: row[5],
    invoiceReference: row[6],
    journalEntry: row[7],
    itemText: row[8],
    disputeReason: row[9],
    disputeStatus: row[10],
    reasonCode: row[11],
    refKey2: row[12],
    businessArea: row[13],
    division: row[14],
    amount: row[15],
    journalEntryDate: row[16] ? new Date(row[16]) : null,
    clearingDate: row[17] ? new Date(row[17]) : null,
    clearingJournalEntry: row[18],
    isOpen: row[19] === 1,
    isExcluded: row[20] === 1,
    isAmazon: row[21] === 1,
    outcome: row[22],
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open browser database.'));
  });
}

function idbGet<T>(key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut<T>(key: string, value: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE).put(value, key);
      }),
  );
}

function idbDelete(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE).delete(key);
      }),
  );
}

function toStored(session: SessionSnapshot): StoredSession {
  return {
    v: 1,
    savedAt: new Date().toISOString(),
    tab: session.tab,
    filters: {
      divisions: session.filters.divisions,
      customers: session.filters.customers,
      basis: session.filters.basis,
      asOf: session.filters.asOf.toISOString(),
      months: session.filters.months,
    },
    parse: {
      fileName: session.parse.fileName,
      sheetsUsed: session.parse.sheetsUsed,
      sheetsSkipped: session.parse.sheetsSkipped,
      warnings: session.parse.warnings,
      openClosedSource: session.parse.openClosedSource,
      rows: session.parse.rows.map(toStoredRow),
    },
  };
}

function fromStored(stored: StoredSession): SessionSnapshot {
  const asOf = new Date(stored.filters.asOf);
  return {
    tab: stored.tab,
    filters: {
      divisions: stored.filters.divisions,
      customers: stored.filters.customers,
      basis: stored.filters.basis,
      asOf,
      months: stored.filters.months ?? defaultMonths(asOf),
    },
    parse: {
      fileName: stored.parse.fileName,
      sheetsUsed: stored.parse.sheetsUsed,
      sheetsSkipped: stored.parse.sheetsSkipped,
      warnings: stored.parse.warnings,
      openClosedSource: stored.parse.openClosedSource,
      rows: stored.parse.rows.map(fromStoredRow),
    },
  };
}

/** Small pointer in localStorage so we know a session exists before opening IndexedDB. */
function writeMeta(fileName: string, rowCount: number, savedAt: string): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ fileName, rowCount, savedAt }));
  } catch {
    /* meta is optional */
  }
}

function readMeta(): { fileName: string; rowCount: number; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as { fileName: string; rowCount: number; savedAt: string }) : null;
  } catch {
    return null;
  }
}

function clearMeta(): void {
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSavedSession(): boolean {
  return readMeta() !== null;
}

export async function saveSession(session: SessionSnapshot): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload = toStored(session);
    await idbPut('current', payload);
    writeMeta(session.parse.fileName, session.parse.rows.length, payload.savedAt);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        'Could not save this dataset in the browser. It will work until you refresh, but you may need to re-upload after that.',
    };
  }
}

export async function loadSession(): Promise<SessionSnapshot | null> {
  try {
    const stored = await idbGet<StoredSession>('current');
    if (!stored || stored.v !== 1) return null;
    return fromStored(stored);
  } catch {
    clearMeta();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await idbDelete('current');
  } catch {
    /* ignore */
  }
  clearMeta();
}

export function savedSessionLabel(): string | null {
  const meta = readMeta();
  if (!meta) return null;
  return `${meta.fileName} (${meta.rowCount.toLocaleString()} rows)`;
}
