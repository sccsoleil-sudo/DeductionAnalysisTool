import { useMemo } from 'react';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import 'react-pivottable/pivottable.css';
import {
  PIVOT_DATA_SOURCE_LABELS,
  pivotConfigFromUiState,
  type CustomPivotBlock,
  type PivotDataSource,
} from '../lib/customBlocks';
import { buildPivotData } from '../lib/pivotData';
import { PIVOT_RENDERERS } from '../lib/pivotRenderers';
import { count } from '../lib/format';
import type { ClaimRow } from '../lib/types';

interface PivotBlockProps {
  block: CustomPivotBlock;
  rows: ClaimRow[];
  onChange: (next: CustomPivotBlock) => void;
  onDelete: () => void;
}

export function PivotBlock({ block, rows, onChange, onDelete }: PivotBlockProps) {
  const data = useMemo(() => buildPivotData(rows), [rows]);

  const pivotProps = useMemo(
    () => ({
      ...block.pivot,
      data,
      renderers: PIVOT_RENDERERS,
    }),
    [block.pivot, data],
  );

  return (
    <div className="card pivot-block">
      <div className="card-header">
        <div className="card-header-text pivot-block-header">
          <input
            className="pivot-block-title"
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            aria-label="Block title"
          />
          <div className="card-sub pivot-block-meta">
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
            <span>{count(rows.length)} rows · drag fields below to configure</span>
          </div>
        </div>
        <button type="button" className="btn btn-ghost pivot-block-delete" onClick={onDelete}>
          ✕ Remove
        </button>
      </div>

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
