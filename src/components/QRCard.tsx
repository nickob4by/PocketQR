import React, { useState } from 'react';
import type { QRCardItem } from '../types/qr';
import { BANK_CONFIGS } from '../types/qr';
import { formatAccountNumber } from '../lib/emvcoParser';
import { triggerHaptic } from '../lib/security';

interface QRCardProps {
  card: QRCardItem;
  privacyMask: boolean;
  onPresent: (card: QRCardItem) => void;
  onEdit: (card: QRCardItem) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onNotify: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
}

export const QRCard: React.FC<QRCardProps> = ({
  card,
  privacyMask,
  onPresent,
  onEdit,
  onDelete,
  onToggleFavorite,
  onNotify,
}) => {
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [localReveal, setLocalReveal] = useState(false);

  const isMasked = privacyMask && !localReveal;
  const bankConfig = BANK_CONFIGS[card.bank] || BANK_CONFIGS.other;
  const bankName = (card.bankCustomName || bankConfig.name).toUpperCase();

  const handleCopyNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(card.accountNumber);
    setCopiedNumber(true);
    triggerHaptic('success');
    onNotify('Account Number Copied!', card.accountNumber, 'success');
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  return (
    <div
      onClick={() => onPresent(card)}
      className="relative bg-surface-container-high rounded-xl p-space-md shadow-[0_4px_0_0_#0b0e15] border border-outline-variant/40 active:translate-y-0.5 transition-all flex flex-col gap-space-sm select-none cursor-pointer hover:border-primary-fixed/50 hover:shadow-[0_4px_12px_rgba(0,240,160,0.12)] group/card"
    >
      {/* Molded Inner Bezel Header Strip */}
      <div className="flex items-center justify-between pb-1 bg-surface-container-lowest px-2.5 py-1.5 rounded-DEFAULT border border-outline-variant/20">
        <div className="flex items-center gap-space-xs font-label-sm text-label-sm">
          <span className="text-tertiary-fixed font-bold font-mono text-[11px]">ROM</span>
          <span className="text-outline text-[11px]">/</span>
          <span className="text-on-surface font-semibold tracking-wider font-mono text-[11px]">
            {bankName}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`font-label-sm text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
              bankConfig.badgeBg || 'bg-surface-container'
            } ${bankConfig.badgeText || 'text-on-surface'}`}
          >
            {card.bank.toUpperCase()}
          </span>

          {/* Favorite Pin Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(card.id);
              triggerHaptic('light');
            }}
            title={card.isFavorite ? 'Unpin ROM' : 'Pin ROM as Priority'}
            className={`p-0.5 flex items-center transition-colors cursor-pointer ${
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
              className="text-outline hover:text-on-surface p-0.5 flex items-center cursor-pointer"
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
                <div className="absolute right-0 top-full mt-1 w-36 rounded-lg bg-surface-container-lowest border border-outline-variant shadow-2xl py-1 z-30 font-label-sm text-label-sm">
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
                    <span>EDIT ROM</span>
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

      {/* Main Cartridge Body: Clean Info-Focused Layout */}
      <div className="flex flex-col gap-1 py-1">
        {/* Payee Credentials Column */}
        <div className="flex flex-col justify-between flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(card);
              }}
              title="Tap to rename"
              className="flex items-center gap-1 text-left group/edit transition-colors max-w-full truncate cursor-pointer"
            >
              <span className="font-headline-md text-headline-md text-primary tracking-tight truncate border-b border-primary/20 group-hover/edit:border-primary font-bold text-base">
                {card.accountName}
              </span>
              <span className="material-symbols-outlined text-primary text-[14px] flex-shrink-0">
                verified
              </span>
              <span className="material-symbols-outlined text-outline text-[12px] opacity-70 group-hover/edit:text-primary transition-colors flex-shrink-0">
                edit
              </span>
            </button>
          </div>

          {/* Masked Account / Mobile Number with 1-Tap Copy */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="font-label-md text-label-md text-on-surface-variant tracking-wider font-mono text-xs">
              {formatAccountNumber(card.accountNumber, isMasked)}
            </p>

            {/* Reveal toggle button */}
            {privacyMask && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLocalReveal(!localReveal);
                }}
                className="text-outline hover:text-on-surface p-0.5 cursor-pointer"
                title={localReveal ? 'Mask number' : 'Reveal full number'}
              >
                <span className="material-symbols-outlined text-[13px]">
                  {localReveal ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            )}

            <button
              onClick={handleCopyNumber}
              title="Copy account number"
              className="text-outline hover:text-primary p-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">
                {copiedNumber ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Card Strip: Rail Protocol Tag & PRESENT Actuator */}
      <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20">
        <span className="font-label-sm text-[10px] text-outline bg-surface-container-low px-1.5 py-0.5 rounded font-mono">
          {card.rawPayload ? 'QRPH // INSTAPAY' : 'PAYMENT ROM'}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onPresent(card);
          }}
          className="flex items-center gap-1 px-3 py-1 bg-primary text-on-primary font-label-sm text-label-sm rounded-lg shadow-[0_2px_0_0_#005234] active:translate-y-0.5 transition-transform font-bold font-mono hover:bg-primary-fixed cursor-pointer text-xs"
        >
          <span className="material-symbols-outlined text-[15px]">fullscreen</span>
          <span>PRESENT</span>
        </button>
      </div>
    </div>
  );
};
