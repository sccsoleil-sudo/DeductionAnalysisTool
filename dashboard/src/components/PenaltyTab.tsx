import { useMemo } from 'react';
import { CODIFICATION, PENALTY_CATEGORY_ORDER } from '../config/codification';
import { compactMoney, count, longDate, money } from '../lib/format';
import {
  byDivision,
  byPenaltyCategory,
  customerComparison,
  inYtd,
  monthlySeries,
  periodTotals,
  sum,
  type Filters,
} from '../lib/metrics';
import type { ClaimRow } from '../lib/types';
import { Chart, PALETTE, comparisonConfig, doughnutConfig, monthlyConfig } from './Chart';
import { KpiCard } from './KpiCard';
import { CustomerTable } from './CustomerTable';
import { SectionCard } from './SectionCard';
import type { CsvExport } from './DownloadCsvButton';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface PenaltyTabProps {
  rows: ClaimRow[];
  filters: Filters;
}

export function PenaltyTab({ rows, filters }: PenaltyTabProps) {
  const { asOf, basis } = filters;
  const currentYear = asOf.getFullYear();
  const lastYear = currentYear - 1;
  const cyLabel = `${currentYear} YTD`;
  const lyLabel = `${lastYear} YTD`;

  const cy = useMemo(() => periodTotals(rows, asOf, currentYear, basis), [rows, asOf, currentYear, basis]);
  const ly = useMemo(() => periodTotals(rows, asOf, lastYear, basis), [rows, asOf, lastYear, basis]);

  const cyRows = useMemo(
    () => rows.filter((r) => inYtd(r, asOf, currentYear, basis)),
    [rows, asOf, currentYear, basis],
  );
  const lyRows = useMemo(
    () => rows.filter((r) => inYtd(r, asOf, lastYear, basis)),
    [rows, asOf, lastYear, basis],
  );

  const catCy = useMemo(() => byPenaltyCategory(cyRows), [cyRows]);
  const catLy = useMemo(() => byPenaltyCategory(lyRows), [lyRows]);

  const closedTotalCy = useMemo(() => sum(catCy, (c) => c.value), [catCy]);
  const closedTotalLy = useMemo(() => sum(catLy, (c) => c.value), [catLy]);

  const categoryConfig = useMemo(() => {
    const labels = PENALTY_CATEGORY_ORDER.filter(
      (l) => catCy.some((c) => c.name === l) || catLy.some((c) => c.name === l),
    );
    const cyMap = new Map(catCy.map((c) => [c.name, c.value]));
    const lyMap = new Map(catLy.map((c) => [c.name, c.value]));
    return comparisonConfig(
      labels,
      labels.map((l) => lyMap.get(l) ?? 0),
      labels.map((l) => cyMap.get(l) ?? 0),
      lyLabel,
      cyLabel,
    );
  }, [catCy, catLy, lyLabel, cyLabel]);

  const categoryMixConfig = useMemo(
    () =>
      doughnutConfig(
        catCy.map((c) => c.name),
        catCy.map((c) => c.value),
      ),
    [catCy],
  );

  const divisionCy = useMemo(() => byDivision(cyRows), [cyRows]);
  const divisionLy = useMemo(() => byDivision(lyRows), [lyRows]);

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

  const monthlyLy = useMemo(() => monthlySeries(rows, lastYear, basis), [rows, lastYear, basis]);
  const monthlyCy = useMemo(() => monthlySeries(rows, currentYear, basis), [rows, currentYear, basis]);

  const monthlyChart = useMemo(
    () => monthlyConfig(monthlyLy, monthlyCy, String(lastYear), String(currentYear)),
    [monthlyLy, monthlyCy, lastYear, currentYear],
  );

  const topCustomers = useMemo(
    () => customerComparison(rows, asOf, currentYear, basis, 10),
    [rows, asOf, currentYear, basis],
  );

  const largestCategory = catCy[0];

  const categoryLabels = PENALTY_CATEGORY_ORDER.filter(
    (l) => catCy.some((c) => c.name === l) || catLy.some((c) => c.name === l),
  );

  const kpiCsv: CsvExport = {
    filename: 'penalty-key-metrics',
    headers: ['Metric', lyLabel, cyLabel],
    rows: [
      { Metric: 'Penalties charged', [lyLabel]: ly.deductionsReceived, [cyLabel]: cy.deductionsReceived },
      { Metric: 'Confirmed (closed) penalties', [lyLabel]: closedTotalLy, [cyLabel]: closedTotalCy },
      { Metric: 'Open penalties (excluded)', [lyLabel]: ly.openInPeriod, [cyLabel]: cy.openInPeriod },
      {
        Metric: 'Largest root cause',
        [lyLabel]: catLy[0]?.name ?? '',
        [cyLabel]: largestCategory?.name ?? '',
      },
    ],
  };

  if (rows.length === 0) {
    return <div className="empty">No R16 penalty rows match the current filters.</div>;
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
            label="Penalties charged"
            value={compactMoney(cy.deductionsReceived)}
            tone="primary"
            current={cy.deductionsReceived}
            previous={ly.deductionsReceived}
            footnote={`${count(cy.rowCount)} lines · excludes ${CODIFICATION.excludedRefKey2.join(', ')}`}
          />
          <KpiCard
            label="Confirmed (closed) penalties"
            value={compactMoney(closedTotalCy)}
            tone="danger"
            current={closedTotalCy}
            previous={closedTotalLy}
            footnote="Only closed R16 rows count toward category analytics"
          />
          <KpiCard
            label="Open penalties (excluded)"
            value={compactMoney(cy.openInPeriod)}
            tone="warn"
            current={cy.openInPeriod}
            previous={ly.openInPeriod}
            footnote="Not yet confirmed — held out of all category charts"
          />
          <KpiCard
            label="Largest root cause"
            value={largestCategory ? largestCategory.name : '—'}
            tone="info"
            footnote={
              largestCategory
                ? `${money(largestCategory.value)} · ${
                    closedTotalCy === 0
                      ? '0'
                      : ((largestCategory.value / closedTotalCy) * 100).toFixed(1)
                  }% of confirmed penalties`
                : 'No confirmed penalties in period'
            }
          />
        </div>
      </SectionCard>

      {cy.excluded !== 0 && (
        <SectionCard
          title="Excluded offset rows"
          subtitle="Held out of every penalty figure above"
          csv={{
            filename: 'penalty-excluded-offsets',
            headers: ['Description', 'Amount'],
            rows: [{ Description: `Excluded (${CODIFICATION.excludedRefKey2.join(', ')})`, Amount: cy.excluded }],
          }}
        >
          <div className="note info" style={{ marginBottom: 0 }}>
            <strong>Excluded offset rows:</strong> {money(cy.excluded)} carrying{' '}
            {CODIFICATION.excludedRefKey2.join(', ')} — held out of every penalty figure above.
          </div>
        </SectionCard>
      )}

      <div className="grid grid-2">
        <SectionCard
          title={`Penalty category — ${lyLabel} vs ${cyLabel}`}
          subtitle={`Closed rows only, in fixed business-priority order. Cut off at ${longDate(asOf)}.`}
          csv={{
            filename: 'penalty-category-comparison',
            headers: ['Category', lyLabel, cyLabel],
            rows: categoryLabels.map((label) => ({
              Category: label,
              [lyLabel]: catLy.find((c) => c.name === label)?.value ?? 0,
              [cyLabel]: catCy.find((c) => c.name === label)?.value ?? 0,
            })),
          }}
        >
          <Chart config={categoryConfig} className="chart-box tall" />
        </SectionCard>

        <SectionCard
          title={`Root cause mix — ${cyLabel}`}
          subtitle="Share of confirmed penalty value by category."
          csv={{
            filename: 'penalty-root-cause-mix',
            headers: ['Category', 'Amount', 'Lines', 'Share (%)'],
            rows: catCy.map((c) => ({
              Category: c.name,
              Amount: c.value,
              Lines: c.count,
              'Share (%)':
                closedTotalCy === 0 ? 0 : Number(((c.value / closedTotalCy) * 100).toFixed(1)),
            })),
          }}
        >
          <Chart config={categoryMixConfig} className="chart-box tall" />
        </SectionCard>
      </div>

      <div className="grid grid-2">
        <SectionCard
          title="Division breakdown"
          subtitle="Includes open rows, so it reconciles to penalties charged."
          csv={{
            filename: 'penalty-division-breakdown',
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
          title="Monthly penalty trend"
          subtitle="Full calendar year, both periods."
          csv={{
            filename: 'penalty-monthly-trend',
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

      <div className="grid grid-2">
        <SectionCard
          title={`Customers — ${lyLabel} vs ${cyLabel}`}
          subtitle="Ranked by current-period penalty value."
          csv={{
            filename: 'penalty-customer-comparison',
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
          title={`Category detail — ${cyLabel}`}
          subtitle="Confirmed penalties by root cause."
          csv={{
            filename: 'penalty-category-detail',
            headers: ['Category', 'Lines', lyLabel, cyLabel, 'Share (%)'],
            rows: catCy.map((cat) => {
              const previous = catLy.find((c) => c.name === cat.name)?.value ?? 0;
              return {
                Category: cat.name,
                Lines: cat.count,
                [lyLabel]: previous,
                [cyLabel]: cat.value,
                'Share (%)':
                  closedTotalCy === 0 ? 0 : Number(((cat.value / closedTotalCy) * 100).toFixed(1)),
              };
            }),
          }}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Lines</th>
                  <th className="num">{lyLabel}</th>
                  <th className="num">{cyLabel}</th>
                  <th className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                {catCy.map((cat) => {
                  const previous = catLy.find((c) => c.name === cat.name)?.value ?? 0;
                  return (
                    <tr key={cat.name}>
                      <td>{cat.name}</td>
                      <td className="num">{count(cat.count)}</td>
                      <td className="num">{money(previous)}</td>
                      <td className="num">{money(cat.value)}</td>
                      <td className="num">
                        {closedTotalCy === 0 ? '—' : `${((cat.value / closedTotalCy) * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="legend-row">
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: PALETTE.primary }} />
              Open rows are excluded from this table by design (Section 5).
            </span>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
