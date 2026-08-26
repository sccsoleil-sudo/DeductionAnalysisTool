import { useMemo } from 'react';
import { CODIFICATION } from '../config/codification';
import { compactMoney, longDate, money, percent, count } from '../lib/format';
import {
  amazonPotentialShortage,
  byCustomer,
  byDisputeStatus,
  byDivision,
  byOpenBucket,
  byOutcome,
  customerComparison,
  inYtd,
  monthlySeries,
  periodTotals,
  type Filters,
} from '../lib/metrics';
import type { ClaimRow } from '../lib/types';
import {
  Chart,
  PALETTE,
  comparisonConfig,
  doughnutConfig,
  horizontalBarConfig,
  monthlyConfig,
  stackedBarConfig,
} from './Chart';
import { KpiCard } from './KpiCard';
import { CustomerTable } from './CustomerTable';

interface ShortageTabProps {
  rows: ClaimRow[];
  allRows: ClaimRow[];
  filters: Filters;
}

export function ShortageTab({ rows, allRows, filters }: ShortageTabProps) {
  const { asOf, basis } = filters;
  const currentYear = asOf.getFullYear();
  const lastYear = currentYear - 1;
  const cyLabel = `${currentYear} YTD`;
  const lyLabel = `${lastYear} YTD`;

  const cy = useMemo(
    () => periodTotals(rows, asOf, currentYear, basis),
    [rows, asOf, currentYear, basis],
  );
  const ly = useMemo(
    () => periodTotals(rows, asOf, lastYear, basis),
    [rows, asOf, lastYear, basis],
  );

  const cyRows = useMemo(
    () => rows.filter((r) => inYtd(r, asOf, currentYear, basis)),
    [rows, asOf, currentYear, basis],
  );

  const amazon = useMemo(
    () => amazonPotentialShortage(allRows, asOf, currentYear, basis),
    [allRows, asOf, currentYear, basis],
  );

  const divisionCy = useMemo(() => byDivision(cyRows), [cyRows]);
  const divisionLy = useMemo(
    () => byDivision(rows.filter((r) => inYtd(r, asOf, lastYear, basis))),
    [rows, asOf, lastYear, basis],
  );

  const outcomes = useMemo(() => byOutcome(cyRows), [cyRows]);
  const openBuckets = useMemo(() => byOpenBucket(cyRows), [cyRows]);
  const disputeStatuses = useMemo(() => byDisputeStatus(cyRows), [cyRows]);
  const topCustomers = useMemo(
    () => customerComparison(rows, asOf, currentYear, basis, 10),
    [rows, asOf, currentYear, basis],
  );
  const topOpen = useMemo(
    () => byCustomer(cyRows.filter((r) => r.isOpen), 5),
    [cyRows],
  );

  const headlineConfig = useMemo(
    () =>
      comparisonConfig(
        ['Open AR balance', 'Deductions received', 'Recovered', 'P&L impact (write-off)'],
        [ly.openArBalance, ly.deductionsReceived, ly.recovered, ly.writeOffTotal],
        [cy.openArBalance, cy.deductionsReceived, cy.recovered, cy.writeOffTotal],
        lyLabel,
        cyLabel,
      ),
    [ly, cy, lyLabel, cyLabel],
  );

  const plConfig = useMemo(
    () =>
      stackedBarConfig(
        [lyLabel, cyLabel],
        [
          {
            label: 'Write-off (WO)',
            data: [ly.plainWriteOff, cy.plainWriteOff],
            color: PALETTE.danger,
          },
          {
            label: 'COM write-off (COM WO)',
            data: [ly.comWriteOff, cy.comWriteOff],
            color: PALETTE.warn,
          },
          {
            label: 'Refuse to pay (COM, not written off)',
            data: [ly.refuseToPay, cy.refuseToPay],
            color: PALETTE.slate,
          },
          {
            label: 'Actual shortage (SHO)',
            data: [ly.actualShortage, cy.actualShortage],
            color: PALETTE.violet,
          },
        ],
      ),
    [ly, cy, lyLabel, cyLabel],
  );

  const divisionConfig = useMemo(() => {
    const labels = divisionCy.map((d) => d.name);
    const lyMap = new Map(divisionLy.map((d) => [d.name, d.value]));
    return comparisonConfig(
      labels,
      labels.map((l) => lyMap.get(l) ?? 0),
      divisionCy.map((d) => d.value),
      lyLabel,
      cyLabel,
    );
  }, [divisionCy, divisionLy, lyLabel, cyLabel]);

  const monthlyChart = useMemo(
    () =>
      monthlyConfig(
        monthlySeries(rows, lastYear, basis),
        monthlySeries(rows, currentYear, basis),
        String(lastYear),
        String(currentYear),
      ),
    [rows, lastYear, currentYear, basis],
  );

  const outcomeChart = useMemo(
    () =>
      doughnutConfig(
        outcomes.map((o) => o.name),
        outcomes.map((o) => o.value),
        [PALETTE.accent, PALETTE.info, PALETTE.danger, PALETTE.warn, PALETTE.slate, PALETTE.violet],
      ),
    [outcomes],
  );

  const openBucketChart = useMemo(
    () =>
      doughnutConfig(
        openBuckets.map((o) => o.name),
        openBuckets.map((o) => o.value),
        [PALETTE.danger, PALETTE.accent, PALETTE.slate],
      ),
    [openBuckets],
  );

  const disputeChart = useMemo(
    () =>
      horizontalBarConfig(
        disputeStatuses.map((d) => d.name),
        disputeStatuses.map((d) => d.value),
        [PALETTE.info, PALETTE.accent, PALETTE.warn, PALETTE.slate],
      ),
    [disputeStatuses],
  );

  const openTopChart = useMemo(
    () =>
      horizontalBarConfig(
        topOpen.map((c) => shortName(c.name)),
        topOpen.map((c) => c.value),
      ),
    [topOpen],
  );

  if (rows.length === 0) {
    return <div className="empty">No R02 shortage rows match the current filters.</div>;
  }

  return (
    <>
      <div className="grid grid-4">
        <KpiCard
          label="Open AR balance"
          value={compactMoney(cy.openArBalance)}
          tone="info"
          current={cy.openArBalance}
          previous={ly.openArBalance}
          footnote={`Uncleared as of ${longDate(asOf)}`}
        />
        <KpiCard
          label="Deductions received"
          value={compactMoney(cy.deductionsReceived)}
          tone="primary"
          current={cy.deductionsReceived}
          previous={ly.deductionsReceived}
          footnote={`${count(cy.rowCount)} lines · excludes ${CODIFICATION.excludedRefKey2.join(', ')}`}
        />
        <KpiCard
          label="Recovered"
          value={compactMoney(cy.recovered)}
          tone="accent"
          current={cy.recovered}
          previous={ly.recovered}
          higherIsBetter
          footnote={`Recovery rate ${percent(cy.recoveryRate)} (LY ${percent(ly.recoveryRate)})`}
        />
        <KpiCard
          label="P&L impact — write-off"
          value={compactMoney(cy.writeOffTotal)}
          tone="danger"
          current={cy.writeOffTotal}
          previous={ly.writeOffTotal}
          footnote={`of which COM write-off ${money(cy.comWriteOff)}`}
        />
      </div>

      {(cy.excluded !== 0 || amazon.count > 0) && (
        <div className="note info">
          {cy.excluded !== 0 && (
            <>
              <strong>Identified payback / offsets (excluded):</strong> {money(cy.excluded)} across{' '}
              {CODIFICATION.excludedRefKey2.join(', ')} lines — held out of every KPI above.
            </>
          )}
          {cy.excluded !== 0 && amazon.count > 0 && <br />}
          {amazon.count > 0 && (
            <>
              <strong>Amazon R17 potential shortage:</strong> {money(amazon.total)} over{' '}
              {count(amazon.count)} lines — tracked as forward-looking risk, never part of R02 totals.
            </>
          )}
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Year-on-year comparison — {lyLabel} vs {cyLabel}</div>
          <div className="card-sub">
            Same calendar window in both years, cut off at {longDate(asOf)}.
          </div>
          <Chart config={headlineConfig} className="chart-box tall" />
        </div>

        <div className="card">
          <div className="card-title">P&L impact composition</div>
          <div className="card-sub">
            Write-off is the P&L hit. The COM portion is stacked separately so the refused-then-written-off
            amount is visible on its own.
          </div>
          <Chart config={plConfig} className="chart-box tall" />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Division breakdown</div>
          <div className="card-sub">Business Area mapped through the codification table.</div>
          <Chart config={divisionConfig} />
        </div>

        <div className="card">
          <div className="card-title">Monthly deduction trend</div>
          <div className="card-sub">Full calendar year, both periods.</div>
          <Chart config={monthlyChart} />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="card-title">Outcome split — {cyLabel}</div>
          <div className="card-sub">Closed items classified by Reference Key 2.</div>
          <Chart config={outcomeChart} className="chart-box short" />
        </div>

        <div className="card">
          <div className="card-title">Open item buckets</div>
          <div className="card-sub">Potential lost vs recoverable vs pending analysis.</div>
          <Chart config={openBucketChart} className="chart-box short" />
        </div>

        <div className="card">
          <div className="card-title">Open items by dispute status</div>
          <div className="card-sub">SAP status mapped to management labels.</div>
          <Chart config={disputeChart} className="chart-box short" />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Customers — {lyLabel} vs {cyLabel}</div>
          <div className="card-sub">Ranked by current-period deduction value.</div>
          <CustomerTable rows={topCustomers} lyLabel={lyLabel} cyLabel={cyLabel} />
        </div>

        <div className="card">
          <div className="card-title">Top 5 customers by open exposure</div>
          <div className="card-sub">Uncleared R02 lines in the current period.</div>
          <Chart config={openTopChart} />
        </div>
      </div>
    </>
  );
}

function shortName(name: string): string {
  return name.length > 26 ? `${name.slice(0, 26)}…` : name;
}
