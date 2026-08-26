import { useCallback, useEffect, useMemo, useRef } from 'react';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import 'react-pivottable/pivottable.css';
import {
  PIVOT_DATA_SOURCE_LABELS,
  pivotConfigFromUiState,
  type CustomPivotBlock,
  type PivotDataSource,
} from '../lib/customBlocks';
import { buildExportFilename, slugify } from '../lib/exportSpreadsheet';
import { applySegmentColors, downloadPivotChartPng } from '../lib/pivotChartColors';
import { buildPivotData } from '../lib/pivotData';
import { downloadPivotBlockData } from '../lib/pivotExport';
import { PIVOT_RENDERERS } from '../lib/pivotRenderers';
import {
  getColorableSegments,
  isPlotlyRenderer,
  resolveSegmentColor,
} from '../lib/pivotSegments';
import { count } from '../lib/format';
import type { Filters } from '../lib/metrics';
import type { ClaimRow } from '../lib/types';

interface PivotBlockProps {
  block: CustomPivotBlock;
  rows: ClaimRow[];
  filters: Filters;
  onChange: (next: CustomPivotBlock) => void;
  onDelete: () => void;
}

export function PivotBlock({ block, rows, filters, onChange, onDelete }: PivotBlockProps) {
  const data = useMemo(() => buildPivotData(rows), [rows]);
  const graphDivRef = useRef<HTMLElement | null>(null);
  const figureRef = useRef<{ data: Array<Record<string, unknown>> } | null>(null);

  const exportFilename = useMemo(
    () => buildExportFilename(`explore-${slugify(block.title)}`, filters),
    [block.title, filters],
  );

  const segments = useMemo(
    () => getColorableSegments(data, block.pivot),
    [data, block.pivot],
  );

  const chartActive = isPlotlyRenderer(block.pivot.rendererName);

  const pivotProps = useMemo(
    () => ({
      ...block.pivot,
      data,
      renderers: PIVOT_RENDERERS,
      onRendererUpdate: (
        figure: { data: Array<Record<string, unknown>> },
        graphDiv: HTMLElement,
      ) => {
        graphDivRef.current = graphDiv;
        figureRef.current = figure;
        applySegmentColors(graphDiv, figure, block.segmentColors);
      },
    }),
    [block.pivot, block.segmentColors, data],
  );

  useEffect(() => {
    if (!graphDivRef.current || !figureRef.current || !chartActive) return;
    applySegmentColors(graphDivRef.current, figureRef.current, block.segmentColors);
  }, [block.segmentColors, chartActive]);

  const setSegmentColor = useCallback(
    (label: string, color: string) => {
      onChange({
        ...block,
        segmentColors: { ...block.segmentColors, [label]: color },
      });
    },
    [block, onChange],
  );

  const resetSegmentColors = useCallback(() => {
    onChange({ ...block, segmentColors: {} });
  }, [block, onChange]);

  async function handleDownloadChart() {
    await downloadPivotChartPng(graphDivRef.current, exportFilename, block.pivot);
  }

  return (
    <div className="card pivot-block">
      <div className="pivot-block-toolbar">
        <div className="pivot-block-toolbar-main">
          <input
            className="pivot-block-title"
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            aria-label="Block title"
          />
          <div className="pivot-block-meta">
            <label className="pivot-source-label">
              Data
              <select
                value={block.dataSource}
                onChange={(e) =>
                  onChange({ ...block, dataSource: e.target.value as PivotDataSource })
                }
              >
                {Object.entries(PIVOT_DATA_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <span>{count(rows.length)} rows</span>
          </div>
        </div>

        <div className="pivot-block-actions">
          <button
            type="button"
            className="btn-excel"
            disabled={rows.length === 0}
            title="Download pivot table and source data"
            onClick={() => downloadPivotBlockData(exportFilename, block.title, data, block.pivot)}
          >
            ↓ Data
          </button>
          <button
            type="button"
            className="btn-excel"
            disabled={rows.length === 0 || !chartActive}
            title={chartActive ? 'Download chart as PNG' : 'Switch to a Plotly chart renderer to export'}
            onClick={() => void handleDownloadChart()}
          >
            ↓ Chart
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm pivot-block-delete"
            onClick={onDelete}
            title="Remove this analysis block"
          >
            Delete
          </button>
        </div>
      </div>

      {chartActive && segments.length > 0 && (
        <div className="pivot-color-panel">
          <div className="pivot-color-panel-head">
            <span className="pivot-color-panel-title">Chart colors</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetSegmentColors}>
              Reset colors
            </button>
          </div>
          <div className="pivot-color-grid">
            {segments.map((label, index) => (
              <label key={label} className="pivot-color-item">
                <span className="pivot-color-label" title={label}>
                  {label}
                </span>
                <input
                  type="color"
                  value={resolveSegmentColor(block.segmentColors, label, index)}
                  onChange={(e) => setSegmentColor(label, e.target.value)}
                  aria-label={`Color for ${label}`}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="pivot-wrap">
        <PivotTableUI
          {...pivotProps}
          onChange={(next: Record<string, unknown>) =>
            onChange({
              ...block,
              pivot: pivotConfigFromUiState(next),
            })
          }
        />
      </div>
    </div>
  );
}
