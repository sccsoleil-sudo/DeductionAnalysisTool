# Logistics Master Dashboard — Specification

Requirements and codification rules for the Logistics Master Dashboard, which reads deduction and
claim data from a SAP Excel export and produces KPI metrics, charts and management views.

> Converted from `LOrealGPT_New Conversation (1).docx`. The conversation wrapper and the duplicated
> copy of the rules have been dropped; everything Janet specified is preserved below.
>
> The dashboard is implemented in [`dashboard/`](./dashboard/README.md). Sections 1–14 here restate
> the *Codification Rule — Instruction Book*; that file also carries a Section 15 FAQ, which is not
> repeated here to avoid two copies drifting apart.

---

## Reporting requirements

The shortage (R02) report compares **last year vs current year YTD** across four measures:

| Measure | Definition |
| --- | --- |
| **Open AR balance** | Items with no Clearing Date and no Clearing Journal Entry. |
| **Deductions received** | Total deduction amount, excluding `XXX`, `XXXX` and `PMT`. |
| **Recovered** | Per the codification in Section 4. |
| **Write-off** | Cleared Lost: codes containing `WO`, plus cleared `COM*` (refuse to pay). The COM / COM WO portions are marked out separately. |

Penalties and fines (R16) — referred to as "violations" — form the second report.

Division breakdown covers CPD, LDB, LPD and PPD (Section 9).

**Design constraint.** Write-off, COM write-off, recovery and the excluded deduction codes are
internal business classifications. The app reads them from a configuration file rather than
hard-coding them, so when Finance changes a code list only that file needs editing.

---

## Section 1 — Overview

The dashboard reads an Excel file (`.xlsx` or `.xls`), stores it in a local database, and produces
KPI metrics, charts and management views.

```
Excel Upload → Normalize Columns → Compute Open/Closed → Save to Database
             → Classify Outcomes → Dashboard KPIs
```

Two primary report tabs:

| Tab | Reason Code | What it tracks |
| --- | --- | --- |
| Shortage Claims | `R02` | Customer deductions for shipping shortages — outcomes: Recovered, Lost, Actual Shortage, Open |
| Penalties & Fines | `R16` | Compliance penalties (Fill Rate, EDI, DC Charges, Delivery, Commercial) — closed items only |

> **Key rule.** Every row must have a valid Reason Code. Rows without a matching code appear in
> neither tab.

---

## Section 2 — Required Excel columns

SAP-style column names are expected exactly as listed. Names are stripped of leading and trailing
spaces but are otherwise case-sensitive.

| Column | Required? | Description |
| --- | --- | --- |
| `Reason Code` | **Required** | Must be `R02`, `R16` or `R17`. Determines which tab the row appears in. |
| `Reference Key 2` | **Required** | Subcategory code. Drives outcome classification. See Sections 4–5. |
| `Amount (CoCode Crcy)` | **Required** | Deduction/penalty amount in company code currency. |
| `Customer Name` | **Required** | Used for filtering, customer overview and Top 5 charts. |
| `Journal Entry Date` | **Required** | Claim entry date. Drives all time-based filtering and period reports. |
| `Business Area` | Recommended | Division code (e.g. `02AA`). Needed for the division filter and breakdown charts. |
| `Clearing Status` | Recommended | Numeric. `1` = open, `0` = closed. Primary source for open/closed logic. |
| `Clearing Journal Entry` | Recommended | Fallback for open/closed: blank = open, populated = closed. |
| `Clearing Date` | Recommended | Date the item was cleared. Used in historical period-snapshot reports. |
| `Dispute Status` | Recommended | Open-item status (e.g. "Under Review", "Not Justified", "New"). |
| `Assignment` | Optional | Part of the unique row identifier. Also identifies Amazon rows by customer number. |
| `Payment Reference` | Optional | Part of the unique row identifier. |
| `Invoice Reference` | Optional | Part of the unique row identifier. |
| `Journal Entry` | Optional | Part of the unique row identifier. |
| `Item Text` | Optional | Row description, shown in management detail views. |
| `Dispute Reason` | Optional | Reason for dispute. Stored and displayed in management views. |

> **Multi-sheet files.** All sheets are concatenated into a single dataset. Every sheet must use the
> same column names.

---

## Section 3 — Reason codes

| Reason Code | Tab | Description |
| --- | --- | --- |
| `R02` | Shortage Claims | Short-shipped deduction claims. Tracked through Recovered / Lost / Actual Shortage / Open. The primary reporting tab. |
| `R16` | Penalties & Fines | Compliance penalty charges, categorized by root cause. Only **closed** rows count in penalty analytics. |
| `R17` | Supplemental (Amazon only) | Potential shortage claims from Amazon. Not a standalone tab — a supplemental KPI card on the R02 view. |

> **Important.** Reason codes are stored and compared in UPPERCASE. Values like `r02` or `R 02`
> (with a space) will not match. Ensure no leading or trailing spaces.

---

## Section 4 — Reference Key 2, R02 shortage claims

For R02 rows, `Reference Key 2` drives the outcome classification.

| Code | Label | Outcome | When to use |
| --- | --- | --- | --- |
| `PAYBACK` or *blank* | Payback | **Recovered** | Customer agreed to repay. A blank value on a closed item is treated as Payback. |
| `RET` | Return | **Recovered** | Goods physically returned to the warehouse. |
| `RT` | Return | **Recovered** | Alternative return code, same outcome as `RET`. |
| `R1R2` | Dummy PO | **Recovered** | Claim resolved via a dummy purchase order arrangement. |
| `COM` or `COM*` | Refuse to Pay | **Lost** | Customer refuses to pay. Any code beginning with `COM` (e.g. `COMM`, `COM01`). |
| contains `WO` | Write Off | **Lost** | Written off internally. Any code containing `WO` (e.g. `WO`, `WO01`). |
| `SHO` | Shortage | **Actual Shortage** | Confirmed real shortage — goods genuinely not shipped. A separate financial reserve outcome. |
| `PMT` | Payback Offset | *Excluded* | Payment offset row used for netting. Excluded from all KPIs. See Section 12. |

> **Open items.** If a row is open, `Reference Key 2` is ignored for outcome classification — the row
> counts under "Open (Actionable)" regardless of its code. An outcome is only assigned once the item
> is closed.

### R02 classification summary

| Outcome | Codes | Meaning |
| --- | --- | --- |
| Recovered | `""`, `PAYBACK`, `RET`, `RT`, `R1R2` | Money was recovered from the customer |
| Lost | `COM*`, `*WO*` | The deduction was not recoverable |
| Actual Shortage | `SHO` | Confirmed real shortage, reserved separately |
| Open | *any code, if the row is open* | Still in dispute, not yet resolved |

---

## Section 5 — Reference Key 2, R16 penalties & fines

For R16 rows, `Reference Key 2` determines the penalty category. Only closed rows count.

| Code | Category | When to use |
| --- | --- | --- |
| `FR` | Fill Rate | Order fill rate fell below the contractual threshold. |
| `EDI` | EDI | EDI compliance failures (incorrect or late ASN, PO acknowledgement errors). |
| `PREP` | DC Charges | Distribution centre preparation/handling charges applied by the customer. |
| `SHIP` | Delivery | Delivery compliance — late delivery, wrong carrier, routing violations. |
| `KAM` | Commercial | Commercial/contractual deductions agreed at account level. |
| *blank or unknown* | Unclassified | No recognized code. |
| `XXX` | *Excluded* | Internal noise/offset rows. Excluded from all R16 analytics (the R16 equivalent of `PMT`). |

> **Display order.** Categories always appear in this fixed order, reflecting business priority for
> root-cause analysis: Fill Rate → EDI → DC Charges → Delivery → Commercial → Unclassified.

> **Open R16 rows** are completely excluded from penalty analytics. Only assign R16 once the penalty
> is confirmed and cleared.

---

## Section 6 — Open vs. closed logic

Determined automatically from two possible columns, in priority order:

| Priority | Column | Open | Closed |
| --- | --- | --- | --- |
| 1st | `Clearing Status` | `1` | `0` |
| 2nd | `Clearing Journal Entry` | blank / null | has a journal entry number |
| Fallback | *neither column present* | all rows treated as open | — |

> **Best practice.** Always include `Clearing Status` — it is the most reliable and explicit marker.
> If you rely on `Clearing Journal Entry` instead, make sure it is populated for every closed item
> and truly blank for every open one (watch for formula zeros and placeholder text).

### Impact on calculations

- **Open items** contribute to *Open (Actionable)* in total exposure. Their `Reference Key 2` does
  not affect outcome classification.
- **Closed items** are classified by `Reference Key 2` into Recovered / Lost / Actual Shortage.
- **Recovery rate** uses closed items only, so it is unaffected by how many items remain open.
- **R16 penalties**: open rows are excluded from all penalty totals and charts.

---

## Section 7 — Outcome classification rules

### R02 decision tree

1. Is the row **open**? → **Open (Actionable)**. Stop.
2. Is `Reference Key 2` in `{"", "PAYBACK", "RET", "RT", "R1R2"}`? → **Recovered**
3. Does it **start with** `COM`? → **Lost**
4. Does it **contain** `WO`? → **Lost**
5. Is it exactly `SHO`? → **Actual Shortage**
6. Anything else? → **Unclassified** (review and update)

### R16 decision tree (closed only)

1. Is `Reference Key 2` in `{"", "PAYBACK", "RET", "RT", "R1R2"}`? → **Recovered**
2. Does it start with `COM`? → **Lost**
3. Does it contain `WO`? → **Lost**
4. Otherwise → categorized by penalty category code (`FR`, `EDI`, `PREP`, `SHIP`, `KAM`)

> **User overrides.** Analysts can override any item's classification in the Shortage Management or
> Penalties Management tab. Overrides are stored and take precedence over the coded value in
> subsequent uploads.

---

## Section 8 — Recovery rate

Measures how much of the **closed** claim value has been recovered. Open items are not included.

```
Recovery Rate = Recovered (closed) ÷ (Recovered + Lost + Actual Shortage) × 100
```

| Component | Included? | Reason |
| --- | --- | --- |
| Recovered (closed) | Yes | Numerator and denominator |
| Lost (closed) | Denominator only | Part of the closed universe |
| Actual Shortage (closed) | Denominator only | Part of the closed universe |
| Open (Actionable) | No | Not yet resolved — excluded to avoid distortion |
| PMT / payback offsets | No | Excluded from all KPIs |

Example: closed items of $4.8M recovered, $0.28M lost, $0.03M actual shortage give
4.8 ÷ (4.8 + 0.28 + 0.03) = **87.7%**.

---

## Section 9 — Division codes

| Business Area | Division |
| --- | --- |
| `02AA` | CPD |
| `02AB` | PPD |
| `02AC` | LPD |
| `02AD` | LDB |

> **Unknown codes.** Any other value will not appear in the division filter or breakdown charts.
> Rows with an unrecognized or blank Business Area are still included in totals but are not
> attributed to a division.

---

## Section 10 — Amazon R17, potential shortage

R17 rows are potential shortage claims from Amazon, identified but not yet formally charged. They
appear as a supplemental card on the R02 dashboard, not a standalone tab.

The card only appears when Amazon is included in the customer filter. Amazon rows are identified by
either:

- `Customer Name` contains `AMAZON` (case-insensitive), **or**
- `Assignment` contains the customer number `10118507`

### Coding R17 rows

| Column | Value |
| --- | --- |
| `Reason Code` | `R17` |
| `Customer Name` | Must include "Amazon", or use the customer number in `Assignment` |
| `Reference Key 2` | Same R02 subcategory codes (e.g. `SHO`, `PAYBACK`) — R02 labels are applied |

> R17 rows are **never included** in R02 shortage totals. They are tracked separately as a
> forward-looking risk indicator.

---

## Section 11 — Baseline vs. regular refresh

Two upload modes. The difference matters for preserving historical comparison data.

| | Set Baseline | Upload & Refresh |
| --- | --- | --- |
| **What it does** | Replaces the reference snapshot used to detect new/changed claims | Loads the latest data and compares it against the existing baseline |
| **When to use** | Starting a new tracking period, after major data corrections, or for the initial dataset | Routine weekly/monthly updates — the most common upload |
| **Baseline reset** | Yes, previous baseline is wiped and replaced | No, existing baseline is preserved |
| **New/Updated/Removed counters** | Reset to 0 (no comparison at baseline time) | Calculated by diffing against baseline |

### Auto-baseline by filename

A file named `LogisticsMasterV1.xlsx` — or any variation whose letters and digits spell out
`logisticsmasterv1` — is treated as a baseline regardless of which button was used.

> **Clear Baseline** erases the current baseline. After clearing, the next upload automatically
> becomes the new baseline.

### Missing rows during a refresh

- **R02 rows** present in the baseline but absent from the new upload are synthesized as cleared —
  re-added with `is_open=0` and status "Cleared", so they do not vanish from history.
- **Non-R02 rows** that go missing are counted as removed.

---

## Section 12 — PMT / payback offset rows

Rows with `Reference Key 2 = PMT` are payment-offset rows: a negative amount that nets against the
gross deduction in the same payment batch.

| Where | Treatment |
| --- | --- |
| All KPI totals (Recovered, Lost, Shortage, Open) | Excluded |
| Donut and bar charts | Excluded |
| Header KPI — "Total Received Claim" | Excluded (gross total of non-PMT lines shown) |
| Header — "Identified Payback (excluded)" | PMT total shown as an informational footnote |

> **Do not use PMT as a general code.** It is a system-reserved exclusion code. Only SAP-generated
> payment offset entries should carry it — using it for anything else makes those rows disappear from
> every dashboard metric.

The equivalent exclusion code for R16 is `XXX`.

---

## Section 13 — Status & dispute classification

For **open R02 items**, `Dispute Status` drives the status breakdown chart.

| Raw value | Dashboard label | Meaning |
| --- | --- | --- |
| `Not Justified` | To Be Paid | Customer acknowledged the claim and agreed to pay |
| `Under Review` | With Client | Under discussion or analysis by the customer |
| `New` | To Analyze (Internal) | Newly received, not yet reviewed internally |
| `Closed` | Closed | Marked closed in the dispute system (item should also be cleared) |
| *blank / unknown* | Unclassified | No status assigned |

### Open item sub-buckets (period summary donuts)

| Bucket | Rule |
| --- | --- |
| Potential Lost | Open item with `Reference Key 2` starting with `COM` or containing `WO` |
| Recoverable | Dispute Status is `Under Review` or `Not Justified` |
| Pending – In Analysis | Everything else (`New`, blank, or unrecognized) |

---

## Section 14 — Upload workflow

### Routine monthly update

1. Export the latest claims data from SAP as `.xlsx`.
2. Verify column names match Section 2.
3. Ensure `Reason Code` values are `R02`, `R16` or `R17` in uppercase.
4. Ensure `Reference Key 2` uses only the approved codes from Sections 4 and 5.
5. Ensure `Clearing Status` is `1` (open) or `0` (closed) for every row.
6. Click **↑ Upload & Refresh**.
7. Select the file. The dashboard updates automatically.

### Initial setup / baseline reset

1. Prepare the full historical dataset as `.xlsx`.
2. Click **Set Baseline** (or name the file `LogisticsMasterV1.xlsx` and use Upload & Refresh).
3. Confirm the baseline name appears in the header.

> **File format.** Both `.xlsx` and `.xls` are supported. CSV is not.

---

## Appendix — How the current export differs

Observed in `Logistics master data Final 202501 TO 202607.xlsx` (39,366 rows, Apr 2024 – Aug 2026).
The implementation handles each of these; recorded here so the spec and the data can be reconciled.

| Spec says | The file actually has | How it is handled |
| --- | --- | --- |
| `Clearing Status` is the primary open/closed source | The column does not exist | Falls back to the Section 6 rule — blank `Clearing Date` **and** blank `Clearing Journal Entry` means open. The two columns agree on all 39,366 rows, so the fallback is reliable. |
| `PMT` excluded for R02, `XXX` for R16 | `PMT`, `XXX` and `XXXX` all appear under both reason codes | All three are excluded uniformly, matching the stated requirement to exclude "XXX, XXXX and PMT". |
| Section 7 tests the `COM` prefix before the `WO` substring | 43 rows are coded `COM WO` | `WO` is tested first so the COM portion of the write-off can be reported separately. Totals are identical either way — `COM WO` is Lost under both readings. |
| Sheets share one column layout | Sheets `Piv` and `Sheet4` are pivot tables | Any sheet missing the four required columns is skipped automatically. |
| `Reference Key 2` uses only approved codes | One R16 row is coded `DIF` | Reported as Unclassified in the Data Quality tab. |
| `Business Area` uses the four division codes | 13 rows are blank | Included in totals but not attributed to a division, per Section 9. |

Open AR balance is computed as a **point-in-time snapshot** — booked on or before the as-of date and
not cleared by that date — so the prior-year figure is the balance as it stood a year ago rather than
today's open items filtered by year. This is what makes the year-on-year comparison meaningful.
