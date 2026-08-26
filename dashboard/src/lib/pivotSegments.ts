import { PivotData } from 'react-pivottable/Utilities';
import type { StoredPivotConfig } from './customBlocks';

const TABLE_RENDERERS = new Set([
  'Table',
  'Table Heatmap',
  'Table Col Heatmap',
  'Table Row Heatmap',
  'Exportable TSV',
]);

export function isPlotlyRenderer(rendererName: string): boolean {
  return !TABLE_RENDERERS.has(rendererName);
}

/** Labels the user can assign colors to for the current pivot + renderer. */
export function getColorableSegments(
  data: (string | number)[][],
  pivot: StoredPivotConfig,
): string[] {
  if (!isPlotlyRenderer(pivot.rendererName)) return [];

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
  const transpose = pivot.rendererName.includes('Bar Chart') && !pivot.rendererName.includes('Column');
  const isPie = pivot.rendererName.includes('Pie');

  const traceKeys = (transpose ? colKeys : rowKeys).length === 0 ? [[]] : transpose ? colKeys : rowKeys;
  const datumKeys = (transpose ? rowKeys : colKeys).length === 0 ? [[]] : transpose ? rowKeys : colKeys;

  if (isPie) {
    return [...new Set(datumKeys.map((key) => key.join(' · ') || 'Total'))];
  }

  if (traceKeys.length > 1) {
    return traceKeys.map((key) => key.join(' · ') || 'Series');
  }

  return datumKeys.map((key) => key.join(' · ') || 'Total');
}

export const PIVOT_COLOR_PALETTE = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#4f46e5',
];

export function resolveSegmentColor(
  segmentColors: Record<string, string>,
  label: string,
  index: number,
): string {
  return segmentColors[label] ?? PIVOT_COLOR_PALETTE[index % PIVOT_COLOR_PALETTE.length]!;
}
