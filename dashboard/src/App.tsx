import { useCallback, useMemo, useRef, useState } from 'react';
import { CODIFICATION } from './config/codification';
import { clearBaseline, diffAgainstBaseline, loadBaseline, saveBaseline } from './lib/baseline';
import { count, longDate } from './lib/format';
import { applyFilters, distinctValues, latestJournalDate, type Filters } from './lib/metrics';
import { isBaselineFilename, parseWorkbook } from './lib/parseWorkbook';
import type { BaselineDiff, ParseResult } from './lib/types';
import { DataQualityTab } from './components/DataQualityTab';
import { FileDrop } from './components/FileDrop';
import { FiltersBar } from './components/Filters';
import { PenaltyTab } from './components/PenaltyTab';
import { ShortageTab } from './components/ShortageTab';

type TabId = 'shortage' | 'penalty' | 'quality';

export default function App() {
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('shortage');
  const [filters, setFilters] = useState<Filters | null>(null);
  const [diff, setDiff] = useState<BaselineDiff | null>(null);
  const [baselineName, setBaselineName] = useState(() => loadBaseline()?.name ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingBaseline = useRef(false);

  const handleFile = useCallback(async (file: File, asBaseline: boolean) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await parseWorkbook(file);
      if (result.rows.length === 0) {
        setError(
          result.warnings.find((w) => w.level === 'error')?.message ??
            'No usable rows were found in this workbook.',
        );
        setBusy(false);
        return;
      }

      const treatAsBaseline = asBaseline || isBaselineFilename(file.name);
      const existing = loadBaseline();

      if (treatAsBaseline || !existing) {
        const saved = saveBaseline(file.name, result.rows);
        setBaselineName(saved.ok ? file.name : null);
        setDiff(null);
        setNotice(
          saved.ok
            ? `Baseline set from ${file.name}. New/updated/removed counters start from this snapshot.`
            : (saved.error ?? null),
        );
      } else {
        setDiff(diffAgainstBaseline(result.rows, existing));
        setBaselineName(existing.name);
      }

      const asOf = latestJournalDate(result.rows);
      setParse(result);
      setFilters({ divisions: [], customers: [], basis: 'journal', asOf });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that workbook.');
    } finally {
      setBusy(false);
    }
  }, []);

  const rows = parse?.rows ?? [];

  const filtered = useMemo(
    () => (filters ? applyFilters(rows, filters) : rows),
    [rows, filters],
  );

  const shortageRows = useMemo(
    () => filtered.filter((r) => r.reasonCode === CODIFICATION.reasonCodes.shortage),
    [filtered],
  );
  const penaltyRows = useMemo(
    () => filtered.filter((r) => r.reasonCode === CODIFICATION.reasonCodes.penalty),
    [filtered],
  );

  const divisions = useMemo(() => distinctValues(rows, (r) => r.division), [rows]);
  const customers = useMemo(() => distinctValues(rows, (r) => r.customerName), [rows]);

  const dateBounds = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const row of rows) {
      const d = row.journalEntryDate;
      if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    const fallback = new Date();
    return { min: min ?? fallback, max: max ?? fallback };
  }, [rows]);

  function triggerUpload(asBaseline: boolean) {
    pendingBaseline.current = asBaseline;
    inputRef.current?.click();
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <span className="header-title">Logistics Master Dashboard</span>
          <span className="header-sub">Shortage claims &amp; penalty analytics · L'Oréal Canada</span>
        </div>

        <div className="header-actions">
          {parse && (
            <div className="header-meta">
              <div>{parse.fileName}</div>
              <div>
                {count(rows.length)} rows
                {diff && ` · +${count(diff.added)} new · ~${count(diff.updated)} changed · −${count(diff.removed)} gone`}
              </div>
              {baselineName && <div>Baseline: {baselineName}</div>}
            </div>
          )}
          <button className="btn btn-primary" onClick={() => triggerUpload(false)} disabled={busy}>
            ↑ Upload &amp; Refresh
          </button>
          <button className="btn" onClick={() => triggerUpload(true)} disabled={busy}>
            Set Baseline
          </button>
          <button
            className="btn btn-ghost"
            disabled={busy || !baselineName}
            onClick={() => {
              clearBaseline();
              setBaselineName(null);
              setDiff(null);
              setNotice('Baseline cleared. The next upload becomes the new baseline.');
            }}
          >
            ✕ Clear Baseline
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file, pendingBaseline.current);
            e.target.value = '';
            pendingBaseline.current = false;
          }}
        />
      </header>

      {parse && (
        <nav className="tabs">
          <button
            className={`tab${tab === 'shortage' ? ' active' : ''}`}
            onClick={() => setTab('shortage')}
          >
            Shortage Claims (R02)
            <span className="tab-count">{count(shortageRows.length)}</span>
          </button>
          <button
            className={`tab${tab === 'penalty' ? ' active' : ''}`}
            onClick={() => setTab('penalty')}
          >
            Penalties &amp; Fines (R16)
            <span className="tab-count">{count(penaltyRows.length)}</span>
          </button>
          <button
            className={`tab${tab === 'quality' ? ' active' : ''}`}
            onClick={() => setTab('quality')}
          >
            Data Quality
            <span className="tab-count">{count(parse.warnings.length)}</span>
          </button>
        </nav>
      )}

      <main className="main">
        {error && <div className="note danger">{error}</div>}
        {notice && <div className="note">{notice}</div>}

        {!parse ? (
          <FileDrop onFile={handleFile} busy={busy} />
        ) : (
          filters && (
            <>
              <FiltersBar
                filters={filters}
                divisions={divisions}
                customers={customers}
                minDate={dateBounds.min}
                maxDate={dateBounds.max}
                onChange={setFilters}
              />

              {tab === 'shortage' && (
                <ShortageTab rows={shortageRows} allRows={filtered} filters={filters} />
              )}
              {tab === 'penalty' && <PenaltyTab rows={penaltyRows} filters={filters} />}
              {tab === 'quality' && <DataQualityTab parse={parse} rows={rows} />}

              <p className="muted" style={{ marginTop: 22, fontSize: '0.78rem' }}>
                Comparison window: Jan 1 → {longDate(filters.asOf)} in each year, on{' '}
                {filters.basis === 'journal' ? 'Journal Entry Date' : 'Clearing Date'}. All processing
                happens in this browser; no data is transmitted.
              </p>
            </>
          )
        )}
      </main>
    </div>
  );
}
