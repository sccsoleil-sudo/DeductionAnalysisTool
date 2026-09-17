/** Which row set feeds a custom pivot block. */
export type PivotDataSource = 'filtered' | 'shortage' | 'penalty' | 'all';

/** Serializable pivot layout — `data` is injected at render time. */
export interface StoredPivotConfig {
  rows: string[];
  cols: string[];
  vals: string[];
  aggregatorName: string;
  rendererName: string;
  valueFilter?: Record<string, unknown>;
  sorters?: Record<string, unknown>;
  rowOrder?: string;
  colOrder?: string;
  derivedAttributes?: Record<string, unknown>;
  hiddenAttributes?: string[];
  hiddenFromAggregators?: string[];
  hiddenFromDragDrop?: string[];
}

export interface CustomPivotBlock {
  id: string;
  title: string;
  dataSource: PivotDataSource;
  pivot: StoredPivotConfig;
  /** User overrides keyed by segment label (pie slice, bar category, or series name). */
  segmentColors: Record<string, string>;
}

export const PIVOT_DATA_SOURCE_LABELS: Record<PivotDataSource, string> = {
  filtered: 'All filtered rows',
  shortage: 'R02 shortage only',
  penalty: 'R16 penalties only',
  all: 'Entire workbook (ignore filters)',
};

export function defaultPivotConfig(): StoredPivotConfig {
  return {
    rows: ['Division'],
    cols: ['Outcome'],
    vals: ['Amount'],
    aggregatorName: 'Sum',
    rendererName: 'Table',
  };
}

export function createCustomBlock(title = 'New analysis'): CustomPivotBlock {
  return {
    id: crypto.randomUUID(),
    title,
    dataSource: 'filtered',
    pivot: defaultPivotConfig(),
    segmentColors: {},
  };
}

/** Map legacy "Journal Date" pivot field name to "Claim Date". */
export function migratePivotFieldNames(pivot: StoredPivotConfig): StoredPivotConfig {
  const rename = (name: string) => (name === 'Journal Date' ? 'Claim Date' : name);
  const renameList = (list: string[] | undefined) => list?.map(rename);
  const renameKeyed = (obj: Record<string, unknown> | undefined) => {
    if (!obj) return undefined;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      next[rename(key)] = value;
    }
    return next;
  };
  return {
    ...pivot,
    rows: renameList(pivot.rows) ?? [],
    cols: renameList(pivot.cols) ?? [],
    vals: renameList(pivot.vals) ?? [],
    valueFilter: renameKeyed(pivot.valueFilter),
    sorters: renameKeyed(pivot.sorters),
    hiddenAttributes: renameList(pivot.hiddenAttributes),
    hiddenFromAggregators: renameList(pivot.hiddenFromAggregators),
    hiddenFromDragDrop: renameList(pivot.hiddenFromDragDrop),
  };
}

/** Strip runtime-only fields before persisting pivot UI state. */
export function pivotConfigFromUiState(state: Record<string, unknown>): StoredPivotConfig {
  return {
    rows: Array.isArray(state.rows) ? (state.rows as string[]) : [],
    cols: Array.isArray(state.cols) ? (state.cols as string[]) : [],
    vals: Array.isArray(state.vals) ? (state.vals as string[]) : [],
    aggregatorName: typeof state.aggregatorName === 'string' ? state.aggregatorName : 'Sum',
    rendererName: typeof state.rendererName === 'string' ? state.rendererName : 'Table',
    valueFilter:
      state.valueFilter && typeof state.valueFilter === 'object'
        ? (state.valueFilter as Record<string, unknown>)
        : undefined,
    sorters:
      state.sorters && typeof state.sorters === 'object'
        ? (state.sorters as Record<string, unknown>)
        : undefined,
    rowOrder: typeof state.rowOrder === 'string' ? state.rowOrder : undefined,
    colOrder: typeof state.colOrder === 'string' ? state.colOrder : undefined,
    derivedAttributes:
      state.derivedAttributes && typeof state.derivedAttributes === 'object'
        ? (state.derivedAttributes as Record<string, unknown>)
        : undefined,
    hiddenAttributes: Array.isArray(state.hiddenAttributes)
      ? (state.hiddenAttributes as string[])
      : undefined,
    hiddenFromAggregators: Array.isArray(state.hiddenFromAggregators)
      ? (state.hiddenFromAggregators as string[])
      : undefined,
    hiddenFromDragDrop: Array.isArray(state.hiddenFromDragDrop)
      ? (state.hiddenFromDragDrop as string[])
      : undefined,
  };
}
