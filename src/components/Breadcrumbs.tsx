import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export const Breadcrumbs: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-6 flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[#8A847B]"
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {idx > 0 && <ChevronRight className="h-3 w-3 text-[#5A554E]" aria-hidden="true" />}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="text-[#A9A39A] transition-colors hover:text-[#D97B29]"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-[#D97B29]' : 'text-[#A9A39A]'}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
