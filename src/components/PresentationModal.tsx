import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { QRCardItem } from '../types/qr';
import { formatAccountNumber, parseQRPhPayload } from '../lib/emvcoParser';
import { triggerHaptic } from '../lib/security';
import {
  saveQRToGallery,
  copyQRImageToClipboard,
  shareQRImage,
} from '../lib/qrImageUtils';
import { addLog } from '../lib/storage';
import { getQRModuleColor, createCenterNameBadge } from '../lib/qrThemeUtils';

interface PresentationModalProps {
  card: QRCardItem | null;
  onClose: () => void;
  onPayWithBank?: (card: QRCardItem) => void;
  onNotify: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
  onLogAdded?: () => void;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({
  card,
  onClose,
  onPayWithBank,
  onNotify,
  onLogAdded,
}) => {
  const [isRotated, setIsRotated] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedQR, setCopiedQR] = useState(false);
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Screen Wake Lock API to prevent screen timeout while presenting
  useEffect(() => {
    if (!card) return;

    let active = true;

    async function requestWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          if (active) {
            wakeLockRef.current = lock;
          }
        } catch {
          // wakeLock unavailable or ignored
        }
      }
    }

    requestWakeLock();

    return () => {
      active = false;
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [card]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!card) return null;

  const bankName = (card.bankCustomName || card.bank).toUpperCase();

  const isStaleRoutingCode =
    card.accountNumber === '99964403' ||
    card.accountNumber === '217020000000656' ||
    card.accountNumber?.startsWith('217020000000');

  const resolvedAccountNumber =
    (!isStaleRoutingCode && card.accountNumber) ||
    (card.rawPayload ? parseQRPhPayload(card.rawPayload).accountNumber : '') ||
    card.accountNumber;

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(resolvedAccountNumber);
    setCopiedNumber(true);
    triggerHaptic('success');
    onNotify('Number Copied!', resolvedAccountNumber, 'success');
    addLog({
      type: 'copied_details',
      title: card.accountName,
      bank: bankName,
      accountNumber: resolvedAccountNumber,
      detail: 'Copied account / phone number',
    }).then(() => onLogAdded?.()).catch(console.warn);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleSaveToGallery = async () => {
    setIsSaving(true);
    triggerHaptic('light');
    const res = await saveQRToGallery({
      rawPayload: card.rawPayload,
      imageDataUrl: card.imageDataUrl,
      accountName: card.accountName,
      bank: card.bank,
      bankCustomName: card.bankCustomName,
    });
    setIsSaving(false);

    if (res.success) {
      setSavedToGallery(true);
      triggerHaptic('success');
      onNotify('Saved to Recent Photos!', 'Top photo for bank upload — auto-cleans automatically after use.', 'success');
      addLog({
        type: 'saved_photo',
        title: card.accountName,
        bank: bankName,
        accountNumber: resolvedAccountNumber,
        rawPayload: card.rawPayload,
        detail: 'Saved to gallery / recents',
      }).then(() => onLogAdded?.()).catch(console.warn);
    } else {
      onNotify('Save Failed', res.message, 'error');
    }
  };

  const handleCopyQRImage = async () => {
    triggerHaptic('light');
    const res = await copyQRImageToClipboard({
      rawPayload: card.rawPayload,
      imageDataUrl: card.imageDataUrl,
      textFallback: resolvedAccountNumber,
      accountName: card.accountName,
      bank: card.bank,
      bankCustomName: card.bankCustomName,
    });

    if (res.success) {
      setCopiedQR(true);
      triggerHaptic('success');
      onNotify('QR Copied!', 'QR Image & details copied to clipboard', 'success');
      addLog({
        type: 'copied_details',
        title: card.accountName,
        bank: bankName,
        accountNumber: resolvedAccountNumber,
        rawPayload: card.rawPayload,
        detail: 'Copied QR image to clipboard',
      }).then(() => onLogAdded?.()).catch(console.warn);
      setTimeout(() => setCopiedQR(false), 2500);
    } else {
      onNotify('Copy Failed', res.message, 'error');
    }
  };

  const handleShare = async () => {
    triggerHaptic('light');
    const shared = await shareQRImage({
      rawPayload: card.rawPayload,
      imageDataUrl: card.imageDataUrl,
      title: `PocketQR - ${card.accountName} (${bankName})`,
      text: `Payee: ${card.accountName}\nBank: ${bankName}\nAccount: ${card.accountNumber}`,
      accountName: card.accountName,
      bank: card.bank,
      bankCustomName: card.bankCustomName,
    });

    if (!shared) {
      navigator.clipboard.writeText(
        `Payee: ${card.accountName}\nBank: ${bankName}\nAccount: ${card.accountNumber}`
      );
      onNotify('Details Copied!', 'Payment credentials copied to clipboard', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface sm:bg-surface-container-lowest/80 sm:backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-md bg-surface text-on-surface flex flex-col sm:rounded-2xl sm:border sm:border-outline-variant/50 shadow-2xl overflow-hidden">
        {/* Header - Fixed Flex Sibling, strictly above scrollable content */}
        <header className="flex-shrink-0 w-full z-30 pt-safe bg-surface border-b border-outline-variant/30 px-margin">
          <div className="pt-3 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <button
                onClick={onClose}
                aria-label="Return"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface active:translate-y-0.5 transition-transform border border-outline-variant/40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <h1 className="font-headline-md text-headline-md tracking-tight text-on-surface uppercase truncate font-bold text-sm sm:text-base">
                Present QR // Cashier Scan
              </h1>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsRotated(!isRotated)}
                title="Rotate 180° for Cashier Facing"
                className="p-2 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface active:translate-y-0.5 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">screen_rotation</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Main Content Area */}
        <div className="flex-1 overflow-y-auto px-margin py-3 pb-safe flex flex-col gap-2.5 select-none font-mono">
          {/* Unified Clean Cashier Scan Card */}
          <div
            className={`relative bg-surface-container-high p-space-md rounded-xl shadow-xl border border-outline-variant/40 flex flex-col items-center overflow-hidden transition-transform duration-300 ${
              isRotated ? 'rotate-180' : ''
            }`}
          >
            {/* Dot-Matrix Decorative Mesh Backdrop */}
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#003822_1px,transparent_1px)] [background-size:6px_6px]"></div>

            {/* Station / Rail Pill */}
            <div className="relative w-full flex items-center justify-between bg-surface-container-lowest text-on-surface px-space-md py-space-xs rounded-lg shadow-sm border border-outline-variant/30">
              <div className="flex items-center gap-space-xs">
                <div className="w-4 h-4 rounded-full bg-primary-container flex items-center justify-center text-on-primary font-bold text-[9px] font-label-sm">
                  ✓
                </div>
                <span className="font-headline-md text-label-md text-tertiary tracking-wider font-bold text-xs">
                  {bankName}
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider text-[10px]">
                SYNCED
              </span>
            </div>

            {/* High-Fidelity Tactical QR Display */}
            <div className="relative my-space-md p-space-md bg-white rounded-xl shadow-lg flex flex-col items-center justify-center">
              {card.rawPayload ? (
                <QRCodeSVG
                  id="presentation-qr-svg"
                  value={card.rawPayload}
                  size={220}
                  level="H"
                  fgColor={getQRModuleColor(card.bank)}
                  bgColor="#FFFFFF"
                  includeMargin={false}
                  imageSettings={{
                    src: createCenterNameBadge(card.accountName, card.bank, card.bankCustomName),
                    width: 48,
                    height: 48,
                    excavate: true,
                  }}
                />
              ) : (
                <img
                  src={card.imageDataUrl}
                  alt={card.accountName}
                  className="w-56 h-56 object-contain"
                />
              )}
            </div>

            {/* Scan Alignment Watermark */}
            <div className="mt-space-xs flex items-center justify-between w-full px-space-xs text-[10px] text-outline">
              <span className="tracking-wider">STANDARDIZED QRPH P2P</span>
              <span className="text-inverse-primary font-bold tracking-wider">PH-NPS</span>
            </div>

            {/* Payee Credentials Deck */}
            <div className="relative w-full flex flex-col items-center text-center space-y-1 mt-2">
              <span className="font-label-sm text-[9px] text-outline tracking-wider uppercase font-bold">
                PAYEE NAME // VERIFIED REGISTERED
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight text-lg">
                {card.accountName}
              </h2>

              {/* Mobile Target Pill with Tactile Copy Action */}
              <div className="mt-space-xs flex items-center gap-space-xs bg-surface-container-lowest px-space-md py-space-xs rounded-lg shadow-sm border border-outline-variant/30">
                <span className="material-symbols-outlined text-[16px] text-primary">
                  smartphone
                </span>
                <span className="font-label-md text-label-md text-on-surface font-bold tracking-wider text-xs">
                  {formatAccountNumber(resolvedAccountNumber, false)}
                </span>
                <button
                  onClick={handleCopyNumber}
                  className="ml-space-xs bg-surface-container-high hover:bg-surface-bright text-primary font-label-sm text-label-sm px-space-sm py-0.5 rounded transition-transform active:translate-y-0.5 flex items-center gap-1 font-bold cursor-pointer text-[10px]"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {copiedNumber ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedNumber ? '[ COPIED ]' : '[ COPY ]'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Physical Neo-Brutalist Actuator Cluster (Action Deck) */}
          <div className="flex flex-col space-y-space-sm pt-space-xs">
            {/* Direct Pay with Bank (Auto-Saves QR) */}
            {onPayWithBank && (
              <button
                onClick={() => onPayWithBank(card)}
                className="w-full bg-primary-container text-on-primary font-headline-md text-headline-md py-3 px-space-md rounded-xl shadow-lg flex items-center justify-center gap-space-sm transition-transform active:translate-y-0.5 font-bold uppercase hover:bg-primary-fixed cursor-pointer text-xs sm:text-sm font-mono tracking-wider"
              >
                <span className="material-symbols-outlined text-[20px]">bolt</span>
                <span>[ PAY WITH GCASH / BANK APP ]</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-space-sm">
              <button
                onClick={handleSaveToGallery}
                disabled={isSaving}
                className={`font-label-md text-label-md py-2.5 px-space-sm rounded-lg shadow-sm flex items-center justify-center gap-space-xs transition-transform active:translate-y-0.5 border font-bold cursor-pointer text-[11px] ${
                  savedToGallery
                    ? 'bg-primary-container/20 text-primary-fixed border-primary-fixed/40'
                    : 'bg-surface-container-high text-on-surface border-outline-variant/30 hover:bg-surface-bright'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-primary">
                  {savedToGallery ? 'check_circle' : 'add_photo_alternate'}
                </span>
                <span className="truncate">{savedToGallery ? 'SAVED TO PHOTOS' : isSaving ? 'SAVING...' : 'SAVE TO RECENTS'}</span>
              </button>

              <button
                onClick={handleCopyQRImage}
                className={`font-label-md text-label-md py-2.5 px-space-sm rounded-lg shadow-sm flex items-center justify-center gap-space-xs transition-transform active:translate-y-0.5 border font-bold cursor-pointer text-[11px] ${
                  copiedQR
                    ? 'bg-primary-container/20 text-primary-fixed border-primary-fixed/40'
                    : 'bg-surface-container-high text-on-surface border-outline-variant/30 hover:bg-surface-bright'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">
                  {copiedQR ? 'check' : 'content_copy'}
                </span>
                <span className="truncate">{copiedQR ? 'QR COPIED!' : 'COPY QR IMAGE'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-space-sm">
              <button
                onClick={handleShare}
                className="bg-surface-container-high text-on-surface font-label-md text-label-md py-2 px-space-sm rounded-lg shadow-sm flex items-center justify-center gap-space-xs transition-transform active:translate-y-0.5 border border-outline-variant/30 font-bold hover:bg-surface-bright cursor-pointer text-[11px]"
              >
                <span className="material-symbols-outlined text-[16px] text-tertiary">share</span>
                <span className="truncate">[ SHARE QR ]</span>
              </button>

              <button
                onClick={() => setIsRotated(!isRotated)}
                className="bg-surface-container-high text-on-surface font-label-md text-label-md py-2 px-space-sm rounded-lg shadow-sm flex items-center justify-center gap-space-xs transition-transform active:translate-y-0.5 border border-outline-variant/30 font-bold hover:bg-surface-bright cursor-pointer text-[11px]"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">
                  screen_rotation
                </span>
                <span className="truncate">[ FLIP 180° ]</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
