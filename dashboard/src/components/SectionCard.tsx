import type { ReactNode } from 'react';
import { DownloadExcelButton, type SectionExport } from './DownloadExcelButton';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  sectionExport?: SectionExport;
  /** Extra buttons shown next to the Excel download. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  sectionExport,
  actions,
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
        {(sectionExport || actions) && (
          <div className="card-header-actions">
            {actions}
            {sectionExport && <DownloadExcelButton sectionExport={sectionExport} />}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
