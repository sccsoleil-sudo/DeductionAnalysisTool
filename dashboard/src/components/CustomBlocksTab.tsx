import { useCallback, useMemo } from 'react';
import { createCustomBlock, type CustomPivotBlock, type PivotDataSource } from '../lib/customBlocks';
import type { ClaimRow } from '../lib/types';
import type { Filters } from '../lib/metrics';
import { PivotBlock } from './PivotBlock';

interface CustomBlocksTabProps {
  blocks: CustomPivotBlock[];
  onChange: (blocks: CustomPivotBlock[]) => void;
  filters: Filters;
  allRows: ClaimRow[];
  filteredRows: ClaimRow[];
  shortageRows: ClaimRow[];
  penaltyRows: ClaimRow[];
}

export function CustomBlocksTab({
  blocks,
  onChange,
  filters,
  allRows,
  filteredRows,
  shortageRows,
  penaltyRows,
}: CustomBlocksTabProps) {
  const rowsBySource = useMemo<Record<PivotDataSource, ClaimRow[]>>(
    () => ({
      filtered: filteredRows,
      shortage: shortageRows,
      penalty: penaltyRows,
      all: allRows,
    }),
    [allRows, filteredRows, shortageRows, penaltyRows],
  );

  const addBlock = useCallback(() => {
    onChange([...blocks, createCustomBlock(`Analysis ${blocks.length + 1}`)]);
  }, [blocks, onChange]);

  const updateBlock = useCallback(
    (id: string, next: CustomPivotBlock) => {
      onChange(blocks.map((b) => (b.id === id ? next : b)));
    },
    [blocks, onChange],
  );

  const deleteBlock = useCallback(
    (id: string) => {
      onChange(blocks.filter((b) => b.id !== id));
    },
    [blocks, onChange],
  );

  return (
    <div className="custom-blocks-tab">
      <div className="custom-blocks-toolbar card">
        <div>
          <div className="card-title">Custom analysis blocks</div>
          <div className="card-sub">
            Build pivot tables and Plotly charts on your claim data. Layouts are saved in this
            browser.
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={addBlock}>
          + Add block
        </button>
      </div>

      {blocks.length === 0 ? (
        <div className="empty custom-blocks-empty">
          <p>No custom blocks yet.</p>
          <p className="muted">
            Click <strong>Add block</strong> to open an interactive pivot table. Choose rows,
            columns, and values, then switch the renderer to a Plotly chart (bar, line, heatmap,
            etc.).
          </p>
          <button type="button" className="btn btn-primary" onClick={addBlock}>
            + Add your first block
          </button>
        </div>
      ) : (
        blocks.map((block) => (
          <PivotBlock
            key={block.id}
            block={block}
            rows={rowsBySource[block.dataSource]}
            filters={filters}
            onChange={(next) => updateBlock(block.id, next)}
            onDelete={() => deleteBlock(block.id)}
          />
        ))
      )}
    </div>
  );
}
