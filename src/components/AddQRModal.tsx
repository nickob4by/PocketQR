import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Upload,
  Clipboard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Shield,
  Camera,
  Image,
} from 'lucide-react';
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
  const [isDragging, setIsDragging] = useState(false);

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

  // Global paste handler while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          await processImageFile(file);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

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
    setIsScanning(false);
    setDecodeStatus('idle');
    setDecodeMessage('');
  };

  const processImageFile = async (file: File | Blob) => {
    setIsScanning(true);
    setDecodeStatus('idle');
    setDecodeMessage('');

    try {
      // 1. Convert to data URL
      const dataUrl = await fileToDataUrl(file);
      setImageDataUrl(dataUrl);

      // 2. Decode client-side using jsQR
      const result = await decodeQRCode(dataUrl);

      if (result.success && result.payload) {
        setRawPayload(result.payload);

        // 3. Parse EMVCo / QR Ph
        const parsed = parseQRPhPayload(result.payload);

        if (parsed.detectedBank) {
          setBank(parsed.detectedBank);
        }
        if (parsed.merchantName && !accountName) {
          setAccountName(parsed.merchantName);
        }
        if (parsed.accountNumber && !accountNumber) {
          setAccountNumber(parsed.accountNumber);
        }

        setDecodeStatus('success');
        setDecodeMessage(
          parsed.isQRPh
            ? `Verified QR Ph standard payload (${parsed.detectedBank ? BANK_CONFIGS[parsed.detectedBank].name : 'Merchant'} detected)`
            : 'QR Code detected & decoded into vector format'
        );
        triggerHaptic('success');
        onNotify('QR Code Detected!', 'Bank details automatically extracted from QR Ph payload', 'success');
      } else {
        setRawPayload(undefined);
        setDecodeStatus('warning');
        setDecodeMessage('Image loaded! QR code could not be auto-read, but you can enter details manually.');
        triggerHaptic('warning');
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
      onNotify('No image in clipboard', 'Copy or screenshot a QR code first, then click paste', 'info');
    } catch {
      onNotify('Clipboard permission needed', 'Paste using keyboard shortcut (Ctrl+V / Cmd+V)', 'info');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        await processImageFile(file);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountName.trim()) {
      onNotify('Missing Account Name', 'Please enter the account or merchant name', 'error');
      return;
    }

    if (!accountNumber.trim()) {
      onNotify('Missing Account Number', 'Please enter the mobile or account number', 'error');
      return;
    }

    if (!imageDataUrl && !rawPayload) {
      onNotify('Missing QR Code', 'Please upload, snap, or paste a QR code screenshot', 'error');
      return;
    }

    const card: QRCardItem = {
      id: initialCard ? initialCard.id : `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200 safe-p">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] modal-overscroll-contain">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {initialCard ? 'Edit QR Ph Card' : 'Add QR Ph Payment Card'}
              </h2>
              <p className="text-xs text-slate-400">Works 100% offline • Stored locally</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto touch-scroll p-4 sm:p-6 space-y-5">
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

          {/* Ingestion Dropzone & Camera Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              QR Code Screenshot / Photo
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[140px] ${
                isDragging
                  ? 'border-blue-500 bg-blue-950/30'
                  : imageDataUrl
                  ? 'border-emerald-500/40 bg-slate-950/60'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/70'
              }`}
            >
              {isScanning ? (
                <div className="flex flex-col items-center gap-2 text-blue-400 py-3">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span className="text-xs font-medium">Scanning & decoding QR Ph with jsQR...</span>
                </div>
              ) : imageDataUrl ? (
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 bg-white rounded-xl shadow-md shrink-0">
                    {rawPayload ? (
                      <QRCodeSVG value={rawPayload} size={64} level="M" />
                    ) : (
                      <img src={imageDataUrl} alt="Preview" className="w-16 h-16 object-cover rounded" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Image Loaded Successfully</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {decodeMessage || 'Ready to save'}
                    </p>
                    <span className="inline-block mt-1 text-[10px] text-blue-400 hover:underline">
                      Tap or drop to replace image
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-200">
                      Upload QR screenshot or photo
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Drag & drop here (PNG, JPG, WEBP)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Cross-Device Action Bar: Camera, Gallery & Clipboard */}
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[44px] flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Take Photo</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
              >
                <Image className="w-4 h-4 text-blue-400" />
                <span>Gallery</span>
              </button>

              <button
                type="button"
                onClick={handleClipboardPaste}
                className="min-h-[44px] flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
              >
                <Clipboard className="w-4 h-4 text-amber-400" />
                <span>Paste</span>
              </button>
            </div>

            {/* Decode Status Banner */}
            {decodeStatus === 'success' && (
              <div className="mt-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-2 text-xs text-emerald-300">
                <Shield className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="truncate">{decodeMessage}</span>
              </div>
            )}
            {decodeStatus === 'warning' && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 flex items-center gap-2 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{decodeMessage}</span>
              </div>
            )}
          </div>

          {/* Bank / Provider Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Bank / E-Wallet Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(BANK_CONFIGS) as BankProvider[]).map((pKey) => {
                const cfg = BANK_CONFIGS[pKey];
                const isSelected = bank === pKey;
                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => {
                      setBank(pKey);
                      if (!category || category === 'personal') {
                        setCategory(cfg.defaultCategory);
                      }
                      triggerHaptic('light');
                    }}
                    className={`min-h-[44px] flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border text-left transition-all ${
                      isSelected
                        ? `bg-slate-800 ${cfg.borderAccent} text-white shadow-md shadow-black/40 ring-1 ring-white/20`
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cfg.accentColor }}
                    />
                    <span className="truncate">{cfg.shortName}</span>
                  </button>
                );
              })}
            </div>

            {bank === 'other' && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Custom Bank or Wallet Name (e.g. Landbank, Tonik)"
                  value={bankCustomName}
                  onChange={(e) => setBankCustomName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>
            )}
          </div>

          {/* Account Details Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Account Holder Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Nick Vincent G."
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Account or Mobile No. <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 0917 123 4567 or 100988887890"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          {/* Category & Favorite */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Account Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AccountCategory)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                <option value="personal">Personal Account</option>
                <option value="business">Business / Merchant</option>
                <option value="savings">Savings / Vault</option>
                <option value="bill-split">Bill Splitting</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2 sm:pt-6">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm font-medium text-slate-300 select-none min-h-[44px]">
                <input
                  type="checkbox"
                  checked={isFavorite}
                  onChange={(e) => setIsFavorite(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                />
                <span>Pin to Favorites (Top of Wallet)</span>
              </label>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Notes or Transfer Instructions (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Please screenshot receipt, or Free InstaPay transfers"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
        </form>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-950/30 active:scale-95 transition-all"
          >
            {initialCard ? 'Save Changes' : 'Add to Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
};
