import { useState } from 'react';
import { mailtoLink, type EmailSummary } from '../lib/emailSummary';

interface EmailMetricsButtonProps {
  summary: EmailSummary;
  recipients?: readonly string[];
}

/** Opens a ready-written message in the user's mail program, with a copy fallback. */
export function EmailMetricsButton({ summary, recipients = [] }: EmailMetricsButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleEmail() {
    window.location.href = mailtoLink(summary, recipients);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${summary.subject}\n\n${summary.body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn-excel"
        onClick={handleEmail}
        title="Open an email with these key metrics"
      >
        ✉ Email
      </button>
      <button
        type="button"
        className="btn-excel"
        onClick={() => void handleCopy()}
        title="Copy the key metrics as text, to paste into any message"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </>
  );
}
