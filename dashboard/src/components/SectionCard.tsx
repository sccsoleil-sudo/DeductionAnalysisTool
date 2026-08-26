import type { ReactNode } from 'react';
import { DownloadExcelButton, type SectionExport } from './DownloadExcelButton';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  sectionExport?: SectionExport;
  className?: string;
  children: ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  sectionExport,
  className = 'card',
  children,
}: SectionCardProps) {
  return (
    <div className={className}>
      <div className="card-header">
        <div className="card-header-text">
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-sub">{subtitle}</div>}
        </div>
        {sectionExport && <DownloadExcelButton sectionExport={sectionExport} />}
      </div>
      {children}
    </div>
  );
}
