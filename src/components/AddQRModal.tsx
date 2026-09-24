import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { QRCardItem, BankProvider, AccountCategory } from '../types/qr';
import { BANK_CONFIGS } from '../types/qr';
import { decodeQRCode, fileToDataUrl } from '../lib/qrDecoder';
import { parseQRPhPayload } from '../lib/emvcoParser';
import { triggerHaptic } from '../lib/security';

interface AddQRModalProps {
  isOpen: boolean;
  initialCard?: QRCardItem | null;
  onClose: () => void;
  onSave: (card: QRCardItem) => void;
  onNotify: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
}

export const AddQRModal: React.FC<AddQRModalProps> = ({
  isOpen,
  initialCard,
  onClose,
  onSave,
  onNotify,
}) => {
  const [bank, setBank] = useState<BankProvider>('gcash');
  const [bankCustomName, setBankCustomName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [category, setCategory] = useState<AccountCategory>('personal');
  const [notes, setNotes] = useState('');
  const [rawPayload, setRawPayload] = useState<string | undefined>();
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [decodeStatus, setDecodeStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [decodeMessage, setDecodeMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Initialize or populate form
  useEffect(() => {
    if (initialCard) {
      setBank(initialCard.bank);
      setBankCustomName(initialCard.bankCustomName || '');
      setAccountName(initialCard.accountName);
      setAccountNumber(initialCard.accountNumber);
      setCategory(initialCard.category);
      setNotes(initialCard.notes || '');
      setRawPayload(initialCard.rawPayload);
      setImageDataUrl(initialCard.imageDataUrl);
      setIsFavorite(initialCard.isFavorite);
      setDecodeStatus(initialCard.rawPayload ? 'success' : 'idle');
      setDecodeMessage(initialCard.rawPayload ? 'EMVCo payload verified' : '');
    } else {
      resetForm();
    }
  }, [initialCard, isOpen]);

  const resetForm = () => {
    setBank('gcash');
    setBankCustomName('');
    setAccountName('');
    setAccountNumber('');
    setCategory('personal');
    setNotes('');
    setRawPayload(undefined);
    setImageDataUrl('');
    setIsFavorite(false);
    setDecodeStatus('idle');
    setDecodeMessage('');
  };

  const processImageFile = async (file: File | Blob) => {
    setIsScanning(true);
    setDecodeStatus('idle');
    setDecodeMessage('Processing optical frame...');

    try {
      const dataUrl = await fileToDataUrl(file);
      setImageDataUrl(dataUrl);

      const result = await decodeQRCode(dataUrl);

      if (result.success && result.payload) {
        setRawPayload(result.payload);
        const parsed = parseQRPhPayload(result.payload);

        if (parsed.isValid && parsed.isQRPh) {
          setDecodeStatus('success');
          setDecodeMessage('QR Ph EMVCo Standard Verified');

          if (parsed.merchantName) setAccountName(parsed.merchantName);
          if (parsed.accountNumber) setAccountNumber(parsed.accountNumber);
          if (parsed.detectedBank) {
            setBank(parsed.detectedBank);
            const cfg = BANK_CONFIGS[parsed.detectedBank];
            if (cfg) setCategory(cfg.defaultCategory);
          }
          triggerHaptic('success');
          onNotify('QR Ph Verified', parsed.merchantName || 'Details auto-populated', 'success');
        } else {
          setDecodeStatus('warning');
          setDecodeMessage('Valid QR detected (non-standard EMVCo payload)');
          triggerHaptic('light');
        }
      } else {
        setRawPayload(undefined);
        setDecodeStatus('warning');
        setDecodeMessage('Visual frame saved. No readable QR pattern found.');
      }
    } catch {
      setDecodeStatus('error');
      setDecodeMessage('Error processing image. Please try another file.');
      triggerHaptic('error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleClipboardPaste = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        onNotify('Clipboard Access', 'Use Ctrl+V or upload an image file instead', 'info');
        return;
      }

      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            await processImageFile(blob);
            return;
          }
        }
      }
      onNotify('No image in clipboard', 'Screenshot a QR code first, then tap paste', 'info');
    } catch {
      onNotify('Clipboard permission needed', 'Paste using keyboard shortcut (Ctrl+V)', 'info');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountName.trim()) {
      onNotify('Missing Payee Name', 'Please enter the registered payee or merchant name', 'error');
      return;
    }

    if (!accountNumber.trim()) {
      onNotify('Missing Account Number', 'Please enter the mobile or account number', 'error');
      return;
    }

    if (!imageDataUrl && !rawPayload) {
      onNotify('Missing QR Code', 'Please upload or capture a QR code screenshot', 'error');
      return;
    }

    const card: QRCardItem = {
      id: initialCard ? initialCard.id : `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      bank,
      bankCustomName: bank === 'other' ? bankCustomName.trim() : undefined,
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim().replace(/\s+/g, ''),
      category,
      notes: notes.trim() || undefined,
      rawPayload,
      imageDataUrl: imageDataUrl || '',
      isFavorite,
      orderIndex: initialCard ? initialCard.orderIndex : Date.now(),
      createdAt: initialCard ? initialCard.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    onSave(card);
    onClose();
  };

  if (!isOpen) return null;

  const banksList: BankProvider[] = [
    'gcash',
    'maya',
    'bpi',
    'gotyme',
    'rcbc',
    'unionbank',
    'bdo',
    'seabank',
    'other',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-surface/95 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto safe-p">
      <div className="relative w-full max-w-md bg-surface text-on-surface rounded-2xl border border-outline-variant/50 shadow-2xl p-space-md flex flex-col font-mono select-none my-auto">
        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Top Hardware Telemetry Strip */}
        <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm pb-2 border-b border-outline-variant/30">
          <div className="flex items-center gap-space-xs">
            <span className="text-primary-fixed uppercase font-bold">EEPROM_PROGRAMMER</span>
            <span className="text-outline">::</span>
            <span className="text-tertiary">SLOT-WRITER</span>
          </div>
          <div className="flex items-center gap-space-xs text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
            <span>READY</span>
          </div>
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between mt-2 mb-3">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-primary-fixed">
              <span className="material-symbols-outlined text-[18px]">developer_board</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md tracking-tight text-on-surface uppercase font-bold text-sm sm:text-base">
                {initialCard ? 'MODIFY ROM CARTRIDGE' : 'PROGRAM NEW ROM'}
              </h2>
              <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                LOCAL-FIRST • ENCRYPTED INDEXED-DB
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm text-xs">
          {/* Optical Sensor Slot (QR Upload Dropzone) */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative bg-surface-container-lowest rounded-xl p-space-sm border-2 border-dashed border-outline-variant/60 hover:border-primary-fixed transition-colors flex flex-col items-center justify-center cursor-pointer min-h-[110px]"
          >
            {isScanning ? (
              <div className="flex flex-col items-center gap-1.5 text-primary-fixed py-2">
                <span className="material-symbols-outlined text-[24px] animate-spin">refresh</span>
                <span className="font-label-sm text-label-sm tracking-wider">
                  DECODING OPTIC FRAME...
                </span>
              </div>
            ) : imageDataUrl ? (
              <div className="flex items-center gap-space-sm w-full">
                <div className="relative w-16 h-16 bg-surface-container-high rounded-lg p-1 border border-outline-variant/40 shrink-0 flex items-center justify-center">
                  {rawPayload ? (
                    <div className="bg-white p-0.5 rounded">
                      <QRCodeSVG value={rawPayload} size={54} level="M" />
                    </div>
                  ) : (
                    <img
                      src={imageDataUrl}
                      alt="Preview"
                      className="w-full h-full object-cover rounded"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`flex items-center gap-1 font-bold font-label-sm text-label-sm ${
                      decodeStatus === 'error'
                        ? 'text-error'
                        : decodeStatus === 'warning'
                        ? 'text-secondary'
                        : 'text-primary-fixed'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {decodeStatus === 'error'
                        ? 'error'
                        : decodeStatus === 'warning'
                        ? 'warning'
                        : 'check_circle'}
                    </span>
                    <span>
                      {decodeStatus === 'error'
                        ? 'PARSE ERROR'
                        : decodeStatus === 'warning'
                        ? 'FRAME DETECTED'
                        : 'QRPH VERIFIED'}
                    </span>
                  </div>
                  <p className="font-label-sm text-[10px] text-on-surface-variant truncate mt-0.5">
                    {decodeMessage || 'Ready to write to EEPROM'}
                  </p>
                  <span className="font-label-sm text-[9px] text-tertiary-fixed underline mt-1 block">
                    TAP TO REPLACE IMAGE
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-center py-2">
                <span className="material-symbols-outlined text-[28px] text-outline">
                  qr_code_scanner
                </span>
                <span className="font-label-sm text-label-sm text-on-surface font-bold">
                  INSERT QR IMAGE SOURCE
                </span>
                <span className="font-label-sm text-[10px] text-outline">
                  TAP TO BROWSE OR DRAG SCREENSHOT
                </span>
              </div>
            )}
          </div>

          {/* Hardware Source Actuators (Camera, Gallery, Clipboard) */}
          <div className="grid grid-cols-3 gap-space-xs font-mono">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="py-1.5 px-1 bg-surface-container-high hover:bg-surface-bright rounded border border-outline-variant/30 text-on-surface flex items-center justify-center gap-1 font-label-sm text-label-sm active:translate-y-0.5 transition-all"
            >
              <span className="material-symbols-outlined text-[14px] text-primary-fixed">
                photo_camera
              </span>
              <span>CAMERA</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-1.5 px-1 bg-surface-container-high hover:bg-surface-bright rounded border border-outline-variant/30 text-on-surface flex items-center justify-center gap-1 font-label-sm text-label-sm active:translate-y-0.5 transition-all"
            >
              <span className="material-symbols-outlined text-[14px] text-tertiary">
                photo_library
              </span>
              <span>GALLERY</span>
            </button>

            <button
              type="button"
              onClick={handleClipboardPaste}
              className="py-1.5 px-1 bg-surface-container-high hover:bg-surface-bright rounded border border-outline-variant/30 text-on-surface flex items-center justify-center gap-1 font-label-sm text-label-sm active:translate-y-0.5 transition-all"
            >
              <span className="material-symbols-outlined text-[14px] text-secondary">
                content_paste
              </span>
              <span>PASTE</span>
            </button>
          </div>

          {/* Bank / Provider Selector Ribbon */}
          <div className="flex flex-col gap-1 mt-1">
            <label className="font-label-sm text-label-sm text-outline uppercase font-bold">
              BANK / E-WALLET CARTRIDGE TYPE
            </label>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {banksList.map((b) => {
                const isSelected = bank === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setBank(b);
                      triggerHaptic('light');
                    }}
                    className={`px-2.5 py-1 rounded font-label-sm text-label-sm uppercase font-bold shrink-0 transition-all border ${
                      isSelected
                        ? 'bg-primary-container text-on-primary border-primary-fixed'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant/40 hover:text-on-surface'
                    }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom bank name if "other" is selected */}
          {bank === 'other' && (
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-outline uppercase">
                CUSTOM INSTITUTION NAME
              </label>
              <input
                type="text"
                placeholder="e.g. Maya Business, Security Bank"
                value={bankCustomName}
                onChange={(e) => setBankCustomName(e.target.value)}
                className="bg-surface-container-lowest border border-outline-variant/80 rounded-lg px-3 py-2 text-on-surface font-mono text-xs focus:outline-none focus:border-primary-fixed"
              />
            </div>
          )}

          {/* Payee Registered Name */}
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-outline uppercase font-bold">
              PAYEE NAME // REGISTERED
            </label>
            <input
              type="text"
              required
              placeholder="e.g. JUAN DELA CRUZ"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant/80 rounded-lg px-3 py-2 text-on-surface font-headline-md text-sm font-bold uppercase focus:outline-none focus:border-primary-fixed"
            />
          </div>

          {/* Account / Mobile Number */}
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-outline uppercase font-bold">
              MOBILE / ACCOUNT NUMBER
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 0917 839 8821"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant/80 rounded-lg px-3 py-2 text-on-surface font-mono text-sm tracking-wider font-bold focus:outline-none focus:border-primary-fixed"
            />
          </div>

          {/* Channel Category Selector */}
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-outline uppercase font-bold">
              VAULT CHANNEL
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['personal', 'business', 'savings'] as AccountCategory[]).map((cat) => {
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`py-1.5 rounded font-label-sm text-label-sm uppercase font-bold transition-all border ${
                      isSelected
                        ? 'bg-surface-container-highest text-primary-fixed border-primary-fixed-dim/50'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:text-on-surface'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-outline uppercase">
              CARTRIDGE TAG / NOTES
            </label>
            <input
              type="text"
              placeholder="e.g. Personal allowance, Store counter"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant/80 rounded-lg px-3 py-2 text-on-surface font-mono text-xs focus:outline-none focus:border-primary-fixed"
            />
          </div>

          {/* Action Deck */}
          <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/30 mt-1">
            <button
              type="submit"
              className="w-full bg-primary-container text-on-primary font-headline-md text-headline-md font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all active:translate-y-1 uppercase tracking-wider hover:bg-primary-fixed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>[ PROGRAM ROM &amp; SAVE ]</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full bg-surface-container-high text-on-surface font-label-sm text-label-sm py-2 rounded-lg border border-outline-variant/30 font-bold uppercase hover:bg-surface-bright"
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
