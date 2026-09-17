# Logistics Master Dashboard

A browser-based analysis app for L'Oréal Canada logistics deduction and penalty data. Upload the SAP
export and it produces the shortage (R02) and penalty (R16) reports described in the *Codification
Rule — Instruction Book*.

**The workbook never leaves your machine.** It is parsed in the browser with SheetJS; there is no
server, no upload endpoint and no network call with your data. After upload, the parsed dataset is
saved in your browser (IndexedDB) so a refresh does not wipe it — filters and the active tab are
restored too.

## Running it

```bash
cd dashboard
npm install
npm run dev
```

Then open http://localhost:5173 and drop in the `.xlsx`.

### GitHub Pages

Live site: https://sccsoleil-sudo.github.io/DeductionAnalysisTool/

Pushes to `main` build and publish automatically via Actions. To build the same artifact locally:

```bash
VITE_BASE=/DeductionAnalysisTool/ npm run build
```

To produce a static build you can host on a share or open from disk:

```bash
npm run build      # output in dist/
npm run preview    # serve dist/ locally
```

## What it reports

### Shortage Claims (R02)

The four headline figures, each compared last-year YTD vs current-year YTD over the same calendar
window:

| KPI | Definition |
| --- | --- |
| **Open AR balance** | Booked on or before the as-of date and not cleared by then (no Clearing Date / Clearing Journal Entry). A true point-in-time snapshot, so the prior-year bar is the balance *as it stood* a year ago. |
| **Deductions received** | Total deduction value, excluding `PMT`, `XXX` and `XXXX` offset rows. |
| **Recovered** | Closed items coded blank, `PAYBACK`, `RET`, `RT` or `R1R2`. |
| **Write-off** | Cleared Lost amounts: any code containing `WO`, plus cleared `COM*` (refuse to pay). Open COM stays in Open AR, not Write-off. COM / COM WO portions are broken out on the composition chart. |

Plus: recovery rate, division breakdown, monthly trend, outcome and open-item donuts, dispute-status
split, customer comparison table, and top-5 open exposure. The Amazon R17 potential-shortage figure
appears as a supplemental note and is never rolled into R02 totals.

### Penalties & Fines (R16)

Penalties charged, confirmed (closed) penalties, open penalties held out of analytics, and the
largest root cause — broken down by Fill Rate → EDI → DC Charges → Delivery → Commercial →
Unclassified in the fixed business-priority order, with a year-on-year comparison and category table.

### Data Quality

Lists every `Reference Key 2` in the file with how it was classified, flags unrecognized codes and
unmapped Business Areas, and shows which columns the open/closed decision was actually based on.
This is the tab to check first when a total looks wrong.

## Filters

Division, customer, YTD as-of date, and **period basis** — whether a claim belongs to a period by
its `Journal Entry Date` (when the deduction was claimed, the default) or its `Clearing Date` (when
it was settled). The two answer different questions; the basis is stated at the bottom of every view.

## Codification rules

Every business code lives in `src/config/codification.ts`. Nothing else in the app hard-codes one, so
when Finance changes a code list you edit that file and nothing else.

```ts
excludedRefKey2: ['PMT', 'XXX', 'XXXX'],
recoveredRefKey2: ['', 'PAYBACK', 'RET', 'RT', 'R1R2'],
writeOffContains: 'WO',
refuseToPayPrefix: 'COM',
actualShortageCode: 'SHO',
```

### Two deviations from the instruction book, and why

1. **`COM WO` is its own bucket.** Section 7 tests the `COM` prefix before the `WO` substring, which
   makes both *Lost*. The app tests `WO` first so `COM WO` can be reported separately. Every total is
   identical either way — `COM WO` is Lost under both readings — but it lets the Write-off view show
   the COM portion separately, which is what was asked for.

2. **`XXX` and `XXXX` are excluded from R02 as well as R16.** The book scopes `PMT` to R02 and `XXX`
   to R16, but the real export carries all three codes in both. The exclusion list is applied
   uniformly.

Also note the book expects a `Clearing Status` column. The current export does not have one, so the
app falls back to the documented rule — blank Clearing Date *and* blank Clearing Journal Entry means
open — and says so in the Data Quality tab. In the sample file the two columns agree on all 39,366
rows.

## Baseline vs refresh

*Set Baseline* stores a snapshot in the browser's `localStorage` (a compact hash per row, not the
data itself). Later uploads diff against it and the header shows new / changed / removed counts.
A file named `logisticsmasterv1.xlsx` becomes a baseline automatically. *Clear Baseline* discards the
snapshot; the next upload becomes the new one.

Because it is `localStorage`, the baseline is per-browser and per-machine. Sharing one baseline
across a team would need a backend.

## Verifying the numbers

Two independent implementations compute the same KPIs, which is how the rules were validated:

```bash
npm run verify -- "../Logistics master data Final 202501 TO 202607.xlsx"   # the app's own TypeScript, in Node
python tools/reference_calc.py "../Logistics master data Final 202501 TO 202607.xlsx"  # separate pandas implementation
```

They agree to the cent on the sample file. Re-run both after changing any codification rule.

## Reading the input

Sheets are concatenated, and any sheet missing `Reason Code`, `Amount (CoCode Crcy)`,
`Customer Name` or `Journal Entry Date` is skipped — so pivot and scratch tabs in the workbook are
ignored without needing to be deleted first. Header names are trimmed but otherwise matched exactly,
per the instruction book.

## Stack

Vite 6 · React 18 · TypeScript · Chart.js 4 · SheetJS 0.20.3 (installed from the SheetJS CDN, since
the `xlsx` package on npm is abandoned at a version with known vulnerabilities).
