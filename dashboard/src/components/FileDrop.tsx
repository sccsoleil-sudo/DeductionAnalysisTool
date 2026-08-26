import { useRef, useState } from 'react';
import { CODIFICATION } from '../config/codification';

interface FileDropProps {
  onFile: (file: File, asBaseline: boolean) => void;
  busy: boolean;
}

export function FileDrop({ onFile, busy }: FileDropProps) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file, false);
  }

  return (
    <div className="dropzone-wrap">
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
      >
        {busy ? (
          <>
            <div className="spinner" />
            <h2>Reading workbook…</h2>
            <p>Parsing sheets and classifying rows.</p>
          </>
        ) : (
          <>
            <h2>Upload your Logistics Master file</h2>
            <p>
              Drag an <strong>.xlsx</strong> or <strong>.xls</strong> file here, or choose one below. Nothing
              is uploaded — the file is read entirely inside your browser.
            </p>
            <button className="btn" onClick={() => inputRef.current?.click()}>
              Choose file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file, false);
                e.target.value = '';
              }}
            />
            <div className="dropzone-hint">
              <strong>Expected columns</strong> (extra columns are ignored, sheet order does not matter):
              <br />
              <code>Reason Code</code> <code>Reference Key 2</code> <code>Amount (CoCode Crcy)</code>{' '}
              <code>Customer Name</code> <code>Journal Entry Date</code> <code>Business Area</code>{' '}
              <code>Clearing Date</code> <code>Clearing Journal Entry</code> <code>Dispute Status</code>
              <br />
              <br />
              Sheets missing the required columns (pivots, scratch tabs) are skipped automatically. A file
              named <code>{CODIFICATION.autoBaselineFilename}.xlsx</code> is treated as a baseline.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
