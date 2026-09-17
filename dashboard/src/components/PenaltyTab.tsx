import { useMemo } from 'react';
import {
  CODIFICATION,
  excludedCodesLabel,
  PENALTY_CATEGORY_ORDER,
} from '../config/codification';
import { compactMoney, count, longDate, money, percent } from '../lib/format';
import {
  byDivision,
  byPenaltyCategory,
  claimedInPreviousYear,
  customerComparison,
  inPeriod,
  monthlySeries,
  periodRangeLabel,
  periodTotals,
  sum,
  yearPeriodLabel,
  type Filters,
} from '../lib/metrics';
import type { ClaimRow } from '../lib/types';
import { Chart, PALETTE, comparisonConfig, doughnutConfig, monthlyConfig } from './Chart';
import { KpiCard } from './KpiCard';
import { CustomerTable } from './CustomerTable';
import { SectionCard } from './SectionCard';
import { buildExportFilename } from '../lib/exportSpreadsheet';
import type { SectionExport } from './DownloadExcelButton';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CATEGORY_TONES = ['primary', 'info', 'warn', 'danger', 'accent'] as const;

interface PenaltyTabProps {
  rows: ClaimRow[];
  filters: Filters;
}

export function PenaltyTab({ rows, filters }: PenaltyTabProps) {
  const { asOf } = filters;
  const currentYear = asOf.getFullYear();
  const lastYear = currentYear - 1;
  const cyLabel = yearPeriodLabel(currentYear, filters);
  const lyLabel = yearPeriodLabel(lastYear, filters);
  const rangeLabel = periodRangeLabel(filters);
  const xlsxName = (section: string) => buildExportFilename(section, filters);

  const cy = useMemo(() => periodTotals(rows, filters, currentYear), [rows, filters, currentYear]);
  const priorYearClaimed = useMemo(
    () => claimedInPreviousYear(rows, filters, currentYear),
    [rows, filters, currentYear],
  );

  const cyRows = useMemo(
    () => rows.filter((r) => inPeriod(r, filters, currentYear)),
    [rows, filters, currentYear],
  );
  const lyRows = useMemo(
    () => rows.filter((r) => inPeriod(r, filters, lastYear)),
    [rows, filters, lastYear],
  );

  const catCy = useMemo(() => byPenaltyCategory(cyRows), [cyRows]);
  const catLy = useMemo(() => byPenaltyCategory(lyRows), [lyRows]);
  const catCyMap = useMemo(() => new Map(catCy.map((c) => [c.name, c])), [catCy]);
  const catLyMap = useMemo(() => new Map(catLy.map((c) => [c.name, c.value])), [catLy]);

  const categoryTotalAllCy = useMemo(() => sum(catCy, (c) => c.value), [catCy]);

  const kpiCategories = CODIFICATION.penaltyCategories;
  const categoryTotalCy = useMemo(
    () => kpiCategories.reduce((acc, cat) => acc + (catCyMap.get(cat.label)?.value ?? 0), 0),
    [kpiCategories, catCyMap],
  );
  const categoryTotalLy = useMemo(
    () => kpiCategories.reduce((acc, cat) => acc + (catLyMap.get(cat.label) ?? 0), 0),
    [kpiCategories, catLyMap],
  );
  const categoryTotalCountCy = useMemo(
    () => kpiCategories.reduce((acc, cat) => acc + (catCyMap.get(cat.label)?.count ?? 0), 0),
    [kpiCategories, catCyMap],
  );

  const categoryConfig = useMemo(() => {
    const labels = PENALTY_CATEGORY_ORDER.filter(
      (l) => catCy.some((c) => c.name === l) || catLy.some((c) => c.name === l),
    );
    return comparisonConfig(
      labels,
      labels.map((l) => catLyMap.get(l) ?? 0),
      labels.map((l) => catCyMap.get(l)?.value ?? 0),
      lyLabel,
      cyLabel,
    );
  }, [catCy, catLy, catCyMap, catLyMap, lyLabel, cyLabel]);

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

  const monthlyLy = useMemo(() => monthlySeries(rows, lastYear, filters), [rows, lastYear, filters]);
  const monthlyCy = useMemo(() => monthlySeries(rows, currentYear, filters), [rows, currentYear, filters]);

  const monthlyChart = useMemo(
    () => monthlyConfig(monthlyLy, monthlyCy, String(lastYear), String(currentYear)),
    [monthlyLy, monthlyCy, lastYear, currentYear],
  );

  const topCustomers = useMemo(
    () => customerComparison(rows, filters, currentYear, 10),
    [rows, filters, currentYear],
  );

  const categoryLabels = PENALTY_CATEGORY_ORDER.filter(
    (l) => catCy.some((c) => c.name === l) || catLy.some((c) => c.name === l),
  );

  const kpiExport: SectionExport = {
    filename: xlsxName('penalty-key-metrics'),
    headers: ['Category', lyLabel, cyLabel, 'Share of total (%)'],
    rows: [
      {
        Category: 'Total',
        [lyLabel]: categoryTotalLy,
        [cyLabel]: categoryTotalCy,
        'Share of total (%)': 100,
      },
      ...kpiCategories.map((cat) => {
        const cyVal = catCyMap.get(cat.label)?.value ?? 0;
        return {
          Category: cat.label,
          [lyLabel]: catLyMap.get(cat.label) ?? 0,
          [cyLabel]: cyVal,
          'Share of total (%)':
            categoryTotalCy === 0 ? 0 : Number(((cyVal / categoryTotalCy) * 100).toFixed(1)),
        };
      }),
    ],
  };

  if (rows.length === 0) {
    return <div className="empty">No R16 penalty rows match the current filters.</div>;
  }

  return (
    <>
      <SectionCard
        title="Key metrics"
        subtitle={`${lyLabel} vs ${cyLabel} · by Ref Key 2 (open + closed) · ${rangeLabel}, cut off at ${longDate(asOf)}`}
        sectionExport={kpiExport}
      >
        <div className="grid grid-6 kpi-grid">
          <KpiCard
            label="Total"
            value={compactMoney(categoryTotalCy)}
            tone="primary"
            current={categoryTotalCy}
            previous={categoryTotalLy}
            footnote={`${count(categoryTotalCountCy)} lines · Fill Rate + EDI + DC Charges + Delivery + Commercial`}
          />
          {kpiCategories.map((cat, index) => {
            const cyCat = catCyMap.get(cat.label);
            const cyVal = cyCat?.value ?? 0;
            const lyVal = catLyMap.get(cat.label) ?? 0;
            const share = categoryTotalCy === 0 ? 0 : (cyVal / categoryTotalCy) * 100;
            return (
              <KpiCard
                key={cat.code}
                label={cat.label}
                value={compactMoney(cyVal)}
                tone={CATEGORY_TONES[index % CATEGORY_TONES.length]}
                current={cyVal}
                previous={lyVal}
                footnote={`${count(cyCat?.count ?? 0)} lines · ${percent(share)} of total · code ${cat.code}`}
              />
            );
          })}
        </div>
        <div className="note info" style={{ marginTop: 12, marginBottom: 0 }}>
          Category totals use Ref Key 2 for every R16 line (open and closed)
          {categoryTotalAllCy !== categoryTotalCy && (
            <> · other RF2 buckets {money(categoryTotalAllCy - categoryTotalCy)}</>
          )}
          {' · '}excludes {excludedCodesLabel()}
        </div>
        {filters.basis === 'clearing' && priorYearClaimed > 0 && (
          <div className="note info" style={{ marginTop: 8, marginBottom: 0 }}>
            {money(priorYearClaimed)} amount claimed in the previous year ({lastYear}, Claim Date)
            — included here because Period basis is Clearing Date.
          </div>
        )}
      </SectionCard>

      {cy.excluded !== 0 && (
        <SectionCard
          title="Excluded offset rows"
          subtitle="Held out of every penalty figure above"
          sectionExport={{
            filename: xlsxName('penalty-excluded-offsets'),
            headers: ['Description', 'Amount'],
            rows: [{ Description: `Excluded (${excludedCodesLabel()})`, Amount: cy.excluded }],
          }}
        >
          <div className="note info" style={{ marginBottom: 0 }}>
            <strong>Excluded offset rows:</strong> {money(cy.excluded)} carrying{' '}
            {excludedCodesLabel()} — held out of every penalty figure above.
          </div>
        </SectionCard>
      )}

      <div className="grid grid-2">
        <SectionCard
          title={`Penalty category — ${lyLabel} vs ${cyLabel}`}
          subtitle={`All R16 by Ref Key 2 (open + closed) · ${rangeLabel}, cut off at ${longDate(asOf)}.`}
          sectionExport={{
            filename: xlsxName('penalty-category-comparison'),
            headers: ['Category', lyLabel, cyLabel],
            rows: categoryLabels.map((label) => ({
              Category: label,
              [lyLabel]: catLyMap.get(label) ?? 0,
              [cyLabel]: catCyMap.get(label)?.value ?? 0,
            })),
          }}
        >
          <Chart config={categoryConfig} className="chart-box tall" />
        </SectionCard>

        <SectionCard
          title={`Root cause mix — ${cyLabel}`}
          subtitle="Share of penalty value by Ref Key 2 category."
          sectionExport={{
            filename: xlsxName('penalty-root-cause-mix'),
            headers: ['Category', 'Amount', 'Lines', 'Share (%)'],
            rows: catCy.map((c) => ({
              Category: c.name,
              Amount: c.value,
              Lines: c.count,
              'Share (%)':
                categoryTotalAllCy === 0 ? 0 : Number(((c.value / categoryTotalAllCy) * 100).toFixed(1)),
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
          sectionExport={{
            filename: xlsxName('penalty-division-breakdown'),
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
          subtitle={`Selected months only (${rangeLabel}).`}
          sectionExport={{
            filename: xlsxName('penalty-monthly-trend'),
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
          sectionExport={{
            filename: xlsxName('penalty-customer-comparison'),
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
          subtitle="Penalties by root cause (Ref Key 2; open and closed)."
          sectionExport={{
            filename: xlsxName('penalty-category-detail'),
            headers: ['Category', 'Lines', lyLabel, cyLabel, 'Share (%)'],
            rows: catCy.map((cat) => {
              const previous = catLy.find((c) => c.name === cat.name)?.value ?? 0;
              return {
                Category: cat.name,
                Lines: cat.count,
                [lyLabel]: previous,
                [cyLabel]: cat.value,
                'Share (%)':
                  categoryTotalAllCy === 0 ? 0 : Number(((cat.value / categoryTotalAllCy) * 100).toFixed(1)),
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
                        {categoryTotalAllCy === 0 ? '—' : `${((cat.value / categoryTotalAllCy) * 100).toFixed(1)}%`}
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
              Categories are from Ref Key 2 for every R16 line (open and closed).
            </span>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
