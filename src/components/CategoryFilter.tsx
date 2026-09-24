import React from 'react';
import type { QRCardItem } from '../types/qr';

export type FilterCategory =
  | 'all'
  | 'gcash'
  | 'maya'
  | 'bpi'
  | 'unionbank'
  | 'bdo'
  | 'gotyme'
  | 'rcbc'
  | 'seabank'
  | 'other';

interface CategoryFilterProps {
  currentFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  cards: QRCardItem[];
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  currentFilter,
  onFilterChange,
  cards,
}) => {
  const counts = React.useMemo(() => {
    return {
      all: cards.length,
      gcash: cards.filter((c) => c.bank === 'gcash').length,
      maya: cards.filter((c) => c.bank === 'maya').length,
      bpi: cards.filter((c) => c.bank === 'bpi').length,
      unionbank: cards.filter((c) => c.bank === 'unionbank').length,
      bdo: cards.filter((c) => c.bank === 'bdo').length,
      gotyme: cards.filter((c) => c.bank === 'gotyme').length,
      rcbc: cards.filter((c) => c.bank === 'rcbc').length,
      seabank: cards.filter((c) => c.bank === 'seabank').length,
      other: cards.filter((c) =>
        ['other', 'metrobank', 'cimb'].includes(c.bank)
      ).length,
    };
  }, [cards]);

  const filterButtons: { id: FilterCategory; label: string; count: number }[] = [
    { id: 'all', label: 'ALL', count: counts.all },
    { id: 'gcash', label: 'GCASH', count: counts.gcash },
    { id: 'maya', label: 'MAYA', count: counts.maya },
    { id: 'bpi', label: 'BPI', count: counts.bpi },
    { id: 'unionbank', label: 'UNIONBANK', count: counts.unionbank },
    { id: 'bdo', label: 'BDO', count: counts.bdo },
    { id: 'gotyme', label: 'GOTYME', count: counts.gotyme },
    { id: 'rcbc', label: 'RCBC', count: counts.rcbc },
    { id: 'seabank', label: 'SEABANK', count: counts.seabank },
    { id: 'other', label: 'OTHER', count: counts.other },
  ];

  return (
    <div className="flex flex-col gap-space-xs p-space-sm bg-surface-container-low rounded-xl shadow-sm border border-outline-variant/30 mb-space-md">
      {/* Top Bank Slot Counter Strip */}
      <div className="flex items-center justify-between font-label-sm text-label-sm">
        <div className="flex items-center gap-space-xs">
          <span className="inline-block w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(0,240,160,0.8)] animate-pulse"></span>
          <span className="text-primary-fixed uppercase tracking-wider font-bold text-[11px]">
            BANK CHANNEL FILTER
          </span>
          <span className="text-outline text-[11px]">::</span>
          <span className="text-on-surface text-[11px]">
            {currentFilter.toUpperCase()} [{String(counts[currentFilter] ?? 0).padStart(2, '0')}]
          </span>
        </div>
        <div className="flex items-center gap-space-xs text-on-surface-variant text-[10px]">
          <span className="bg-surface-container-highest text-tertiary px-1.5 py-0.5 rounded font-bold font-mono">
            SWIPE ↔
          </span>
        </div>
      </div>

      {/* Horizontally Scrollable Bank Channel Selectors */}
      <div className="flex items-center gap-1.5 overflow-x-auto touch-pan-x flex-nowrap shrink-0 pt-1 pb-1 no-scrollbar scroll-smooth">
        {filterButtons.map((btn) => {
          const isActive = currentFilter === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => onFilterChange(btn.id)}
              className={`px-3 py-1.5 font-label-sm text-label-sm rounded-lg shadow-sm active:translate-y-0.5 transition-all flex items-center gap-1.5 shrink-0 uppercase tracking-wider font-bold text-xs cursor-pointer ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-mono shadow-[0_2px_0_0_#006843]'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-outline-variant/20'
              }`}
            >
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-on-primary-container"></span>}
              <span>{btn.label}</span>
              <span className={`text-[10px] ${isActive ? 'text-on-primary-container/80' : 'text-outline'}`}>
                {btn.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
