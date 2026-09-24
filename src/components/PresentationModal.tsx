import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { QRCardItem } from '../types/qr';
import { formatAccountNumber } from '../lib/emvcoParser';
import { triggerHaptic } from '../lib/security';

interface PresentationModalProps {
  card: QRCardItem | null;
  onClose: () => void;
  onNotify: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({
  card,
  onClose,
  onNotify,
}) => {
  const [isRotated, setIsRotated] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
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
            setWakeLockActive(true);
            lock.addEventListener('release', () => {
              if (active) setWakeLockActive(false);
            });
          }
        } catch {
          if (active) setWakeLockActive(false);
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

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(card.accountNumber);
    setCopiedNumber(true);
    triggerHaptic('success');
    onNotify('Number Copied!', card.accountNumber, 'success');
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleSaveToDevice = () => {
    try {
      const link = document.createElement('a');
      link.download = `PocketQR_${card.accountName.replace(/\s+/g, '_')}_${card.bank}.png`;
      link.href = card.imageDataUrl || '';
      if (!card.imageDataUrl && card.rawPayload) {
        // Can convert SVG to data URL or fallback
        const svg = document.getElementById('presentation-qr-svg');
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          link.href = URL.createObjectURL(svgBlob);
          link.download = `PocketQR_${card.accountName.replace(/\s+/g, '_')}_${card.bank}.svg`;
        }
      }
      link.click();
      triggerHaptic('success');
      onNotify('Saved to Device', 'QR Code image downloaded to phone', 'success');
    } catch {
      onNotify('Save Error', 'Could not save QR image', 'error');
    }
  };

  const handleShare = async () => {
    triggerHaptic('light');
    if (navigator.share) {
      try {
        await navigator.share({
          title: `PocketQR - ${card.accountName} (${bankName})`,
          text: `Payee: ${card.accountName}\nBank: ${bankName}\nAccount: ${card.accountNumber}`,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(
        `Payee: ${card.accountName}\nBank: ${bankName}\nAccount: ${card.accountNumber}`
      );
      onNotify('Details Copied!', 'Payment credentials copied to clipboard', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-surface/95 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto safe-p">
      <div className="relative w-full min-h-screen sm:min-h-0 sm:max-w-md bg-surface text-on-surface flex flex-col justify-between py-2 sm:py-4 px-margin sm:rounded-2xl sm:border sm:border-outline-variant/50 shadow-2xl">
        {/* Header */}
        <header className="sticky top-0 w-full z-10 pt-safe bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <button
                onClick={onClose}
                aria-label="Return"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface active:translate-y-0.5 transition-transform border border-outline-variant/40"
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
                className="p-2 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface active:translate-y-0.5 transition-transform"
              >
                <span className="material-symbols-outlined text-[18px]">screen_rotation</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-col w-full py-3 space-y-space-md select-none font-mono">
          {/* Telemetry & Hardware Status Bar */}
          <div className="flex items-center justify-between bg-surface-container-low px-space-md py-space-xs rounded-lg shadow-sm border border-outline-variant/30">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              <span className="font-label-sm text-label-sm text-primary tracking-widest uppercase font-bold">
                RX // CARTRIDGE LOADED
              </span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-highest px-space-sm py-0.5 rounded-full border border-outline-variant/40">
              <span className="material-symbols-outlined text-[14px] text-secondary">
                light_mode
              </span>
              <span className="font-label-sm text-label-sm text-secondary tracking-wider font-bold">
                {wakeLockActive ? 'MAX LUX ACTIVE' : 'AUTO LUX'}
              </span>
            </div>
          </div>

          {/* Giant Retro LCD Framing Chassis */}
          <div
            className={`relative bg-surface-container-high p-space-md rounded-xl shadow-xl border border-outline-variant/40 transition-transform duration-300 ${
              isRotated ? 'rotate-180' : ''
            }`}
          >
            {/* Molded Hardware Screw Accents in the 4 corners */}
            <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-surface-container-lowest flex items-center justify-center">
              <span className="w-1.5 h-0.5 bg-outline-variant block rotate-45"></span>
            </div>
            <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-surface-container-lowest flex items-center justify-center">
              <span className="w-1.5 h-0.5 bg-outline-variant block -rotate-45"></span>
            </div>
            <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-surface-container-lowest flex items-center justify-center">
              <span className="w-1.5 h-0.5 bg-outline-variant block -rotate-12"></span>
            </div>
            <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-surface-container-lowest flex items-center justify-center">
              <span className="w-1.5 h-0.5 bg-outline-variant block rotate-45"></span>
            </div>

            {/* Inner Bezel Header Deck */}
            <div className="flex items-center justify-between px-space-xs pb-space-sm border-b border-outline-variant/20 mb-2">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-bold">
                  SLOT 01
                </span>
                <span className="bg-primary-container text-on-primary-container font-label-sm text-label-sm px-1.5 py-0.5 rounded-DEFAULT font-bold">
                  QRPh 2.0
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-label-sm text-label-sm text-outline tracking-tight">
                  FREQ: 2.4GHz
                </span>
                <span className="material-symbols-outlined text-[15px] text-primary">nfc</span>
              </div>
            </div>

            {/* LCD Recessed Screen (High Reflectance Paper/Matrix Style) */}
            <div className="relative bg-surface-bright p-space-md rounded-lg shadow-inner overflow-hidden flex flex-col items-center border border-outline-variant/30">
              {/* Dot-Matrix Decorative Mesh Backdrop */}
              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#003822_1px,transparent_1px)] [background-size:6px_6px]"></div>

              {/* Station / Rail Pill */}
              <div className="relative z-10 w-full flex items-center justify-between bg-surface-container-lowest text-on-surface px-space-md py-space-xs rounded-lg shadow-sm border border-outline-variant/30">
                <div className="flex items-center gap-space-xs">
                  <div className="w-4 h-4 rounded-full bg-primary-container flex items-center justify-center text-on-primary font-bold text-[9px] font-label-sm">
                    ✓
                  </div>
                  <span className="font-headline-md text-label-md text-tertiary tracking-wider font-bold">
                    {bankName} {card.category.toUpperCase()}
                  </span>
                </div>
                <span className="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider">
                  SYNCED
                </span>
              </div>

              {/* High-Fidelity Tactical QR Display */}
              <div className="relative z-10 my-space-md p-space-md bg-white rounded-xl shadow-lg flex flex-col items-center justify-center">
                {card.rawPayload ? (
                  <QRCodeSVG
                    id="presentation-qr-svg"
                    value={card.rawPayload}
                    size={220}
                    level="M"
                    includeMargin={false}
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
              <div className="relative z-10 w-full flex flex-col items-center text-center space-y-1 mt-2">
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
                  <span className="font-label-md text-label-md text-on-surface font-bold tracking-wider">
                    {formatAccountNumber(card.accountNumber, false)}
                  </span>
                  <button
                    onClick={handleCopyNumber}
                    className="ml-space-xs bg-surface-container-high hover:bg-surface-bright text-primary font-label-sm text-label-sm px-space-sm py-0.5 rounded transition-transform active:translate-y-0.5 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copiedNumber ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedNumber ? '[ COPIED ]' : '[ COPY ]'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Industrial Advisory Notice Bento */}
          <div className="bg-surface-container-low p-space-md rounded-xl flex items-start gap-space-md shadow-sm border border-outline-variant/30 text-xs">
            <div className="p-space-xs bg-surface-container-highest rounded-lg text-primary flex items-center justify-center mt-0.5">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-primary font-bold tracking-wide">
                INTEROPERABLE QRPH ROUTER
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 font-sans leading-relaxed">
                Scan natively with <strong className="text-on-surface font-semibold">GCash</strong>,{' '}
                <strong className="text-on-surface font-semibold">Maya</strong>,{' '}
                <strong className="text-on-surface font-semibold">BPI</strong>, or any compliant
                Philippine bank. Real-time P2P settlement with zero transfer surcharges.
              </p>
            </div>
          </div>

          {/* Physical Neo-Brutalist Actuator Cluster (Action Deck) */}
          <div className="flex flex-col space-y-space-sm pt-space-xs">
            <button
              onClick={handleSaveToDevice}
              className="w-full bg-primary-container text-on-primary font-headline-md text-headline-md py-3 px-space-md rounded-lg shadow-lg flex items-center justify-center gap-space-sm transition-transform active:translate-y-0.5 font-bold uppercase hover:bg-primary-fixed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              <span>[ SAVE TO DEVICE ]</span>
            </button>

            <div className="grid grid-cols-2 gap-space-sm">
              <button
                onClick={handleShare}
                className="bg-surface-container-high text-on-surface font-label-md text-label-md py-2.5 px-space-sm rounded-lg shadow-sm flex items-center justify-center gap-space-xs transition-transform active:translate-y-0.5 border border-outline-variant/30 font-bold hover:bg-surface-bright cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-tertiary">share</span>
                <span className="truncate">[ SHARE CARTRIDGE ]</span>
              </button>

              <button
                onClick={() => setIsRotated(!isRotated)}
                className="bg-surface-container-high text-on-surface font-label-md text-label-md py-2.5 px-space-sm rounded-lg shadow-sm flex items-center justify-center gap-space-xs transition-transform active:translate-y-0.5 border border-outline-variant/30 font-bold hover:bg-surface-bright cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">
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
