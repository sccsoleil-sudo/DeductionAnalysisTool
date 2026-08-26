import { downloadExcel, slugify, type ExportRow } from '../lib/exportSpreadsheet';

export interface SectionExport {
  filename: string;
  headers: string[];
  rows: ExportRow[];
}

interface DownloadExcelButtonProps {
  sectionExport: SectionExport;
  label?: string;
}

export function DownloadExcelButton({
  sectionExport,
  label = 'Download Excel',
}: DownloadExcelButtonProps) {
  if (sectionExport.rows.length === 0) return null;

  function handleClick() {
    const base = sectionExport.filename || slugify(label);
    downloadExcel(base, sectionExport.headers, sectionExport.rows);
  }

  return (
    <button type="button" className="btn-excel" onClick={handleClick} title={label}>
      ↓ Excel
    </button>
  );
}
