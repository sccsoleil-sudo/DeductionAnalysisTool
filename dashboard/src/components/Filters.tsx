import {
  defaultMonths,
  isYtdMonthSelection,
  MONTH_LABELS,
  type Filters,
  type PeriodBasis,
} from '../lib/metrics';
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

  function toggleMonth(month: number) {
    const selected = new Set(filters.months);
    if (selected.has(month)) {
      if (selected.size === 1) return;
      selected.delete(month);
    } else {
      selected.add(month);
    }
    onChange({ ...filters, months: [...selected].sort((a, b) => a - b) });
  }

  function setMonths(months: number[]) {
    onChange({ ...filters, months: [...months].sort((a, b) => a - b) });
  }

  function handleAsOfChange(nextAsOf: Date) {
    const wasYtd = isYtdMonthSelection(filters.months, filters.asOf);
    onChange({
      ...filters,
      asOf: nextAsOf,
      months: wasYtd ? defaultMonths(nextAsOf) : filters.months,
    });
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
          <span className="field-label">As of date</span>
          <input
            type="date"
            value={isoDate(filters.asOf)}
            min={isoDate(minDate)}
            max={isoDate(maxDate)}
            onChange={(e) => {
              const [y, m, d] = e.target.value.split('-').map(Number);
              if (y && m && d) handleAsOfChange(new Date(y, m - 1, d));
            }}
          />
        </div>

        <div className="field">
          <span className="field-label">Period basis</span>
          <select
            value={filters.basis}
            onChange={(e) => onChange({ ...filters, basis: e.target.value as PeriodBasis })}
          >
            <option value="journal">Claim Date (when claimed)</option>
            <option value="clearing">Clearing Date (when settled)</option>
          </select>
        </div>

        <div className="field">
          <span className="field-label">Lost basis</span>
          <select
            value={filters.plBasis}
            onChange={(e) => onChange({ ...filters, plBasis: e.target.value as PeriodBasis })}
          >
            <option value="journal">Claim Date</option>
            <option value="clearing">Clearing Date</option>
          </select>
        </div>
      </div>

      <div className="filters" style={{ marginTop: 12, marginBottom: 0 }}>
        <div className="field" style={{ flex: 1 }}>
          <span className="field-label">Analysis months</span>
          <div className="chip-row">
            <button
              className={`chip${isYtdMonthSelection(filters.months, filters.asOf) ? ' on' : ''}`}
              onClick={() => setMonths(defaultMonths(filters.asOf))}
            >
              YTD
            </button>
            <button
              className={`chip${filters.months.length === 12 ? ' on' : ''}`}
              onClick={() => setMonths(MONTH_LABELS.map((_, i) => i))}
            >
              All 12
            </button>
            {MONTH_LABELS.map((label, index) => (
              <button
                key={label}
                className={`chip${filters.months.includes(index) ? ' on' : ''}`}
                onClick={() => toggleMonth(index)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">&nbsp;</span>
          <button
            className="chip"
            onClick={() =>
              onChange({
                divisions: [],
                customers: [],
                basis: 'journal',
                plBasis: 'journal',
                asOf: maxDate,
                months: defaultMonths(maxDate),
              })
            }
          >
            Reset filters
          </button>
        </div>
      </div>
    </div>
  );
}
