import type { Filters, PeriodBasis } from '../lib/metrics';
import { isoDate } from '../lib/format';

interface FiltersBarProps {
  filters: Filters;
  divisions: string[];
  customers: string[];
  minDate: Date;
  maxDate: Date;
  onChange: (next: Filters) => void;
}

export function FiltersBar({
  filters,
  divisions,
  customers,
  minDate,
  maxDate,
  onChange,
}: FiltersBarProps) {
  function toggleDivision(division: string) {
    const next = filters.divisions.includes(division)
      ? filters.divisions.filter((d) => d !== division)
      : [...filters.divisions, division];
    onChange({ ...filters, divisions: next });
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="filters">
        <div className="field">
          <span className="field-label">Division</span>
          <div className="chip-row">
            <button
              className={`chip${filters.divisions.length === 0 ? ' on' : ''}`}
              onClick={() => onChange({ ...filters, divisions: [] })}
            >
              All
            </button>
            {divisions.map((d) => (
              <button
                key={d}
                className={`chip${filters.divisions.includes(d) ? ' on' : ''}`}
                onClick={() => toggleDivision(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Customer</span>
          <select
            value={filters.customers[0] ?? ''}
            onChange={(e) =>
              onChange({ ...filters, customers: e.target.value ? [e.target.value] : [] })
            }
            style={{ maxWidth: 320 }}
          >
            <option value="">All customers ({customers.length})</option>
            {customers.map((c) => (
              <option key={c} value={c}>
                {c.length > 46 ? `${c.slice(0, 46)}…` : c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field-label">YTD as of</span>
          <input
            type="date"
            value={isoDate(filters.asOf)}
            min={isoDate(minDate)}
            max={isoDate(maxDate)}
            onChange={(e) => {
              const [y, m, d] = e.target.value.split('-').map(Number);
              if (y && m && d) onChange({ ...filters, asOf: new Date(y, m - 1, d) });
            }}
          />
        </div>

        <div className="field">
          <span className="field-label">Period basis</span>
          <select
            value={filters.basis}
            onChange={(e) => onChange({ ...filters, basis: e.target.value as PeriodBasis })}
          >
            <option value="journal">Journal Entry Date (when claimed)</option>
            <option value="clearing">Clearing Date (when settled)</option>
          </select>
        </div>

        <div className="field">
          <span className="field-label">&nbsp;</span>
          <button
            className="chip"
            onClick={() =>
              onChange({ ...filters, divisions: [], customers: [], basis: 'journal', asOf: maxDate })
            }
          >
            Reset filters
          </button>
        </div>
      </div>
    </div>
  );
}
