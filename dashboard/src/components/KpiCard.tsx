import { variance } from '../lib/format';

interface KpiCardProps {
  label: string;
  value: string;
  tone?: 'primary' | 'accent' | 'warn' | 'danger' | 'info';
  footnote?: string;
  current?: number;
  previous?: number;
  /** When true, an increase is good (e.g. recovered). Defaults to false (an increase is bad). */
  higherIsBetter?: boolean;
  comparisonLabel?: string;
}

export function KpiCard({
  label,
  value,
  tone = 'primary',
  footnote,
  current,
  previous,
  higherIsBetter = false,
  comparisonLabel = 'vs LY',
}: KpiCardProps) {
  const showDelta = current !== undefined && previous !== undefined;
  const delta = showDelta ? variance(current, previous) : null;

  return (
    <div className={`kpi ${tone}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {delta && (
        <span className={`kpi-delta ${delta.direction}${higherIsBetter ? ' invert' : ''}`}>
          {delta.text} {comparisonLabel}
        </span>
      )}
      {footnote && <span className="kpi-foot">{footnote}</span>}
    </div>
  );
}
