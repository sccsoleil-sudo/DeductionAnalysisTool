import { useMemo } from 'react';
import { CODIFICATION, excludedCodesLabel } from '../config/codification';
import { compactMoney, longDate, money, percent, count } from '../lib/format';
import {
  openArBreakdown,
  amazonPotentialShortage,
  byCustomer,
  byDisputeStatus,
  byDivision,
  byOpenBucket,
  byOutcome,
  claimedInPreviousYear,
  lostClaimedInPreviousYear,
  customerComparison,
  inPeriod,
  monthlySeries,
  basisLabel,
  periodRangeLabel,
  periodTotals,
  yearPeriodLabel,
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
import { buildExportFilename } from '../lib/exportSpreadsheet';
import type { SectionExport } from './DownloadExcelButton';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface ShortageTabProps {
  rows: ClaimRow[];
  allRows: ClaimRow[];
  filters: Filters;
}

export function ShortageTab({ rows, allRows, filters }: ShortageTabProps) {
  const { asOf } = filters;
  const currentYear = asOf.getFullYear();
  const lastYear = currentYear - 1;
  const cyLabel = yearPeriodLabel(currentYear, filters);
  const lyLabel = yearPeriodLabel(lastYear, filters);
  const rangeLabel = periodRangeLabel(filters);
  const xlsxName = (section: string) => buildExportFilename(section, filters);

  const cy = useMemo(
    () => periodTotals(rows, filters, currentYear),
    [rows, filters, currentYear],
  );
  const ly = useMemo(
    () => periodTotals(rows, filters, lastYear),
    [rows, filters, lastYear],
  );
  const cyPl = useMemo(
    () => periodTotals(rows, filters, currentYear, filters.plBasis),
    [rows, filters, currentYear],
  );
  const lyPl = useMemo(
    () => periodTotals(rows, filters, lastYear, filters.plBasis),
    [rows, filters, lastYear],
  );
  const priorYearClaimed = useMemo(
    () => claimedInPreviousYear(rows, filters, currentYear),
    [rows, filters, currentYear],
  );
  const lostPriorYearClaimed = useMemo(
    () => lostClaimedInPreviousYear(rows, filters, currentYear),
    [rows, filters, currentYear],
  );
  const openArByClaimYear = useMemo(() => {
    const snapshot = new Date(
      currentYear,
      asOf.getMonth(),
      asOf.getDate(),
      23,
      59,
      59,
      999,
    );
    return openArBreakdown(rows, snapshot);
  }, [rows, currentYear, asOf]);

  const cyRows = useMemo(
    () => rows.filter((r) => inPeriod(r, filters, currentYear)),
    [rows, filters, currentYear],
  );

  const amazon = useMemo(
    () => amazonPotentialShortage(allRows, filters, currentYear),
    [allRows, filters, currentYear],
  );

  const divisionCy = useMemo(() => byDivision(cyRows), [cyRows]);
  const divisionLy = useMemo(
    () => byDivision(rows.filter((r) => inPeriod(r, filters, lastYear))),
    [rows, filters, lastYear],
  );

  const outcomes = useMemo(() => byOutcome(cyRows), [cyRows]);
  const openBuckets = useMemo(() => byOpenBucket(cyRows), [cyRows]);
  const disputeStatuses = useMemo(() => byDisputeStatus(cyRows), [cyRows]);
  const topCustomers = useMemo(
    () => customerComparison(rows, filters, currentYear, 10),
    [rows, filters, currentYear],
  );
  const topOpen = useMemo(
    () => byCustomer(cyRows.filter((r) => r.isOpen), 5),
    [cyRows],
  );

  const monthlyLy = useMemo(() => monthlySeries(rows, lastYear, filters), [rows, lastYear, filters]);
  const monthlyCy = useMemo(() => monthlySeries(rows, currentYear, filters), [rows, currentYear, filters]);

  const headlineConfig = useMemo(
    () =>
      comparisonConfig(
        ['Open AR balance', 'Deductions received', 'Recovered', 'Lost', 'Actual shortage'],
        [ly.openArBalance, ly.deductionsReceived, ly.recovered, lyPl.writeOffTotal, ly.actualShortage],
        [cy.openArBalance, cy.deductionsReceived, cy.recovered, cyPl.writeOffTotal, cy.actualShortage],
        lyLabel,
        cyLabel,
      ),
    [ly, cy, lyPl, cyPl, lyLabel, cyLabel],
  );

  const plConfig = useMemo(
    () =>
      stackedBarConfig(
        [lyLabel, cyLabel],
        [
          { label: 'Write-off (WO)', data: [lyPl.plainWriteOff, cyPl.plainWriteOff], color: PALETTE.danger },
          { label: 'COM write-off (COM WO)', data: [lyPl.comWriteOff, cyPl.comWriteOff], color: PALETTE.warn },
          {
            label: 'COM with Clearing Date',
            data: [lyPl.refuseToPay, cyPl.refuseToPay],
            color: PALETTE.slate,
          },
          { label: 'Actual shortage (SHO)', data: [lyPl.actualShortage, cyPl.actualShortage], color: PALETTE.violet },
        ],
      ),
    [lyPl, cyPl, lyLabel, cyLabel],
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

  const kpiExport: SectionExport = {
    filename: xlsxName('shortage-key-metrics'),
    headers: ['Metric', lyLabel, cyLabel],
    rows: [
      { Metric: 'Open AR balance', [lyLabel]: ly.openArBalance, [cyLabel]: cy.openArBalance },
      {
        Metric: `Open AR claimed this year (${currentYear})`,
        [lyLabel]: '',
        [cyLabel]: openArByClaimYear.claimedThisYear,
      },
      {
        Metric: `Open AR claimed previous year (${lastYear})`,
        [lyLabel]: '',
        [cyLabel]: openArByClaimYear.claimedPreviousYear,
      },
      ...(openArByClaimYear.claimedEarlier !== 0
        ? [
            {
              Metric: `Open AR claimed before ${lastYear}`,
              [lyLabel]: '',
              [cyLabel]: openArByClaimYear.claimedEarlier,
            },
          ]
        : []),
      { Metric: 'Deductions received', [lyLabel]: ly.deductionsReceived, [cyLabel]: cy.deductionsReceived },
      { Metric: 'Recovered', [lyLabel]: ly.recovered, [cyLabel]: cy.recovered },
      { Metric: 'Lost', [lyLabel]: lyPl.writeOffTotal, [cyLabel]: cyPl.writeOffTotal },
      { Metric: 'Identified actual shortage (SHO)', [lyLabel]: ly.actualShortage, [cyLabel]: cy.actualShortage },
      { Metric: 'COM write-off portion', [lyLabel]: lyPl.comWriteOff, [cyLabel]: cyPl.comWriteOff },
      { Metric: 'COM with Clearing Date', [lyLabel]: lyPl.refuseToPay, [cyLabel]: cyPl.refuseToPay },
      { Metric: 'Recovery rate (%)', [lyLabel]: ly.recoveryRate, [cyLabel]: cy.recoveryRate },
    ],
  };

  const supplementalExport: SectionExport = {
    filename: xlsxName('shortage-supplemental'),
    headers: ['Item', 'Amount', 'Lines'],
    rows: [
      ...(cy.excluded !== 0
        ? [{ Item: `Excluded offsets (${excludedCodesLabel()})`, Amount: cy.excluded, Lines: '' }]
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
        subtitle={`${lyLabel} vs ${cyLabel} · ${rangeLabel}, cut off at ${longDate(asOf)}`}
        sectionExport={kpiExport}
      >
        <div className="grid grid-5 kpi-grid">
          <KpiCard
            label="Open AR balance"
            value={compactMoney(cy.openArBalance)}
            tone="info"
            current={cy.openArBalance}
            previous={ly.openArBalance}
            footnote={[
              `Uncleared as of ${longDate(asOf)}`,
              `Open claimed this year (${currentYear}): ${money(openArByClaimYear.claimedThisYear)}`,
              `+ Open claimed previous year (${lastYear}): ${money(openArByClaimYear.claimedPreviousYear)}`,
              ...(openArByClaimYear.claimedEarlier !== 0
                ? [`+ Open claimed before ${lastYear}: ${money(openArByClaimYear.claimedEarlier)}`]
                : []),
            ].join('\n')}
          />
          <KpiCard
            label="Deductions received"
            value={compactMoney(cy.deductionsReceived)}
            tone="primary"
            current={cy.deductionsReceived}
            previous={ly.deductionsReceived}
            footnote={`${count(cy.rowCount)} lines · excludes ${excludedCodesLabel()}`}
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
            label="Lost"
            value={compactMoney(cyPl.writeOffTotal)}
            tone="danger"
            current={cyPl.writeOffTotal}
            previous={lyPl.writeOffTotal}
            footnote={[
              `${basisLabel(filters.plBasis)} · COM with Clearing Date ${money(cyPl.refuseToPay + cyPl.comWriteOff)}`,
              ...(filters.plBasis === 'clearing'
                ? [
                    `+ ${money(lostPriorYearClaimed)} claimed in previous year (${lastYear}, Claim Date)`,
                  ]
                : []),
            ].join('\n')}
          />
          <KpiCard
            label="Identified actual shortage"
            value={compactMoney(cy.actualShortage)}
            tone="warn"
            current={cy.actualShortage}
            previous={ly.actualShortage}
            footnote={`${basisLabel(filters.basis)} · Ref Key 2 = ${CODIFICATION.actualShortageCode}`}
          />
        </div>
        {filters.basis === 'clearing' && priorYearClaimed > 0 && (
          <div className="note info" style={{ marginTop: 12, marginBottom: 0 }}>
            {money(priorYearClaimed)} amount claimed in the previous year ({lastYear}, Claim Date)
            — included here because Period basis is Clearing Date.
          </div>
        )}
      </SectionCard>

      {(cy.excluded !== 0 || amazon.count > 0) && (
        <SectionCard
          title="Supplemental items"
          subtitle="Held out of headline KPI totals"
          sectionExport={supplementalExport}
          className="card"
        >
          <div className="note info" style={{ marginBottom: 0 }}>
            {cy.excluded !== 0 && (
              <>
                <strong>Identified payback / offsets (excluded):</strong> {money(cy.excluded)} across{' '}
                {excludedCodesLabel()} lines — held out of every KPI above.
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
          subtitle={`Same months in both years (${rangeLabel}), cut off at ${longDate(asOf)}.`}
          sectionExport={{
            filename: xlsxName('shortage-yoy-comparison'),
            headers: ['Metric', lyLabel, cyLabel],
            rows: [
              { Metric: 'Open AR balance', [lyLabel]: ly.openArBalance, [cyLabel]: cy.openArBalance },
              { Metric: 'Deductions received', [lyLabel]: ly.deductionsReceived, [cyLabel]: cy.deductionsReceived },
              { Metric: 'Recovered', [lyLabel]: ly.recovered, [cyLabel]: cy.recovered },
              { Metric: 'Lost', [lyLabel]: lyPl.writeOffTotal, [cyLabel]: cyPl.writeOffTotal },
              {
                Metric: 'Identified actual shortage (SHO)',
                [lyLabel]: ly.actualShortage,
                [cyLabel]: cy.actualShortage,
              },
            ],
          }}
        >
          <Chart config={headlineConfig} className="chart-box tall" />
        </SectionCard>

        <SectionCard
          title="Lost composition"
          subtitle={`WO + COM WO + COM with Clearing Date · on ${basisLabel(filters.plBasis)}.`}
          sectionExport={{
            filename: xlsxName('shortage-lost-composition'),
            headers: ['Component', lyLabel, cyLabel],
            rows: [
              { Component: 'Write-off (WO)', [lyLabel]: lyPl.plainWriteOff, [cyLabel]: cyPl.plainWriteOff },
              { Component: 'COM write-off (COM WO)', [lyLabel]: lyPl.comWriteOff, [cyLabel]: cyPl.comWriteOff },
              {
                Component: 'COM with Clearing Date',
                [lyLabel]: lyPl.refuseToPay,
                [cyLabel]: cyPl.refuseToPay,
              },
              { Component: 'Actual shortage (SHO)', [lyLabel]: lyPl.actualShortage, [cyLabel]: cyPl.actualShortage },
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
          sectionExport={{
            filename: xlsxName('shortage-division-breakdown'),
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
          subtitle={`Selected months only (${rangeLabel}).`}
          sectionExport={{
            filename: xlsxName('shortage-monthly-trend'),
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
          sectionExport={{
            filename: xlsxName('shortage-outcome-split'),
            headers: ['Outcome', 'Amount', 'Lines'],
            rows: outcomes.map((o) => ({ Outcome: o.name, Amount: o.value, Lines: o.count })),
          }}
        >
          <Chart config={outcomeChart} className="chart-box short" />
        </SectionCard>

        <SectionCard
          title="Open item buckets"
          subtitle="Potential lost vs recoverable vs pending analysis."
          sectionExport={{
            filename: xlsxName('shortage-open-buckets'),
            headers: ['Bucket', 'Amount', 'Lines'],
            rows: openBuckets.map((o) => ({ Bucket: o.name, Amount: o.value, Lines: o.count })),
          }}
        >
          <Chart config={openBucketChart} className="chart-box short" />
        </SectionCard>

        <SectionCard
          title="Open items by dispute status"
          subtitle="SAP status mapped to management labels."
          sectionExport={{
            filename: xlsxName('shortage-dispute-status'),
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
          sectionExport={{
            filename: xlsxName('shortage-customer-comparison'),
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
          sectionExport={{
            filename: xlsxName('shortage-top-open-customers'),
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
