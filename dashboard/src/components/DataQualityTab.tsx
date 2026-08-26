import { useMemo } from 'react';
import { CODIFICATION, UNCLASSIFIED } from '../config/codification';
import { classify } from '../lib/classify';
import { count, isoDate, money } from '../lib/format';
import type { ClaimRow, ParseResult } from '../lib/types';

interface DataQualityTabProps {
  parse: ParseResult;
  rows: ClaimRow[];
}

interface CodeStat {
  reasonCode: string;
  refKey2: string;
  outcome: string;
  lines: number;
  amount: number;
  recognized: boolean;
}

export function DataQualityTab({ parse, rows }: DataQualityTabProps) {
  const codeStats = useMemo<CodeStat[]>(() => {
    const map = new Map<string, CodeStat>();
    for (const row of rows) {
      const key = `${row.reasonCode}|${row.refKey2}`;
      // Classify as if closed, so the row shows the code's meaning rather than
      // whichever open/closed state happened to come first.
      const outcome = classify(row.reasonCode, row.refKey2, false);
      const entry = map.get(key) ?? {
        reasonCode: row.reasonCode,
        refKey2: row.refKey2,
        outcome,
        lines: 0,
        amount: 0,
        recognized: outcome !== UNCLASSIFIED,
      };
      entry.lines += 1;
      entry.amount += row.amount;
      map.set(key, entry);
    }
    return [...map.values()].sort(
      (a, b) => Number(a.recognized) - Number(b.recognized) || Math.abs(b.amount) - Math.abs(a.amount),
    );
  }, [rows]);

  const unclassified = codeStats.filter((c) => !c.recognized);
  const unknownDivision = useMemo(
    () => rows.filter((r) => r.division === 'Unknown'),
    [rows],
  );
  const missingDates = useMemo(() => rows.filter((r) => r.journalEntryDate === null), [rows]);

  const dateRange = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const row of rows) {
      const d = row.journalEntryDate;
      if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    return { min, max };
  }, [rows]);

  return (
    <>
      {parse.warnings.map((w, i) => (
        <div key={i} className={`note ${w.level === 'error' ? 'danger' : w.level}`}>
          {w.message}
        </div>
      ))}

      <div className="grid grid-3">
        <div className="card">
          <div className="card-title">File</div>
          <div className="card-sub">{parse.fileName}</div>
          <table>
            <tbody>
              <tr>
                <td>Rows loaded</td>
                <td className="num">{count(rows.length)}</td>
              </tr>
              <tr>
                <td>Sheets used</td>
                <td className="num">{parse.sheetsUsed.join(', ') || '—'}</td>
              </tr>
              <tr>
                <td>Sheets skipped</td>
                <td className="num">{parse.sheetsSkipped.length}</td>
              </tr>
              <tr>
                <td>Journal date range</td>
                <td className="num">
                  {isoDate(dateRange.min)} → {isoDate(dateRange.max)}
                </td>
              </tr>
              <tr>
                <td>Open/closed derived from</td>
                <td className="num">{parse.openClosedSource}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">Issues to review</div>
          <div className="card-sub">Rows that will read oddly on the dashboard.</div>
          <table>
            <tbody>
              <tr>
                <td>Unclassified Reference Key 2</td>
                <td className="num">
                  {unclassified.length === 0 ? (
                    <span className="badge badge-green">none</span>
                  ) : (
                    <span className="badge badge-amber">{count(unclassified.length)} codes</span>
                  )}
                </td>
              </tr>
              <tr>
                <td>Unrecognized Business Area</td>
                <td className="num">
                  {unknownDivision.length === 0 ? (
                    <span className="badge badge-green">none</span>
                  ) : (
                    <span className="badge badge-amber">{count(unknownDivision.length)} lines</span>
                  )}
                </td>
              </tr>
              <tr>
                <td>Unreadable Journal Entry Date</td>
                <td className="num">
                  {missingDates.length === 0 ? (
                    <span className="badge badge-green">none</span>
                  ) : (
                    <span className="badge badge-red">{count(missingDates.length)} lines</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">Active codification</div>
          <div className="card-sub">
            Edit <code>src/config/codification.ts</code> to change any of these.
          </div>
          <table>
            <tbody>
              <tr>
                <td>Excluded codes</td>
                <td className="num">{CODIFICATION.excludedRefKey2.join(', ')}</td>
              </tr>
              <tr>
                <td>Recovered codes</td>
                <td className="num">
                  {CODIFICATION.recoveredRefKey2.map((c) => c || '(blank)').join(', ')}
                </td>
              </tr>
              <tr>
                <td>Write-off marker</td>
                <td className="num">contains “{CODIFICATION.writeOffContains}”</td>
              </tr>
              <tr>
                <td>Refuse-to-pay marker</td>
                <td className="num">starts with “{CODIFICATION.refuseToPayPrefix}”</td>
              </tr>
              <tr>
                <td>Actual shortage</td>
                <td className="num">{CODIFICATION.actualShortageCode}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Every Reference Key 2 in the file</div>
        <div className="card-sub">
          Unrecognized codes are listed first — these are the ones to correct in SAP or add to the
          codification config.
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Reason Code</th>
                <th>Reference Key 2</th>
                <th>Classified as (when closed)</th>
                <th className="num">Lines</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {codeStats.map((stat) => (
                <tr key={`${stat.reasonCode}|${stat.refKey2}`}>
                  <td>{stat.reasonCode}</td>
                  <td>{stat.refKey2 || <em className="muted">(blank)</em>}</td>
                  <td>
                    <span className={`badge ${stat.recognized ? 'badge-gray' : 'badge-amber'}`}>
                      {stat.outcome}
                    </span>
                  </td>
                  <td className="num">{count(stat.lines)}</td>
                  <td className="num">{money(stat.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
