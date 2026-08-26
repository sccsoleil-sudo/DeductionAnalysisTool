# DeductionAnalysisTool

Browser-based Logistics Master Dashboard for L'Oréal Canada shortage (R02) and penalty (R16) analysis.

Upload a SAP Excel export and get year-on-year YTD KPIs, charts and customer tables. **All processing stays in the browser** — the workbook is never uploaded to a server.

## Quick start

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173 and drop in your `.xlsx`.

## What's in this repo

| Path | Contents |
| --- | --- |
| [`dashboard/`](./dashboard/) | Vite + React + TypeScript app |
| [`Logistics Master Dashboard - Specification.md`](./Logistics%20Master%20Dashboard%20-%20Specification.md) | Requirements and codification rules |
| [`Codification Rule - Instruction Book.html`](./Codification%20Rule%20-%20Instruction%20Book.html) | Original instruction book (includes FAQ) |

Claim data files (`.xlsx`) are intentionally excluded from git.
