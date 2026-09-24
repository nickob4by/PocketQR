import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { QRCardItem } from '../types/qr';
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
  const bankName = (card.bankCustomName || card.bank).toUpperCase();

  const handleCopyNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(card.accountNumber);
    setCopiedNumber(true);
    triggerHaptic('success');
    onNotify('Account Number Copied!', card.accountNumber, 'success');
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  return (
    <div className="relative bg-surface-container-high rounded-xl p-space-md shadow-[0_4px_0_0_#0b0e15] border border-outline-variant/40 active:translate-y-0.5 transition-transform flex flex-col gap-space-sm select-none">
      {/* Molded Inner Bezel Header Strip */}
      <div className="flex items-center justify-between pb-1 bg-surface-container-lowest px-2 py-1 rounded-DEFAULT border border-outline-variant/20">
        <div className="flex items-center gap-space-xs font-label-sm text-label-sm">
          <span className="text-tertiary-fixed font-bold font-mono">ROM</span>
          <span className="text-outline">/</span>
          <span className="text-on-surface font-semibold tracking-wider font-mono">
            {bankName} WALLET
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-label-sm text-label-sm text-tertiary bg-surface-container px-1 rounded-DEFAULT font-mono">
            {card.category.toUpperCase()}
          </span>
          {/* Favorite Pin Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(card.id);
              triggerHaptic('light');
            }}
            title={card.isFavorite ? 'Unpin ROM' : 'Pin ROM as Priority'}
            className={`p-0.5 flex items-center transition-colors ${
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
              className="text-outline hover:text-on-surface p-0.5 flex items-center"
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
                    className="w-full px-3 py-2 text-left text-on-surface hover:bg-surface-container-high flex items-center gap-2"
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
                    className="w-full px-3 py-2 text-left text-error hover:bg-error-container/30 flex items-center gap-2"
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

      {/* Main Cartridge Body: QR Display + Payee Info */}
      <div className="flex items-center gap-space-md">
        {/* Scannable Micro-Screen Thumbnail */}
        <div
          onClick={() => onPresent(card)}
          title="Tap to enlarge for cashier scanning"
          className="relative w-20 h-20 bg-surface-container-lowest rounded-DEFAULT p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] border border-outline-variant/30 flex-shrink-0 flex items-center justify-center cursor-pointer group/qr"
        >
          {card.rawPayload ? (
            <div className="bg-white p-1 rounded-DEFAULT">
              <QRCodeSVG
                value={card.rawPayload}
                size={66}
                level="M"
                includeMargin={false}
              />
            </div>
          ) : (
            <img
              src={card.imageDataUrl}
              alt={card.accountName}
              className="w-full h-full object-cover rounded-DEFAULT mix-blend-screen opacity-90"
            />
          )}

          {/* CRT phosphor overlay scanline gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-container/10 to-transparent pointer-events-none rounded-DEFAULT"></div>

          {/* Hover / Tap reticle */}
          <div className="absolute inset-0 bg-primary-container/20 opacity-0 group-hover/qr:opacity-100 flex items-center justify-center transition-opacity rounded-DEFAULT">
            <span className="material-symbols-outlined text-[18px] text-primary font-bold">
              fullscreen
            </span>
          </div>
        </div>

        {/* Payee Credentials Column */}
        <div className="flex flex-col justify-between flex-1 min-w-0 h-20 py-0.5">
          <div>
            <button
              type="button"
              onClick={() => onEdit(card)}
              title="Tap to rename"
              className="flex items-center gap-space-xs text-left group transition-colors max-w-full"
            >
              <span className="font-headline-md text-headline-md text-primary tracking-tight truncate border-b border-primary/30 group-hover:border-primary font-bold">
                {card.accountName}
              </span>
              <span className="material-symbols-outlined text-primary text-[14px]">
                verified
              </span>
              <span className="material-symbols-outlined text-outline text-[13px] opacity-70 group-hover:text-primary transition-colors">
                edit
              </span>
            </button>

            {/* Masked Account / Mobile Number with 1-Tap Copy */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="font-label-md text-label-md text-on-surface-variant tracking-widest font-mono">
                {formatAccountNumber(card.accountNumber, isMasked)}
              </p>

              {/* Reveal toggle button */}
              {privacyMask && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocalReveal(!localReveal);
                  }}
                  className="text-outline hover:text-on-surface p-0.5"
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
                className="text-outline hover:text-primary p-0.5"
              >
                <span className="material-symbols-outlined text-[13px]">
                  {copiedNumber ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
          </div>

          {/* Bottom Card Strip: Rail Protocol Tag & PRESENT Actuator */}
          <div className="flex items-center justify-between pt-1">
            <span className="font-label-sm text-label-sm text-outline bg-surface-container-low px-1.5 py-0.5 rounded-DEFAULT font-mono">
              {card.rawPayload ? 'QRPH // INSTAPAY' : 'STATIC IMAGE'}
            </span>

            <button
              onClick={() => onPresent(card)}
              className="flex items-center gap-1 px-2.5 py-1 bg-primary text-on-primary font-label-sm text-label-sm rounded-DEFAULT shadow-[0_2px_0_0_#005234] active:translate-y-0.5 transition-transform font-bold font-mono hover:bg-primary-fixed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">fullscreen</span>
              <span>PRESENT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
