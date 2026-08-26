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
import { SectionCard } from './SectionCard';
import type { CsvExport } from './DownloadCsvButton';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  const monthlyLy = useMemo(() => monthlySeries(rows, lastYear, basis), [rows, lastYear, basis]);
  const monthlyCy = useMemo(() => monthlySeries(rows, currentYear, basis), [rows, currentYear, basis]);

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
          { label: 'Write-off (WO)', data: [ly.plainWriteOff, cy.plainWriteOff], color: PALETTE.danger },
          { label: 'COM write-off (COM WO)', data: [ly.comWriteOff, cy.comWriteOff], color: PALETTE.warn },
          {
            label: 'Refuse to pay (COM, not written off)',
            data: [ly.refuseToPay, cy.refuseToPay],
            color: PALETTE.slate,
          },
          { label: 'Actual shortage (SHO)', data: [ly.actualShortage, cy.actualShortage], color: PALETTE.violet },
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
    () => monthlyConfig(monthlyLy, monthlyCy, String(lastYear), String(currentYear)),
    [monthlyLy, monthlyCy, lastYear, currentYear],
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
        topOpen.map((c) => c.name),
        topOpen.map((c) => c.value),
      ),
    [topOpen],
  );

  const kpiCsv: CsvExport = {
    filename: 'shortage-key-metrics',
    headers: ['Metric', lyLabel, cyLabel],
    rows: [
      { Metric: 'Open AR balance', [lyLabel]: ly.openArBalance, [cyLabel]: cy.openArBalance },
      { Metric: 'Deductions received', [lyLabel]: ly.deductionsReceived, [cyLabel]: cy.deductionsReceived },
      { Metric: 'Recovered', [lyLabel]: ly.recovered, [cyLabel]: cy.recovered },
      { Metric: 'P&L impact (write-off)', [lyLabel]: ly.writeOffTotal, [cyLabel]: cy.writeOffTotal },
      { Metric: 'COM write-off portion', [lyLabel]: ly.comWriteOff, [cyLabel]: cy.comWriteOff },
      { Metric: 'Recovery rate (%)', [lyLabel]: ly.recoveryRate, [cyLabel]: cy.recoveryRate },
    ],
  };

  const supplementalCsv: CsvExport = {
    filename: 'shortage-supplemental',
    headers: ['Item', 'Amount', 'Lines'],
    rows: [
      ...(cy.excluded !== 0
        ? [{ Item: 'Excluded offsets (PMT/XXX/XXXX)', Amount: cy.excluded, Lines: '' }]
        : []),
      ...(amazon.count > 0
        ? [{ Item: 'Amazon R17 potential shortage', Amount: amazon.total, Lines: amazon.count }]
        : []),
    ],
  };

  if (rows.length === 0) {
    return <div className="empty">No R02 shortage rows match the current filters.</div>;
  }

  return (
    <>
      <SectionCard
        title="Key metrics"
        subtitle={`${lyLabel} vs ${cyLabel}, cut off at ${longDate(asOf)}`}
        csv={kpiCsv}
      >
        <div className="grid grid-4 kpi-grid">
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
      </SectionCard>

      {(cy.excluded !== 0 || amazon.count > 0) && (
        <SectionCard
          title="Supplemental items"
          subtitle="Held out of headline KPI totals"
          csv={supplementalCsv}
          className="card"
        >
          <div className="note info" style={{ marginBottom: 0 }}>
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
        </SectionCard>
      )}

      <div className="grid grid-2">
        <SectionCard
          title={`Year-on-year comparison — ${lyLabel} vs ${cyLabel}`}
          subtitle={`Same calendar window in both years, cut off at ${longDate(asOf)}.`}
          csv={{
            filename: 'shortage-yoy-comparison',
            headers: ['Metric', lyLabel, cyLabel],
            rows: [
              { Metric: 'Open AR balance', [lyLabel]: ly.openArBalance, [cyLabel]: cy.openArBalance },
              { Metric: 'Deductions received', [lyLabel]: ly.deductionsReceived, [cyLabel]: cy.deductionsReceived },
              { Metric: 'Recovered', [lyLabel]: ly.recovered, [cyLabel]: cy.recovered },
              { Metric: 'P&L impact (write-off)', [lyLabel]: ly.writeOffTotal, [cyLabel]: cy.writeOffTotal },
            ],
          }}
        >
          <Chart config={headlineConfig} className="chart-box tall" />
        </SectionCard>

        <SectionCard
          title="P&L impact composition"
          subtitle="Write-off is the P&L hit. The COM portion is stacked separately."
          csv={{
            filename: 'shortage-pl-composition',
            headers: ['Component', lyLabel, cyLabel],
            rows: [
              { Component: 'Write-off (WO)', [lyLabel]: ly.plainWriteOff, [cyLabel]: cy.plainWriteOff },
              { Component: 'COM write-off (COM WO)', [lyLabel]: ly.comWriteOff, [cyLabel]: cy.comWriteOff },
              {
                Component: 'Refuse to pay (COM, not written off)',
                [lyLabel]: ly.refuseToPay,
                [cyLabel]: cy.refuseToPay,
              },
              { Component: 'Actual shortage (SHO)', [lyLabel]: ly.actualShortage, [cyLabel]: cy.actualShortage },
            ],
          }}
        >
          <Chart config={plConfig} className="chart-box tall" />
        </SectionCard>
      </div>

      <div className="grid grid-2">
        <SectionCard
          title="Division breakdown"
          subtitle="Business Area mapped through the codification table."
          csv={{
            filename: 'shortage-division-breakdown',
            headers: ['Division', lyLabel, cyLabel],
            rows: divisionCy.map((d) => ({
              Division: d.name,
              [lyLabel]: divisionLy.find((x) => x.name === d.name)?.value ?? 0,
              [cyLabel]: d.value,
            })),
          }}
        >
          <Chart config={divisionConfig} />
        </SectionCard>

        <SectionCard
          title="Monthly deduction trend"
          subtitle="Full calendar year, both periods."
          csv={{
            filename: 'shortage-monthly-trend',
            headers: ['Month', String(lastYear), String(currentYear)],
            rows: MONTHS.map((month, i) => ({
              Month: month,
              [String(lastYear)]: monthlyLy[i],
              [String(currentYear)]: monthlyCy[i],
            })),
          }}
        >
          <Chart config={monthlyChart} />
        </SectionCard>
      </div>

      <div className="grid grid-3">
        <SectionCard
          title={`Outcome split — ${cyLabel}`}
          subtitle="Closed items classified by Reference Key 2."
          csv={{
            filename: 'shortage-outcome-split',
            headers: ['Outcome', 'Amount', 'Lines'],
            rows: outcomes.map((o) => ({ Outcome: o.name, Amount: o.value, Lines: o.count })),
          }}
        >
          <Chart config={outcomeChart} className="chart-box short" />
        </SectionCard>

        <SectionCard
          title="Open item buckets"
          subtitle="Potential lost vs recoverable vs pending analysis."
          csv={{
            filename: 'shortage-open-buckets',
            headers: ['Bucket', 'Amount', 'Lines'],
            rows: openBuckets.map((o) => ({ Bucket: o.name, Amount: o.value, Lines: o.count })),
          }}
        >
          <Chart config={openBucketChart} className="chart-box short" />
        </SectionCard>

        <SectionCard
          title="Open items by dispute status"
          subtitle="SAP status mapped to management labels."
          csv={{
            filename: 'shortage-dispute-status',
            headers: ['Status', 'Amount', 'Lines'],
            rows: disputeStatuses.map((d) => ({ Status: d.name, Amount: d.value, Lines: d.count })),
          }}
        >
          <Chart config={disputeChart} className="chart-box short" />
        </SectionCard>
      </div>

      <div className="grid grid-2">
        <SectionCard
          title={`Customers — ${lyLabel} vs ${cyLabel}`}
          subtitle="Ranked by current-period deduction value."
          csv={{
            filename: 'shortage-customer-comparison',
            headers: ['Customer', lyLabel, cyLabel, 'Change'],
            rows: topCustomers.map((c) => ({
              Customer: c.name,
              [lyLabel]: c.previous,
              [cyLabel]: c.current,
              Change: c.delta,
            })),
          }}
        >
          <CustomerTable rows={topCustomers} lyLabel={lyLabel} cyLabel={cyLabel} />
        </SectionCard>

        <SectionCard
          title="Top 5 customers by open exposure"
          subtitle="Uncleared R02 lines in the current period."
          csv={{
            filename: 'shortage-top-open-customers',
            headers: ['Customer', 'Open amount', 'Lines'],
            rows: topOpen.map((c) => ({ Customer: c.name, 'Open amount': c.value, Lines: c.count })),
          }}
        >
          <Chart config={openTopChart} />
        </SectionCard>
      </div>
    </>
  );
}
