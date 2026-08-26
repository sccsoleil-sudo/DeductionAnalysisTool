import * as XLSX from 'xlsx';
import { isYtdMonthSelection, MONTH_LABELS, type Filters } from './metrics';

export type ExportCell = string | number | boolean | null | undefined;

export type ExportRow = Record<string, ExportCell>;

const TEXT_COLUMN =
  /^(metric|item|customer|division|category|month|outcome|bucket|status|description|field|level|message|issue|rule|component|reason code|reference key 2|classified)/i;

const LABEL_COLUMNS = new Set(['Metric', 'Item', 'Component', 'Description']);

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export interface ExportFilenameOptions {
  /** Appends a slug from the uploaded workbook name (data-quality exports). */
  sourceFile?: string;
}

function periodSlug(filters: Filters): string {
  const sorted = [...filters.months].sort((a, b) => a - b);
  if (sorted.length === 12) return 'full-year';
  if (isYtdMonthSelection(sorted, filters.asOf)) {
    const month = MONTH_LABELS[filters.asOf.getMonth()]!.toLowerCase();
    return `ytd-${month}${filters.asOf.getFullYear()}`;
  }
  const contiguous = sorted.every((m, i) => i === 0 || m === sorted[i - 1]! + 1);
  if (contiguous && sorted.length > 0) {
    const start = MONTH_LABELS[sorted[0]!]!.toLowerCase();
    const end = MONTH_LABELS[sorted[sorted.length - 1]!]!.toLowerCase();
    return start === end ? start : `${start}-${end}`;
  }
  return sorted.map((m) => MONTH_LABELS[m]!.toLowerCase()).join('+');
}

function isoDateCompact(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Builds a descriptive, filesystem-safe export name from the active filters. */
export function buildExportFilename(
  section: string,
  filters?: Filters,
  options?: ExportFilenameOptions,
): string {
  const parts: string[] = [section];

  if (filters) {
    parts.push(
      filters.divisions.length === 0
        ? 'all-divisions'
        : filters.divisions.map((d) => slugify(d)).join('-'),
    );

    if (filters.customers.length > 0) {
      parts.push(slugify(filters.customers[0]!).slice(0, 28));
    }

    parts.push(periodSlug(filters));
    parts.push(`asof-${isoDateCompact(filters.asOf)}`);
    parts.push(filters.basis);
  }

  if (options?.sourceFile) {
    parts.push(`src-${slugify(options.sourceFile.replace(/\.xlsx?$/i, '')).slice(0, 32)}`);
  }

  return parts.join('_').slice(0, 180);
}

function sheetNameFromExportFilename(filename: string): string {
  const base = filename.replace(/\.xlsx$/i, '');
  const section = base.split('_')[0] ?? base;
  return sanitizeSheetName(section.replace(/-/g, ' '));
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Export';
}

function numberFormatForCell(header: string, row: ExportRow, labelKey?: string): string | undefined {
  if (labelKey && header === labelKey) return undefined;
  if (TEXT_COLUMN.test(header)) return undefined;

  const h = header.toLowerCase();
  const label = labelKey ? String(row[labelKey] ?? '').toLowerCase() : '';

  if (/share|rate|%/.test(h) || /rate\s*\(%\)|%/.test(label)) return '0.0"%"';
  if (/lines|count/.test(h) || /\blines\b/.test(label)) return '#,##0';
  if (/amount|change|open|balance|total|value|deduction|recovered|impact|shortage|write/.test(h)) {
    return '"$"#,##0.00';
  }
  if (/\d{4}|ytd/.test(h)) return '"$"#,##0.00';
  return '"$"#,##0.00';
}

function labelColumnKey(headers: string[]): string | undefined {
  return headers.find((h) => LABEL_COLUMNS.has(h));
}

function columnWidth(header: string, rows: ExportRow[]): number {
  const h = header.toLowerCase();
  if (/customer/.test(h)) return 42;
  if (/message|description|classified/.test(h)) return 52;
  if (/reason code|reference key/.test(h)) return 24;
  if (/metric|item|component|rule|issue/.test(h)) return 28;

  let max = header.length;
  for (const row of rows) {
    const value = row[header];
    if (value !== null && value !== undefined) {
      max = Math.max(max, String(value).length);
    }
  }
  return Math.min(Math.max(max + 2, 12), 56);
}

function applyColumnFormats(
  ws: XLSX.WorkSheet,
  headers: string[],
  rows: ExportRow[],
): void {
  const labelKey = labelColumnKey(headers);

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c]!;
      const format = numberFormatForCell(header, row, labelKey);
      if (!format) continue;

      const addr = XLSX.utils.encode_cell({ r: r + 1, c });
      const cell = ws[addr];
      if (!cell || typeof cell.v !== 'number') continue;
      cell.t = 'n';
      cell.z = format;
    }
  }
}

export function buildWorkbook(
  headers: string[],
  rows: ExportRow[],
  sheetName = 'Export',
): XLSX.WorkBook {
  const data: ExportCell[][] = [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = headers.map((header) => ({ wch: columnWidth(header, rows) }));
  applyColumnFormats(ws, headers, rows);
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName));
  return wb;
}

export function downloadExcel(filename: string, headers: string[], rows: ExportRow[]): void {
  const base = filename.replace(/\.xlsx$/i, '');
  const wb = buildWorkbook(headers, rows, sheetNameFromExportFilename(base));
  XLSX.writeFile(wb, `${base}.xlsx`, { bookType: 'xlsx', compression: true });
}
