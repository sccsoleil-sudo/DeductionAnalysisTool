/**
 * Runs the dashboard's real parsing + metrics code over a workbook in Node and
 * prints the KPIs, so numbers can be diffed against Finance's own figures.
 *
 *   npm run verify -- "../Logistics master data Final 202501 TO 202607.xlsx"
 */

import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { CODIFICATION, excludedCodesLabel } from '../src/config/codification';
import { parseWorkbook } from '../src/lib/parseWorkbook';
import {
  byPenaltyCategory,
  byDivision,
  defaultMonths,
  inPeriod,
  latestJournalDate,
  periodTotals,
  type Filters,
} from '../src/lib/metrics';
import type { ClaimRow } from '../src/lib/types';

const target = process.argv[2] ?? '../Logistics master data Final 202501 TO 202607.xlsx';
const path = resolve(process.cwd(), target);

const fmt = (n: number) =>
  n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(16);

const buffer = await readFile(path);
const file = new File([buffer], basename(path));
const parse = await parseWorkbook(file);

console.log(`file            : ${parse.fileName}`);
console.log(`sheets used     : ${parse.sheetsUsed.join(', ')}`);
console.log(`sheets skipped  : ${parse.sheetsSkipped.join(' | ') || 'none'}`);
console.log(`rows loaded     : ${parse.rows.length.toLocaleString()}`);
console.log(`open/closed via : ${parse.openClosedSource}`);
for (const w of parse.warnings) console.log(`  [${w.level}] ${w.message}`);

const asOf = latestJournalDate(parse.rows);
const currentYear = asOf.getFullYear();
const filters: Filters = {
  divisions: [],
  customers: [],
  basis: 'journal',
  plBasis: 'clearing',
  asOf,
  months: defaultMonths(asOf),
};
console.log(`\nas-of           : ${asOf.toISOString().slice(0, 10)}`);

function report(label: string, rows: ClaimRow[]) {
  console.log(`\n${'='.repeat(72)}\n${label}  (${rows.length.toLocaleString()} rows)`);
  for (const year of [currentYear - 1, currentYear]) {
    const t = periodTotals(rows, filters, year);
    console.log(`\n  YTD ${year}`);
    console.log(`    Deductions received (excl ${excludedCodesLabel()}) ${fmt(t.deductionsReceived)}`);
    console.log(`    Recovered                                        ${fmt(t.recovered)}`);
    console.log(`    Lost total (WO + COM WO + COM w/ Clearing Date)  ${fmt(t.writeOffTotal)}`);
    console.log(`       of which COM write-off                        ${fmt(t.comWriteOff)}`);
    console.log(`       of which COM with Clearing Date               ${fmt(t.refuseToPay)}`);
    console.log(`    Actual shortage                                  ${fmt(t.actualShortage)}`);
    console.log(`    Open in period                                   ${fmt(t.openInPeriod)}`);
    console.log(`    Unclassified                                     ${fmt(t.unclassified)}`);
    console.log(`    Excluded (offsets)                               ${fmt(t.excluded)}`);
    console.log(`    Open AR balance                                  ${fmt(t.openArBalance)}`);
    console.log(`    Recovery rate                                    ${t.recoveryRate.toFixed(2).padStart(16)}%`);
    console.log(`    Lines                                            ${String(t.rowCount).padStart(16)}`);
  }

  const cyRows = rows.filter((r) => inPeriod(r, filters, currentYear));
  console.log('\n  Division split (current YTD):');
  for (const d of byDivision(cyRows)) console.log(`    ${d.name.padEnd(10)} ${fmt(d.value)}`);
}

report('R02 SHORTAGE', parse.rows.filter((r) => r.reasonCode === CODIFICATION.reasonCodes.shortage));
report('R16 PENALTIES', parse.rows.filter((r) => r.reasonCode === CODIFICATION.reasonCodes.penalty));

const cyPenalties = parse.rows.filter(
  (r) => r.reasonCode === CODIFICATION.reasonCodes.penalty && inPeriod(r, filters, currentYear),
);
console.log('\n  Penalty categories (closed only, current YTD):');
for (const c of byPenaltyCategory(cyPenalties)) {
  console.log(`    ${c.name.padEnd(14)} ${String(c.count).padStart(6)} ${fmt(c.value)}`);
}
