import { PivotData } from 'react-pivottable/Utilities';
import type { StoredPivotConfig } from './customBlocks';
import { downloadExcelWorkbook, slugify, type ExportCell, type ExportRow } from './exportSpreadsheet';

/** Aggregated pivot grid matching the block's current configuration. */
export function buildPivotTableAoa(
  data: (string | number)[][],
  pivot: StoredPivotConfig,
): ExportCell[][] {
  const pivotData = new PivotData({
    data,
    rows: pivot.rows,
    cols: pivot.cols,
    vals: pivot.vals,
    aggregatorName: pivot.aggregatorName,
    valueFilter: pivot.valueFilter ?? {},
    sorters: pivot.sorters ?? {},
    rowOrder: pivot.rowOrder ?? 'key_a_to_z',
    colOrder: pivot.colOrder ?? 'key_a_to_z',
    derivedAttributes: pivot.derivedAttributes ?? {},
  });

  const rowKeys = pivotData.getRowKeys();
  const colKeys = pivotData.getColKeys();
  const safeRowKeys = rowKeys.length === 0 ? [[]] : rowKeys;
  const safeColKeys = colKeys.length === 0 ? [[]] : colKeys;

  const headerRow: ExportCell[] = [...pivot.rows];
  if (safeColKeys.length === 1 && safeColKeys[0]!.length === 0) {
    headerRow.push(pivot.aggregatorName);
  } else {
    for (const colKey of safeColKeys) {
      headerRow.push(colKey.join(' · '));
    }
  }

  const body = safeRowKeys.map((rowKey) => {
    const row: ExportCell[] = [...rowKey];
    for (const colKey of safeColKeys) {
      const value = pivotData.getAggregator(rowKey, colKey).value();
      row.push(value ?? '');
    }
    return row;
  });

  return [headerRow, ...body];
}

export function pivotSourceToExportRows(
  data: (string | number)[][],
): { headers: string[]; rows: ExportRow[] } {
  const [headers, ...body] = data;
  if (!headers || headers.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerStrings = headers.map(String);
  const rows = body.map((row) =>
    Object.fromEntries(headerStrings.map((header, index) => [header, row[index] ?? ''])),
  );
  return { headers: headerStrings, rows };
}

export function downloadPivotBlockExcel(
  filename: string,
  blockTitle: string,
  data: (string | number)[][],
  pivot: StoredPivotConfig,
): void {
  const pivotAoa = buildPivotTableAoa(data, pivot);
  const source = pivotSourceToExportRows(data);
  const base = filename || `explore-${slugify(blockTitle)}`;

  downloadExcelWorkbook(base, [
    { name: 'Pivot view', aoa: pivotAoa, formatAmountColumns: true },
    { name: 'Source data', headers: source.headers, rows: source.rows },
  ]);
}
