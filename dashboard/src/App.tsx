import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CODIFICATION } from './config/codification';
import { clearBaseline, diffAgainstBaseline, loadBaseline, saveBaseline } from './lib/baseline';
import { count, longDate } from './lib/format';
import { applyFilters, defaultMonths, distinctValues, latestJournalDate, periodRangeLabel, type Filters } from './lib/metrics';
import {
  clearSession,
  loadSession,
  saveSession,
  savedSessionLabel,
  type TabId,
} from './lib/persistSession';
import { isBaselineFilename, parseWorkbook } from './lib/parseWorkbook';
import type { BaselineDiff, ParseResult } from './lib/types';
import { DataQualityTab } from './components/DataQualityTab';
import { FileDrop } from './components/FileDrop';
import { FiltersBar } from './components/Filters';
import { PenaltyTab } from './components/PenaltyTab';
import { ShortageTab } from './components/ShortageTab';
import type { CustomPivotBlock } from './lib/customBlocks';

const CustomBlocksTab = lazy(() =>
  import('./components/CustomBlocksTab').then((m) => ({ default: m.CustomBlocksTab })),
);

export default function App() {
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('shortage');
  const [customBlocks, setCustomBlocks] = useState<CustomPivotBlock[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [diff, setDiff] = useState<BaselineDiff | null>(null);
  const [baselineName, setBaselineName] = useState(() => loadBaseline()?.name ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingBaseline = useRef(false);
  const restoredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await loadSession();
      if (cancelled || !session) {
        setHydrating(false);
        return;
      }

      restoredRef.current = true;
      setParse(session.parse);
      setFilters(session.filters);
      setTab(session.tab);
      setCustomBlocks(session.customBlocks);

      const baseline = loadBaseline();
      if (baseline) {
        setBaselineName(baseline.name);
        setDiff(diffAgainstBaseline(session.parse.rows, baseline));
      }

      setNotice(`Restored ${savedSessionLabel() ?? session.parse.fileName} from this browser.`);
      setHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (
      nextParse: ParseResult,
      nextFilters: Filters,
      nextTab: TabId,
      nextBlocks: CustomPivotBlock[],
    ) => {
      const saved = await saveSession({
        parse: nextParse,
        filters: nextFilters,
        tab: nextTab,
        customBlocks: nextBlocks,
      });
      if (!saved.ok && saved.error) setNotice(saved.error);
    },
    [],
  );

  useEffect(() => {
    if (!parse || !filters || hydrating) return;
    void persist(parse, filters, tab, customBlocks);
  }, [parse, filters, tab, customBlocks, hydrating, persist]);

  const handleFile = useCallback(async (file: File, asBaseline: boolean) => {
    setBusy(true);
    setError(null);
    if (!restoredRef.current) setNotice(null);

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
      let uploadNotice: string | null = null;

      if (treatAsBaseline || !existing) {
        const baselineResult = saveBaseline(file.name, result.rows);
        setBaselineName(baselineResult.ok ? file.name : null);
        setDiff(null);
        uploadNotice = baselineResult.ok
          ? `Baseline set from ${file.name}. Saved locally — safe to refresh this page.`
          : (baselineResult.error ?? null);
      } else {
        setDiff(diffAgainstBaseline(result.rows, existing));
        setBaselineName(existing.name);
        uploadNotice = `Loaded ${file.name}. Saved locally — safe to refresh this page.`;
      }

      const asOf = latestJournalDate(result.rows);
      const nextFilters: Filters = {
        divisions: [],
        customers: [],
        basis: 'journal',
        asOf,
        months: defaultMonths(asOf),
      };
      setParse(result);
      setFilters(nextFilters);
      setTab('shortage');
      restoredRef.current = false;

      const stored = await saveSession({
        parse: result,
        filters: nextFilters,
        tab: 'shortage',
        customBlocks,
      });
      setNotice(stored.ok ? uploadNotice : (stored.error ?? uploadNotice));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that workbook.');
    } finally {
      setBusy(false);
    }
  }, [customBlocks]);

  async function handleClearSavedData() {
    await clearSession();
    setParse(null);
    setFilters(null);
    setCustomBlocks([]);
    setDiff(null);
    setTab('shortage');
    setError(null);
    setNotice('Saved data cleared from this browser.');
    restoredRef.current = false;
  }

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
              <div>Saved in this browser</div>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => triggerUpload(false)} disabled={busy || hydrating}>
            ↑ Upload &amp; Refresh
          </button>
          <button className="btn" onClick={() => triggerUpload(true)} disabled={busy || hydrating}>
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
          {parse && (
            <button className="btn btn-ghost" disabled={busy} onClick={() => void handleClearSavedData()}>
              ✕ Clear Saved Data
            </button>
          )}
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
          <button
            className={`tab${tab === 'explore' ? ' active' : ''}`}
            onClick={() => setTab('explore')}
          >
            Explore
            <span className="tab-count">{count(customBlocks.length)}</span>
          </button>
        </nav>
      )}

      <main className="main">
        {error && <div className="note danger">{error}</div>}
        {notice && <div className="note">{notice}</div>}

        {hydrating ? (
          <div className="dropzone-wrap">
            <div className="dropzone">
              <div className="spinner" />
              <h2>Restoring your last session…</h2>
              <p>Loading saved data from this browser.</p>
            </div>
          </div>
        ) : !parse ? (
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
              {tab === 'quality' && <DataQualityTab parse={parse} rows={rows} filters={filters} />}
              {tab === 'explore' && (
                <Suspense
                  fallback={
                    <div className="empty">
                      <div className="spinner" style={{ margin: '0 auto 12px' }} />
                      Loading pivot tools…
                    </div>
                  }
                >
                  <CustomBlocksTab
                    blocks={customBlocks}
                    onChange={setCustomBlocks}
                    filters={filters}
                    allRows={rows}
                    filteredRows={filtered}
                    shortageRows={shortageRows}
                    penaltyRows={penaltyRows}
                  />
                </Suspense>
              )}

              <div className="dashboard-footer">
                <p className="muted dashboard-footer-left">
                  Comparison window: {periodRangeLabel(filters)}, cut off at {longDate(filters.asOf)} on{' '}
                  {filters.basis === 'journal' ? 'Journal Entry Date' : 'Clearing Date'}.
                </p>
                <p className="muted dashboard-footer-right">
                  All processing happens in this browser; your uploaded data is saved locally and survives
                  refresh.
                </p>
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}
