import React, { useState, useEffect, useRef } from 'react';
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
  cardCount?: number;
}

export const AddQRModal: React.FC<AddQRModalProps> = ({
  isOpen,
  initialCard,
  onClose,
  onSave,
  onNotify,
  cardCount = 4,
}) => {
  const [bank, setBank] = useState<BankProvider>('gcash');
  const [bankCustomName, setBankCustomName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [city, setCity] = useState('');
  const [rail, setRail] = useState('');
  const [category, setCategory] = useState<AccountCategory>('personal');
  const [notes, setNotes] = useState('');
  const [rawPayload, setRawPayload] = useState<string | undefined>();
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [decodeStatus, setDecodeStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [decodeMessage, setDecodeMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or populate form
  useEffect(() => {
    if (initialCard) {
      setBank(initialCard.bank);
      setBankCustomName(initialCard.bankCustomName || '');
      setAccountName(initialCard.accountName);
      setAccountNumber(initialCard.accountNumber);
      setCity(initialCard.city || '');
      setRail(initialCard.rail || '');
      setCategory(initialCard.category);
      setNotes(initialCard.notes || '');
      setRawPayload(initialCard.rawPayload);
      setImageDataUrl(initialCard.imageDataUrl);
      setIsFavorite(initialCard.isFavorite);
      setDecodeStatus(initialCard.rawPayload ? 'success' : 'idle');
      setDecodeMessage(initialCard.rawPayload ? 'QRPH_VERIFIED' : '');
    } else {
      resetForm();
    }
  }, [initialCard, isOpen]);

  const resetForm = () => {
    setBank('gcash');
    setBankCustomName('');
    setAccountName('');
    setAccountNumber('');
    setCity('');
    setRail('');
    setCategory('personal');
    setNotes('');
    setRawPayload(undefined);
    setImageDataUrl('');
    setIsFavorite(false);
    setDecodeStatus('idle');
    setDecodeMessage('');
    setIsSaving(false);
  };

  const processImageFile = async (file: File | Blob) => {
    setIsScanning(true);
    setDecodeStatus('idle');
    setDecodeMessage('PARSING_OPTICAL_FRAME...');

    try {
      const dataUrl = await fileToDataUrl(file);
      setImageDataUrl(dataUrl);

      const result = await decodeQRCode(dataUrl);

      if (result.success && result.payload) {
        setRawPayload(result.payload);
        const parsed = parseQRPhPayload(result.payload);

        if (parsed.isValid && parsed.isQRPh) {
          setDecodeStatus('success');
          setDecodeMessage('QRPH_VERIFIED');

          if (parsed.merchantName) setAccountName(parsed.merchantName);
          if (parsed.accountNumber) setAccountNumber(parsed.accountNumber);
          if (parsed.city) setCity(parsed.city);
          if (parsed.rail) setRail(parsed.rail);
          if (parsed.detectedBank) {
            setBank(parsed.detectedBank);
            const cfg = BANK_CONFIGS[parsed.detectedBank];
            if (cfg) setCategory(cfg.defaultCategory);
          }
          triggerHaptic('success');
          onNotify(
            `${parsed.bankName || 'Bank'} ${parsed.rail || 'QR Ph'} Verified`,
            parsed.merchantName ? `${parsed.merchantName}${parsed.city ? ` (${parsed.city})` : ''}` : 'Details auto-populated',
            'success'
          );
        } else {
          setDecodeStatus('warning');
          setDecodeMessage('RAW_QR_DETECTED');
          triggerHaptic('light');
        }
      } else {
        setRawPayload(undefined);
        setDecodeStatus('warning');
        setDecodeMessage('FRAME_SAVED // NO_QR_PATTERN');
      }
    } catch {
      setDecodeStatus('error');
      setDecodeMessage('ERR_PARSE_FAILED');
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = async () => {
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
      onNotify('No image in clipboard', 'Take a screenshot of a QR code first, then tap paste', 'info');
    } catch {
      onNotify('Clipboard permission needed', 'Paste using keyboard shortcut (Ctrl+V)', 'info');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!accountName.trim()) {
      onNotify('Missing Payee Name', 'Please enter the registered payee or account alias', 'error');
      return;
    }

    if (!accountNumber.trim()) {
      onNotify('Missing Account Number', 'Please enter account or mobile number', 'error');
      return;
    }

    setIsSaving(true);
    triggerHaptic('success');

    const cardToSave: QRCardItem = {
      id: initialCard?.id || `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bank,
      bankCustomName: bank === 'other' ? bankCustomName.trim() : undefined,
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      category,
      city: city.trim() || undefined,
      rail: rail.trim() || undefined,
      notes: notes.trim() || undefined,
      rawPayload,
      imageDataUrl: imageDataUrl || '',
      isFavorite,
      orderIndex: initialCard?.orderIndex ?? Date.now(),
      createdAt: initialCard?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };

    setTimeout(() => {
      onSave(cardToSave);
      onClose();
      resetForm();
    }, 250);
  };

  if (!isOpen) return null;

  const currentSlotNum = initialCard ? 'EDIT' : String(cardCount + 1).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-space-sm bg-surface-container-lowest/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Retro Cyberdeck Dialog Box */}
      <div
        id="add-rom-modal"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-surface-container shadow-2xl flex flex-col transition-all duration-200 border border-outline-variant/30"
      >
        {/* Top Bevel Window Titlebar */}
        <div className="sticky top-0 z-20 flex flex-col bg-surface-container-high px-space-md pt-3 pb-2.5 shadow-md border-b border-outline-variant/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-ping"></span>
              <span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">
                {initialCard ? 'RECONFIGURE ROM SLOT // UPDATE' : 'NEW ROM SLOT // INITIALIZE QR'}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="w-7 h-7 flex items-center justify-center rounded-DEFAULT bg-surface-container-lowest text-on-surface-variant hover:text-error hover:bg-surface-container transition-transform active:translate-y-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <div className="flex items-center justify-between mt-1 pt-1">
            <div className="flex items-center gap-1 font-label-sm text-label-sm text-tertiary-fixed-dim">
              <span className="material-symbols-outlined text-[12px]">memory</span>
              <span>SLOT: {currentSlotNum}/16 [{initialCard ? 'ALLOCATED' : 'UNALLOCATED'}]</span>
            </div>
          </div>
        </div>

        {/* Main Form Payload */}
        <form onSubmit={handleSubmit} className="flex flex-col p-space-md gap-space-md">
          {/* Rail Provider Matrix */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                PAYMENT PROTOCOL / RAIL
              </label>
              <span className="font-label-sm text-label-sm text-primary-fixed">
                {decodeStatus === 'success' ? 'QRPH_VERIFIED' : 'MULTI_RAIL'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {/* GCash */}
              <button
                type="button"
                onClick={() => {
                  setBank('gcash');
                  triggerHaptic('light');
                }}
                className={`rail-btn flex flex-col items-center justify-center py-2 px-1 rounded-DEFAULT transition-all active:translate-y-0.5 cursor-pointer ${
                  bank === 'gcash'
                    ? 'bg-primary-container text-on-primary-container shadow-[0_2px_0_0_#005234]'
                    : 'bg-surface-container-low text-on-surface shadow-[0_2px_0_0_#0b0e15] hover:bg-surface-container-high'
                }`}
              >
                <span className="font-label-md text-label-md font-bold">GCASH</span>
                <span className={`font-label-sm text-[8px] tracking-tight ${bank === 'gcash' ? 'opacity-80' : 'text-on-surface-variant'}`}>
                  PHP_E-WALLET
                </span>
              </button>

              {/* Maya */}
              <button
                type="button"
                onClick={() => {
                  setBank('maya');
                  triggerHaptic('light');
                }}
                className={`rail-btn flex flex-col items-center justify-center py-2 px-1 rounded-DEFAULT transition-all active:translate-y-0.5 cursor-pointer ${
                  bank === 'maya'
                    ? 'bg-primary-container text-on-primary-container shadow-[0_2px_0_0_#005234]'
                    : 'bg-surface-container-low text-on-surface shadow-[0_2px_0_0_#0b0e15] hover:bg-surface-container-high'
                }`}
              >
                <span className="font-label-md text-label-md font-bold">MAYA</span>
                <span className={`font-label-sm text-[8px] tracking-tight ${bank === 'maya' ? 'opacity-80' : 'text-on-surface-variant'}`}>
                  QRPH_BANK
                </span>
              </button>

              {/* BPI */}
              <button
                type="button"
                onClick={() => {
                  setBank('bpi');
                  triggerHaptic('light');
                }}
                className={`rail-btn flex flex-col items-center justify-center py-2 px-1 rounded-DEFAULT transition-all active:translate-y-0.5 cursor-pointer ${
                  bank === 'bpi'
                    ? 'bg-primary-container text-on-primary-container shadow-[0_2px_0_0_#005234]'
                    : 'bg-surface-container-low text-on-surface shadow-[0_2px_0_0_#0b0e15] hover:bg-surface-container-high'
                }`}
              >
                <span className="font-label-md text-label-md font-bold">BPI</span>
                <span className={`font-label-sm text-[8px] tracking-tight ${bank === 'bpi' ? 'opacity-80' : 'text-on-surface-variant'}`}>
                  DIRECT_INSTAPAY
                </span>
              </button>

              {/* GoTyme */}
              <button
                type="button"
                onClick={() => {
                  setBank('gotyme');
                  triggerHaptic('light');
                }}
                className={`rail-btn flex flex-col items-center justify-center py-2 px-1 rounded-DEFAULT transition-all active:translate-y-0.5 cursor-pointer ${
                  bank === 'gotyme'
                    ? 'bg-primary-container text-on-primary-container shadow-[0_2px_0_0_#005234]'
                    : 'bg-surface-container-low text-on-surface shadow-[0_2px_0_0_#0b0e15] hover:bg-surface-container-high'
                }`}
              >
                <span className="font-label-md text-label-md font-bold">GOTYME</span>
                <span className={`font-label-sm text-[8px] tracking-tight ${bank === 'gotyme' ? 'opacity-80' : 'text-on-surface-variant'}`}>
                  DIGITAL_REWARD
                </span>
              </button>

              {/* UnionBank (UBP) */}
              <button
                type="button"
                onClick={() => {
                  setBank('unionbank');
                  triggerHaptic('light');
                }}
                className={`rail-btn flex flex-col items-center justify-center py-2 px-1 rounded-DEFAULT transition-all active:translate-y-0.5 cursor-pointer ${
                  bank === 'unionbank'
                    ? 'bg-primary-container text-on-primary-container shadow-[0_2px_0_0_#005234]'
                    : 'bg-surface-container-low text-on-surface shadow-[0_2px_0_0_#0b0e15] hover:bg-surface-container-high'
                }`}
              >
                <span className="font-label-md text-label-md font-bold">UBP</span>
                <span className={`font-label-sm text-[8px] tracking-tight ${bank === 'unionbank' ? 'opacity-80' : 'text-on-surface-variant'}`}>
                  FAST_DIRECT
                </span>
              </button>

              {/* Generic QRPh / Other */}
              <button
                type="button"
                onClick={() => {
                  setBank('other');
                  triggerHaptic('light');
                }}
                className={`rail-btn flex flex-col items-center justify-center py-2 px-1 rounded-DEFAULT transition-all active:translate-y-0.5 cursor-pointer ${
                  bank === 'other'
                    ? 'bg-primary-container text-on-primary-container shadow-[0_2px_0_0_#005234]'
                    : 'bg-surface-container-low text-on-surface shadow-[0_2px_0_0_#0b0e15] hover:bg-surface-container-high'
                }`}
              >
                <span className="font-label-md text-label-md font-bold">ANY QRPH</span>
                <span className={`font-label-sm text-[8px] tracking-tight ${bank === 'other' ? 'opacity-80' : 'text-on-surface-variant'}`}>
                  GENERIC_SPEC
                </span>
              </button>
            </div>

            {/* Custom Bank Name if OTHER is selected */}
            {bank === 'other' && (
              <div className="mt-1">
                <input
                  type="text"
                  placeholder="CUSTOM RAIL NAME (e.g. SEABANK, RCBC, CIMB)"
                  value={bankCustomName}
                  onChange={(e) => setBankCustomName(e.target.value)}
                  className="w-full bg-surface-container-lowest p-2 rounded text-xs font-mono border border-outline-variant/40 focus:border-primary-fixed-dim outline-none text-on-surface placeholder:text-outline/60 uppercase"
                />
              </div>
            )}
          </div>

          {/* QR Code Optical Capture Area */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                OPTICAL MATRIX / PAYLOAD
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePaste}
                  className="font-label-sm text-label-sm text-primary-fixed hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px]">content_paste</span>
                  <span>PASTE CLIPBOARD</span>
                </button>
                <span className="font-label-sm text-label-sm text-tertiary-fixed">JPG/PNG/BMP</span>
              </div>
            </div>

            {/* Tactile Scanner Dropzone */}
            <div
              id="dropzone-area"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative group cursor-pointer overflow-hidden p-space-md rounded-lg bg-surface-container-lowest flex flex-col items-center justify-center min-h-[140px] shadow-inner transition-all active:scale-[0.99] border ${
                isDragging
                  ? 'border-primary-container bg-primary-container/10'
                  : imageDataUrl
                  ? 'border-primary-fixed-dim/40'
                  : 'border-outline-variant/30 hover:border-outline-variant'
              }`}
            >
              {/* Crosshairs Visual Reticle */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-primary-fixed-dim pointer-events-none opacity-80"></div>
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-primary-fixed-dim pointer-events-none opacity-80"></div>
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-primary-fixed-dim pointer-events-none opacity-80"></div>
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-primary-fixed-dim pointer-events-none opacity-80"></div>

              {/* Optical Grid Lines Pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(#1d2027_1px,transparent_1px)] [background-size:8px_8px] opacity-40 pointer-events-none"></div>

              {/* Preview Thumbnail if image uploaded */}
              {imageDataUrl ? (
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-primary-fixed-dim shadow-md bg-white p-1">
                    <img
                      src={imageDataUrl}
                      alt="Uploaded QR"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="font-headline-md text-[13px] text-primary-fixed uppercase font-bold">
                    {decodeStatus === 'success' ? 'QR MATRIX ACQUIRED' : 'IMAGE LOADED'}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    TAP TO CHANGE OR REPLACE FRAME
                  </span>
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center gap-1 text-center">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high text-primary-fixed flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-[24px]">
                      {isScanning ? 'sync' : 'document_scanner'}
                    </span>
                  </div>
                  <span className="font-headline-md text-[14px] text-on-surface mt-1 uppercase font-bold">
                    {isScanning ? 'PROCESSING OPTICAL FRAME...' : 'LOAD QR IMAGE / SCREENSHOT'}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    TAP TO OPEN CAMERA OR DRAG &amp; DROP MATRIX
                  </span>
                </div>
              )}

              {/* Upload Badge */}
              <div className="relative z-10 flex items-center gap-1 mt-2 px-2 py-0.5 rounded-DEFAULT bg-surface-container text-primary-fixed-dim font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[12px]">
                  {decodeStatus === 'success' ? 'verified' : 'filter_center_focus'}
                </span>
                <span>
                  {decodeMessage || 'AUTO_PARSE_QRPH ENABLED'}
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Account / ROM Alias Field */}
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-primary-fixed">badge</span>
              <span>ACCOUNT / ROM ALIAS (NAME)</span>
            </label>
            <div className="rounded-DEFAULT bg-surface-container-lowest p-2 shadow-inner focus-within:ring-1 focus-within:ring-primary-fixed-dim border border-outline-variant/30">
              <input
                id="rom-alias"
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., JUAN D.C. // SAVINGS"
                className="w-full bg-transparent font-headline-md text-on-surface placeholder:text-outline/60 text-[14px] outline-none tracking-wide"
                required
              />
            </div>
          </div>

          {/* Account Number / Reference ID (Masked/Optional) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-tertiary-fixed">fingerprint</span>
                <span>ACCOUNT REF / MASKED DIGITS</span>
              </label>
              <span className="font-label-sm text-label-sm text-outline">REQUIRED FOR SENDER</span>
            </div>
            <div className="rounded-DEFAULT bg-surface-container-lowest p-2 shadow-inner focus-within:ring-1 focus-within:ring-tertiary-fixed-dim border border-outline-variant/30">
              <input
                id="rom-number"
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g., 0917 ••• 8821 or 1234 5678"
                className="w-full bg-transparent font-label-md text-on-surface placeholder:text-outline/60 text-label-md outline-none"
                required
              />
            </div>
          </div>



          {/* Hardware Write Telemetry Status Strip */}
          <div className="flex items-center justify-between p-2 rounded-DEFAULT bg-surface-container-lowest border border-outline-variant/20">
            <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] text-primary-fixed">storage</span>
              <span>MEM: EEPROM_CHIP_#{currentSlotNum}</span>
            </div>
            <span className="font-label-sm text-label-sm text-primary-fixed font-bold">
              STATUS: {decodeStatus === 'success' ? 'PAYLOAD_VERIFIED' : 'READY_TO_BURN'}
            </span>
          </div>

          {/* Tactical Deck Action Buttons */}
          <div className="sticky bottom-0 z-20 flex flex-col gap-2 pt-2 bg-surface-container shadow-[0_-8px_16px_rgba(0,0,0,0.5)]">
            {/* Primary Burn Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-3 px-space-md rounded-DEFAULT bg-primary-container text-on-primary-container font-headline-md text-headline-md tracking-wider uppercase font-bold shadow-[0_4px_0_0_#005234] hover:bg-primary transition-all active:translate-y-1 active:shadow-none cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[20px] ${isSaving ? 'animate-spin' : ''}`}>
                {isSaving ? 'refresh' : 'local_fire_department'}
              </span>
              <span>{isSaving ? 'FLASHING ROM...' : (initialCard ? 'RE-BURN ROM / UPDATE' : 'BURN TO ROM / SAVE QR')}</span>
            </button>

            {/* Secondary Discard Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-2 px-space-md rounded-DEFAULT bg-surface-container-low text-on-surface font-label-md text-label-md uppercase tracking-wider shadow-[0_2px_0_0_#0b0e15] hover:bg-surface-container-lowest transition-all active:translate-y-0.5 cursor-pointer border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-[16px] text-error">cancel</span>
              <span>ABORT // DISCARD SLOT</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
