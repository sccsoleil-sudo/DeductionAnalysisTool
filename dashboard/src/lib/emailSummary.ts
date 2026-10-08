import { compactMoney, count, percent } from './format';

export interface EmailMetricLine {
  label: string;
  current: number;
  previous: number;
  /** Number of lines behind the amount. Omit when it does not apply. */
  lines?: number;
  /** Share of the total, 0-100. Omit for the total line. */
  share?: number;
  /** Extra wording for the line, such as a recovery rate. */
  detail?: string;
}

export interface EmailSummaryInput {
  title: string;
  lyLabel: string;
  cyLabel: string;
  rangeLabel: string;
  cutOff: string;
  metrics: EmailMetricLine[];
}

export interface EmailSummary {
  subject: string;
  body: string;
}

function change(current: number, previous: number): string {
  if (previous === 0) return 'no prior-year amount';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${percent(pct)} vs prior year`;
}

/** Plain-text summary, so it reads the same in any mail program. */
export function buildEmailSummary(input: EmailSummaryInput): EmailSummary {
  const subject = `${input.title} key metrics: ${input.cyLabel} vs ${input.lyLabel}`;

  const lines = input.metrics.map((m) => {
    const parts = [
      `${m.label}: ${compactMoney(m.current)} (${input.lyLabel}: ${compactMoney(m.previous)}, ${change(m.current, m.previous)})`,
    ];
    if (m.lines !== undefined) parts.push(`${count(m.lines)} lines`);
    if (m.share !== undefined) parts.push(`${percent(m.share)} of total`);
    if (m.detail) parts.push(m.detail);
    return parts.join(' · ');
  });

  const body = [
    `${input.title} key metrics`,
    `${input.lyLabel} vs ${input.cyLabel} · ${input.rangeLabel}, cut off at ${input.cutOff}`,
    '',
    ...lines,
    '',
    'Sent from the Logistics Master Dashboard.',
  ].join('\n');

  return { subject, body };
}

/** mailto: link. Mail programs expect CRLF line breaks. */
export function mailtoLink(summary: EmailSummary, recipients: readonly string[] = []): string {
  const to = recipients.map((r) => r.trim()).filter(Boolean).join(',');
  const body = summary.body.replace(/\n/g, '\r\n');
  return `mailto:${to}?subject=${encodeURIComponent(summary.subject)}&body=${encodeURIComponent(body)}`;
}
