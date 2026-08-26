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

  const topCustomers = useMemo(
    () => customerComparison(rows, asOf, currentYear, basis, 10),
    [rows, asOf, currentYear, basis],
  );

  const largestCategory = catCy[0];

  if (rows.length === 0) {
    return <div className="empty">No R16 penalty rows match the current filters.</div>;
  }

  return (
    <>
      <div className="grid grid-4">
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

      {cy.excluded !== 0 && (
        <div className="note info">
          <strong>Excluded offset rows:</strong> {money(cy.excluded)} carrying{' '}
          {CODIFICATION.excludedRefKey2.join(', ')} — held out of every penalty figure above.
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Penalty category — {lyLabel} vs {cyLabel}</div>
          <div className="card-sub">
            Closed rows only, in fixed business-priority order. Cut off at {longDate(asOf)}.
          </div>
          <Chart config={categoryConfig} className="chart-box tall" />
        </div>

        <div className="card">
          <div className="card-title">Root cause mix — {cyLabel}</div>
          <div className="card-sub">Share of confirmed penalty value by category.</div>
          <Chart config={categoryMixConfig} className="chart-box tall" />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Division breakdown</div>
          <div className="card-sub">Includes open rows, so it reconciles to penalties charged.</div>
          <Chart config={divisionConfig} />
        </div>

        <div className="card">
          <div className="card-title">Monthly penalty trend</div>
          <div className="card-sub">Full calendar year, both periods.</div>
          <Chart config={monthlyChart} />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Customers — {lyLabel} vs {cyLabel}</div>
          <div className="card-sub">Ranked by current-period penalty value.</div>
          <CustomerTable rows={topCustomers} lyLabel={lyLabel} cyLabel={cyLabel} />
        </div>

        <div className="card">
          <div className="card-title">Category detail — {cyLabel}</div>
          <div className="card-sub">Confirmed penalties by root cause.</div>
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
        </div>
      </div>
    </>
  );
}
