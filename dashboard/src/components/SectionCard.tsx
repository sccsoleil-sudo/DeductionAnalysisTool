import type { ReactNode } from 'react';
import { DownloadCsvButton, type CsvExport } from './DownloadCsvButton';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  csv?: CsvExport;
  className?: string;
  children: ReactNode;
}

export function SectionCard({ title, subtitle, csv, className = 'card', children }: SectionCardProps) {
  return (
    <div className={className}>
      <div className="card-header">
        <div className="card-header-text">
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-sub">{subtitle}</div>}
        </div>
        {csv && <DownloadCsvButton exportData={csv} />}
      </div>
      {children}
    </div>
  );
}
