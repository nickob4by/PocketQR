import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Check,
  Star,
  Maximize2,
  MoreVertical,
  Trash2,
  Edit2,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
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
  const [copiedAll, setCopiedAll] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [localReveal, setLocalReveal] = useState(false);

  const bankConfig = BANK_CONFIGS[card.bank] || BANK_CONFIGS.other;
  const isMasked = privacyMask && !localReveal;

  const handleCopyNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(card.accountNumber);
    setCopiedNumber(true);
    triggerHaptic('success');
    onNotify('Account Number Copied!', card.accountNumber, 'success');
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleCopyAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const details = [
      `Bank / Wallet: ${card.bankCustomName || bankConfig.name}`,
      `Account Name: ${card.accountName}`,
      `Account Number: ${card.accountNumber}`,
      card.notes ? `Notes: ${card.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(details);
    setCopiedAll(true);
    triggerHaptic('success');
    onNotify('All Details Copied!', 'Ready to paste into your banking app', 'success');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${bankConfig.gradient} border ${bankConfig.borderAccent} shadow-wallet hover:shadow-2xl transition-all duration-300 wallet-card-active`}
    >
      {/* Decorative Gloss Sheen */}
      <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none group-hover:scale-110 transition-transform duration-500" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/30 pointer-events-none" />

      {/* Card Header */}
      <div className="relative z-10 flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* Bank Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md ${bankConfig.badgeBg} ${bankConfig.badgeText} border border-white/10`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: bankConfig.accentColor }}
            />
            {card.bankCustomName || bankConfig.name}
          </span>

          {/* Category Tag */}
          <span className="text-[11px] capitalize font-medium text-slate-300/80 bg-black/30 px-2 py-0.5 rounded-md border border-white/5">
            {card.category}
          </span>
        </div>

        {/* Favorite & Options */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(card.id);
              triggerHaptic('light');
            }}
            aria-label={card.isFavorite ? 'Unfavorite card' : 'Favorite card'}
            className="p-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-white/10 transition-colors"
          >
            <Star
              className={`w-4 h-4 transition-transform active:scale-125 ${
                card.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
              }`}
            />
          </button>

          {/* Menu Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              aria-label="More options"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
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
                <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onEdit(card);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    Edit Details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete(card.id);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Card
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Card Content: QR Preview + Info */}
      <div className="relative z-10 flex items-center gap-4">
        {/* Scannable High-Contrast QR Thumbnail */}
        <div
          onClick={() => onPresent(card)}
          title="Tap to enlarge for cashier scanning"
          className="group/qr relative p-2 bg-white rounded-xl shadow-lg cursor-pointer shrink-0 transition-transform hover:scale-105 active:scale-95"
        >
          {card.rawPayload ? (
            <QRCodeSVG
              value={card.rawPayload}
              size={82}
              level="M"
              includeMargin={false}
              className="rounded"
            />
          ) : (
            <img
              src={card.imageDataUrl}
              alt={card.accountName}
              className="w-[82px] h-[82px] object-cover rounded"
            />
          )}

          {/* Hover overlay with maximize indicator */}
          <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover/qr:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Account Details */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
            {card.accountName}
          </h3>

          {/* Account Number with 1-Tap Copy */}
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-sm sm:text-base font-semibold text-slate-200 tracking-wider">
              {formatAccountNumber(card.accountNumber, isMasked)}
            </span>

            {/* Local reveal toggle if globally masked */}
            {privacyMask && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLocalReveal(!localReveal);
                }}
                aria-label={localReveal ? 'Hide number' : 'Show number'}
                className="text-slate-400 hover:text-white p-0.5"
              >
                {localReveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleCopyNumber}
              title="Copy account number"
              aria-label="Copy account number"
              className={`p-1 rounded-md transition-colors ${
                copiedNumber
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200'
              }`}
            >
              {copiedNumber ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Notes or EMVCo indicator */}
          {card.notes ? (
            <p className="text-xs text-slate-300/80 mt-1.5 truncate">{card.notes}</p>
          ) : card.rawPayload ? (
            <div className="flex items-center gap-1 text-[11px] text-emerald-300/90 mt-1.5 font-medium">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>EMVCo Vector Scannable</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="relative z-10 mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between gap-2">
        <button
          onClick={() => onPresent(card)}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white text-slate-900 font-semibold text-xs sm:text-sm shadow-md hover:bg-slate-100 active:scale-98 transition-all"
        >
          <Maximize2 className="w-4 h-4 text-blue-600" />
          <span>Present to Cashier</span>
        </button>

        <button
          onClick={handleCopyAll}
          title="Copy Bank, Name & Number"
          className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border backdrop-blur-md transition-all ${
            copiedAll
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
              : 'bg-black/30 hover:bg-black/40 text-slate-200 border-white/10'
          }`}
        >
          {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Copy All</span>
        </button>
      </div>
    </div>
  );
};
