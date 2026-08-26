import { money } from '../lib/format';
import type { CustomerComparison } from '../lib/metrics';

interface CustomerTableProps {
  rows: CustomerComparison[];
  lyLabel: string;
  cyLabel: string;
}

export function CustomerTable({ rows, lyLabel, cyLabel }: CustomerTableProps) {
  if (rows.length === 0) return <div className="empty">No customer activity in this period.</div>;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th className="num">{lyLabel}</th>
            <th className="num">{cyLabel}</th>
            <th className="num">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td title={row.name}>{row.name.length > 40 ? `${row.name.slice(0, 40)}…` : row.name}</td>
              <td className="num">{money(row.previous)}</td>
              <td className="num">{money(row.current)}</td>
              <td className={`num ${row.delta > 0 ? 'pos' : 'neg'}`}>
                {row.delta > 0 ? '+' : ''}
                {money(row.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
