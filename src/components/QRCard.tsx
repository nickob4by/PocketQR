import React, { useState, useMemo } from 'react';
import type { QRCardItem } from '../types/qr';
import { BANK_CONFIGS } from '../types/qr';
import { parseQRPhPayload, formatAccountNumber } from '../lib/emvcoParser';
import { triggerHaptic } from '../lib/security';

interface QRCardProps {
  card: QRCardItem;
  privacyMask?: boolean;
  onPresent: (card: QRCardItem) => void;
  onEdit: (card: QRCardItem) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onNotify: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
}

export const QRCard: React.FC<QRCardProps> = ({
  card,
  onPresent,
  onEdit,
  onDelete,
  onToggleFavorite,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const bankConfig = BANK_CONFIGS[card.bank] || BANK_CONFIGS.other;
  const bankName = (card.bankCustomName || bankConfig.name).toUpperCase();

  // Dynamically extract rich details if payload exists
  const parsedData = useMemo(() => {
    if (card.rawPayload) {
      return parseQRPhPayload(card.rawPayload);
    }
    return null;
  }, [card.rawPayload]);

  const rail = card.rail || parsedData?.rail || (card.rawPayload ? 'QR PH' : undefined);
  const city = card.city || parsedData?.city;
  const accountNumberRaw = card.accountNumber || parsedData?.accountNumber || '';
  const displayAccount = formatAccountNumber(accountNumberRaw, false);

  return (
    <div
      onClick={() => onPresent(card)}
      className="relative bg-surface-container-high rounded-xl p-3 shadow-[0_2px_0_0_#0b0e15] border border-outline-variant/30 active:translate-y-0.5 transition-all flex flex-col gap-2 select-none cursor-pointer hover:border-primary-fixed/50 hover:shadow-[0_2px_8px_rgba(0,240,160,0.1)] group/card"
    >
      {/* Card Header Strip: Bank Pill, Rail Tag & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`font-label-sm text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider shrink-0 ${
              bankConfig.badgeBg || 'bg-surface-container'
            } ${bankConfig.badgeText || 'text-on-surface'}`}
          >
            {bankName}
          </span>

          {rail && (
            <span className="font-label-sm text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider bg-surface-container-lowest text-tertiary border border-outline-variant/30 shrink-0">
              {rail}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Favorite Pin Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(card.id);
              triggerHaptic('light');
            }}
            title={card.isFavorite ? 'Unpin Card' : 'Pin Card as Priority'}
            className={`p-1 flex items-center transition-colors cursor-pointer ${
              card.isFavorite ? 'text-secondary-fixed' : 'text-outline hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={card.isFavorite ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              push_pin
            </span>
          </button>

          {/* Menu Dropdown Toggle */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="text-outline hover:text-on-surface p-1 flex items-center cursor-pointer"
              aria-label="Options"
            >
              <span className="material-symbols-outlined text-[16px]">more_vert</span>
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 w-32 rounded-lg bg-surface-container-lowest border border-outline-variant shadow-2xl py-1 z-30 font-label-sm text-label-sm">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onEdit(card);
                    }}
                    className="w-full px-3 py-2 text-left text-on-surface hover:bg-surface-container-high flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px] text-primary-fixed">
                      edit
                    </span>
                    <span>EDIT</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete(card.id);
                    }}
                    className="w-full px-3 py-2 text-left text-error hover:bg-error-container/30 flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    <span>DELETE</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Card Body: Clean Payee Name & Extracted Metadata */}
      <div className="flex flex-col gap-1 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-headline-md text-primary tracking-tight truncate font-bold text-xl sm:text-2xl">
              {card.accountName}
            </span>
            <span className="material-symbols-outlined text-primary text-[18px] flex-shrink-0">
              verified
            </span>
          </div>

          <span className="material-symbols-outlined text-outline/30 group-hover/card:text-primary transition-colors text-[20px] flex-shrink-0">
            qr_code_2
          </span>
        </div>

        {/* Extracted Details Pill Strip */}
        <div className="flex items-center gap-2 text-xs font-mono text-outline flex-wrap mt-0.5">
          {displayAccount && (
            <span className="text-on-surface-variant font-medium tracking-wide">
              {displayAccount}
            </span>
          )}

          {city && (
            <span className="flex items-center gap-0.5 text-[11px] text-outline">
              <span className="material-symbols-outlined text-[13px]">location_on</span>
              <span>{city}</span>
            </span>
          )}

          <span className="text-[10px] bg-surface-container-lowest px-1.5 py-0.5 rounded text-outline border border-outline-variant/20 font-bold">
            PHP
          </span>
        </div>
      </div>
    </div>
  );
};
