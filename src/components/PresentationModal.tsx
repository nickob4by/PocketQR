import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  X,
  RotateCw,
  Sun,
  Maximize,
  Minimize,
  Copy,
  Check,
  ShieldCheck,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import type { QRCardItem } from '../types/qr';
import { BANK_CONFIGS } from '../types/qr';
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
  const [viewMode, setViewMode] = useState<'vector' | 'original'>('vector');
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Default to original image if no rawPayload available
  useEffect(() => {
    if (card && !card.rawPayload) {
      setViewMode('original');
    } else {
      setViewMode('vector');
    }
    setIsRotated(false);
  }, [card]);

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
        } catch (err) {
          console.warn('Wake Lock error:', err);
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

  const bankConfig = BANK_CONFIGS[card.bank] || BANK_CONFIGS.other;

  const toggleRotation = () => {
    setIsRotated(!isRotated);
    triggerHaptic('light');
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
      triggerHaptic('light');
    } catch (e) {
      console.warn('Fullscreen error:', e);
    }
  };

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(card.accountNumber);
    setCopiedNumber(true);
    triggerHaptic('success');
    try {
      confetti({
        particleCount: 30,
        spread: 45,
        origin: { y: 0.8 },
      });
    } catch {}
    onNotify('Account Number Copied!', card.accountNumber, 'success');
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleCopyAll = () => {
    const details = [
      `Send via QR Ph / InstaPay:`,
      `Bank / Wallet: ${card.bankCustomName || bankConfig.name}`,
      `Account Name: ${card.accountName}`,
      `Account Number: ${card.accountNumber}`,
      card.notes ? `Note: ${card.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(details);
    setCopiedAll(true);
    triggerHaptic('success');
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.85 },
      });
    } catch {}
    onNotify('All Details Copied!', 'Account and bank details ready to paste', 'success');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/92 backdrop-blur-2xl animate-in fade-in duration-200 safe-p">
      {/* Background ambient lighting matching the bank */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none transition-colors duration-500"
        style={{
          background: `radial-gradient(circle at center, ${bankConfig.accentColor} 0%, transparent 70%)`,
        }}
      />

      <div className="relative w-full max-w-lg md:max-w-2xl lg:max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96dvh] modal-overscroll-contain">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950/70 backdrop-blur-md shrink-0">
          {/* Bank tag & Wake lock indicator */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold ${bankConfig.badgeBg} ${bankConfig.badgeText} border border-white/10`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: bankConfig.accentColor }}
              />
              {card.bankCustomName || bankConfig.name}
            </span>

            {wakeLockActive && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-amber-300/90 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Awake
              </span>
            )}
          </div>

          {/* Action buttons: Rotate, Fullscreen, Close (44px touch targets) */}
          <div className="flex items-center gap-2">
            {/* Flip 180 button for cashier */}
            <button
              onClick={toggleRotation}
              title={isRotated ? 'Reset Orientation' : 'Flip 180° for Cashier across counter'}
              className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                isRotated
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <RotateCw
                className={`w-4 h-4 transition-transform duration-300 ${
                  isRotated ? 'rotate-180' : ''
                }`}
              />
              <span>{isRotated ? 'Flipped' : 'Flip 180°'}</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center justify-center"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-rose-900/40 hover:border-rose-700 transition-colors flex items-center justify-center"
              aria-label="Close presentation mode"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode Switcher (Vector vs Original Screenshot) */}
        {card.rawPayload && (
          <div className="flex items-center justify-center gap-2 py-1.5 px-4 bg-slate-950/50 border-b border-slate-800/60 shrink-0">
            <button
              onClick={() => setViewMode('vector')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'vector'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Razor-Sharp Vector</span>
            </button>
            <button
              onClick={() => setViewMode('original')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'original'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Original Screenshot</span>
            </button>
          </div>
        )}

        {/* Adaptive Body: Stacked on Portrait phones, Side-by-Side on Landscape / Tablets */}
        <div className="flex-1 overflow-y-auto touch-scroll flex flex-col md:flex-row items-center md:items-stretch justify-center bg-slate-950/40">
          {/* Left / Center QR Container */}
          <div className="flex-1 p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center">
            <div
              className={`transition-transform duration-500 ease-in-out ${
                isRotated ? 'rotate-180' : ''
              }`}
            >
              <div className="qr-quiet-zone p-4 sm:p-6 md:p-8 rounded-3xl flex flex-col items-center justify-center border-4 border-white max-w-[85vw] sm:max-w-none">
                {/* Brand mini header in quiet zone */}
                <div className="flex items-center gap-1.5 mb-2 text-slate-900">
                  <span className="font-extrabold tracking-tight text-xs sm:text-sm font-sans">
                    {card.bankCustomName || bankConfig.name}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-red-600 text-white rounded">
                    QR Ph
                  </span>
                </div>

                {/* QR Code Matrix (Fluid responsiveness) */}
                <div className="relative flex items-center justify-center">
                  {viewMode === 'vector' && card.rawPayload ? (
                    <QRCodeSVG
                      value={card.rawPayload}
                      size={260}
                      level="Q"
                      includeMargin={false}
                      className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] md:w-[260px] md:h-[260px] lg:w-[280px] lg:h-[280px]"
                    />
                  ) : (
                    <img
                      src={card.imageDataUrl}
                      alt={card.accountName}
                      className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] md:w-[260px] md:h-[260px] lg:w-[280px] lg:h-[280px] object-contain rounded"
                    />
                  )}
                </div>

                {/* Scannable Notice */}
                <div className="mt-2.5 flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Optical QR Ph Scannable</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column / Bottom Sheet: Account Details & Actions */}
          <div className="w-full md:w-80 lg:w-96 p-4 sm:p-6 bg-slate-900/90 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col justify-center shrink-0">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Account Holder
              </span>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight break-words mt-0.5">
                {card.accountName}
              </h2>
            </div>

            {/* Account Number Box */}
            <div className="mt-4 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">
                Account / Mobile Number
              </span>
              <span className="font-mono text-base sm:text-lg md:text-xl font-bold text-slate-100 tracking-wider block mt-1">
                {formatAccountNumber(card.accountNumber, false)}
              </span>
            </div>

            {/* Action Buttons (Full-width on tablet sidebar) */}
            <div className="mt-4 space-y-2.5">
              {/* Copy Number */}
              <button
                onClick={handleCopyNumber}
                className={`min-h-[44px] w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-98 ${
                  copiedNumber
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                }`}
              >
                {copiedNumber ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedNumber ? 'Number Copied!' : 'Copy Account Number'}</span>
              </button>

              {/* Copy All Details */}
              <button
                onClick={handleCopyAll}
                className={`min-h-[44px] w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-colors active:scale-98 ${
                  copiedAll
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750'
                }`}
              >
                {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedAll ? 'All Info Copied!' : 'Copy All Transfer Info'}</span>
              </button>
            </div>

            {/* Notes Snippet */}
            {card.notes && (
              <p className="mt-3 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <span className="font-semibold text-slate-300">Note: </span>
                {card.notes}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
