import { downloadCsv, slugify, type CsvRow } from '../lib/exportCsv';

export interface CsvExport {
  filename: string;
  headers: string[];
  rows: CsvRow[];
}

interface DownloadCsvButtonProps {
  exportData: CsvExport;
  label?: string;
}

export function DownloadCsvButton({ exportData, label = 'Download CSV' }: DownloadCsvButtonProps) {
  if (exportData.rows.length === 0) return null;

  function handleClick() {
    const base = exportData.filename || slugify(label);
    downloadCsv(base, exportData.headers, exportData.rows);
  }

  return (
    <button type="button" className="btn-download" onClick={handleClick} title={label}>
      ↓ CSV
    </button>
  );
}
