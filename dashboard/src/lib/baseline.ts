import type { BaselineDiff, ClaimRow } from './types';

const STORAGE_KEY = 'lmd.baseline.v1';

interface StoredBaseline {
  name: string;
  savedAt: string;
  /** hashed business key -> "amount|openFlag", kept compact to fit localStorage. */
  rows: Record<string, string>;
}

function hashKey(key: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < key.length; i += 1) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 12);
}

function fingerprint(row: ClaimRow): string {
  return `${row.amount.toFixed(2)}|${row.isOpen ? 1 : 0}`;
}

function snapshotOf(rows: ClaimRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) out[hashKey(row.key)] = fingerprint(row);
  return out;
}

export function loadBaseline(): StoredBaseline | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredBaseline) : null;
  } catch {
    return null;
  }
}

export function saveBaseline(name: string, rows: ClaimRow[]): { ok: boolean; error?: string } {
  const payload: StoredBaseline = {
    name,
    savedAt: new Date().toISOString(),
    rows: snapshotOf(rows),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        'Baseline is too large for browser storage. The dashboard still works; only new/updated/removed counters are unavailable.',
    };
  }
}

export function clearBaseline(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

export function diffAgainstBaseline(rows: ClaimRow[], baseline: StoredBaseline): BaselineDiff {
  const current = snapshotOf(rows);
  let added = 0;
  let updated = 0;

  for (const [key, value] of Object.entries(current)) {
    const previous = baseline.rows[key];
    if (previous === undefined) added += 1;
    else if (previous !== value) updated += 1;
  }

  let removed = 0;
  for (const key of Object.keys(baseline.rows)) {
    if (current[key] === undefined) removed += 1;
  }

  return {
    added,
    updated,
    removed,
    baselineName: baseline.name,
    baselineDate: baseline.savedAt.slice(0, 10),
  };
}
