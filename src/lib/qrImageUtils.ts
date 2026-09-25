import QRCode from 'qrcode';
import type { BankProvider } from '../types/qr';
import { getQRModuleColor, createCenterNameBadge } from './qrThemeUtils';
import {
  isNativeAndroid,
  saveImageToGalleryNative,
  copyImageToClipboardNative,
  shareImageNative,
} from './nativeBanking';

/**
 * Converts a base64 Data URL to a binary Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

export interface QRRenderContext {
  bank?: BankProvider;
  accountName?: string;
  bankCustomName?: string;
}

/**
 * Generates a crisp, high-resolution PNG data URL for any QR payload or image,
 * decorated with the bank's thematic foreground color and center payee name badge.
 */
export async function generateQRPngDataUrl(
  rawPayload?: string,
  imageDataUrl?: string,
  size = 600,
  context?: QRRenderContext
): Promise<string> {
  // 1. Generate directly from rawPayload if present
  if (rawPayload && rawPayload.trim().length > 0) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      const fgColor = getQRModuleColor(context?.bank || 'other');

      await QRCode.toCanvas(canvas, rawPayload, {
        width: size,
        margin: 3,
        errorCorrectionLevel: 'H',
        color: {
          dark: fgColor,
          light: '#ffffff',
        },
      });

      // Embed high-contrast center payee name badge if accountName is available
      if (context?.accountName && context.accountName.trim().length > 0) {
        const badgeSvgUrl = createCenterNameBadge(
          context.accountName,
          context.bank || 'other',
          context.bankCustomName
        );

        const badgeImg = new Image();
        await new Promise<void>((resolve) => {
          badgeImg.onload = () => resolve();
          badgeImg.onerror = () => resolve();
          badgeImg.src = badgeSvgUrl;
        });

        const ctx = canvas.getContext('2d');
        if (ctx && badgeImg.width > 0) {
          const badgeSize = Math.round(size * 0.22);
          const badgePos = Math.round((size - badgeSize) / 2);
          ctx.drawImage(badgeImg, badgePos, badgePos, badgeSize, badgeSize);
        }
      }

      return canvas.toDataURL('image/png');
    } catch (err) {
      console.warn('QRCode.toCanvas failed, attempting fallback:', err);
    }
  }

  // 2. Fallback to image data URL if present
  if (imageDataUrl && imageDataUrl.startsWith('data:image/')) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageDataUrl;
      });

      const canvas = document.createElement('canvas');
      const w = Math.max(img.naturalWidth || img.width, size);
      const h = Math.max(img.naturalHeight || img.height, size);
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL('image/png');
      }
    } catch (err) {
      console.warn('Canvas image fallback failed:', err);
    }
  }

  return imageDataUrl || '';
}

/**
 * Saves the QR image directly into the device's Photo Gallery / Recent Photos.
 * On native Android, it writes to MediaStore (Pictures/PocketQR) so banking apps
 * immediately see it at the top of their "Upload QR / Select from Gallery" screen.
 */
export async function saveQRToGallery(options: {
  rawPayload?: string;
  imageDataUrl?: string;
  fileName?: string;
  accountName?: string;
  bank?: BankProvider;
  bankCustomName?: string;
  isTemporary?: boolean;
}): Promise<{ success: boolean; message: string }> {
  try {
    const dataUrl = await generateQRPngDataUrl(
      options.rawPayload,
      options.imageDataUrl,
      640,
      {
        bank: options.bank,
        accountName: options.accountName,
        bankCustomName: options.bankCustomName,
      }
    );

    if (!dataUrl) {
      return { success: false, message: 'No valid QR code to save.' };
    }

    const isTemporary = options.isTemporary ?? true;
    const cleanName = (options.accountName || 'QR')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const prefix = isTemporary ? 'PocketQR_temp' : 'PocketQR';
    const fileName =
      options.fileName || `${prefix}_${cleanName}_${Date.now()}.png`;

    // 1. Native Android MediaStore insertion (Temporary QRs auto-clean previous files & auto-delete after use)
    if (isNativeAndroid()) {
      const res = await saveImageToGalleryNative(dataUrl, fileName, isTemporary);
      if (res.success) {
        return {
          success: true,
          message: isTemporary
            ? 'Saved temporarily to Recent Photos! Top of gallery, auto-cleans after use.'
            : 'Saved to Photo Gallery!',
        };
      }
    }

    // 2. Web / PWA browser download fallback
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return {
      success: true,
      message: 'QR image downloaded! You can upload it in your banking app.',
    };
  } catch (err: any) {
    console.error('saveQRToGallery failed:', err);
    return {
      success: false,
      message: err.message || 'Could not save QR image to gallery.',
    };
  }
}

/**
 * Copies the QR code image directly to the clipboard (and copies text as fallback).
 */
export async function copyQRImageToClipboard(options: {
  rawPayload?: string;
  imageDataUrl?: string;
  textFallback?: string;
  accountName?: string;
  bank?: BankProvider;
  bankCustomName?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const dataUrl = await generateQRPngDataUrl(
      options.rawPayload,
      options.imageDataUrl,
      640,
      {
        bank: options.bank,
        accountName: options.accountName,
        bankCustomName: options.bankCustomName,
      }
    );

    let copiedImage = false;

    // 1. Native Android clipboard with image URI
    if (isNativeAndroid() && dataUrl) {
      copiedImage = await copyImageToClipboardNative(dataUrl, options.textFallback);
    }

    // 2. Modern Web Clipboard API (ClipboardItem with image/png)
    if (!copiedImage && dataUrl && typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const blob = dataUrlToBlob(dataUrl);
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        copiedImage = true;
      } catch (clipErr) {
        console.warn('navigator.clipboard.write image failed:', clipErr);
      }
    }

    // 3. Fallback: Copy account number / text
    if (options.textFallback && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(options.textFallback);
      } catch {}
    }

    if (copiedImage) {
      return {
        success: true,
        message: 'QR Image copied to clipboard! Ready to paste or upload.',
      };
    } else if (options.textFallback) {
      return {
        success: true,
        message: 'Details copied to clipboard!',
      };
    }

    return { success: false, message: 'Could not copy to clipboard.' };
  } catch (err: any) {
    console.error('copyQRImageToClipboard failed:', err);
    return {
      success: false,
      message: err.message || 'Clipboard copy failed.',
    };
  }
}

/**
 * Shares the QR code image via Android's native share sheet or web navigator.share.
 */
export async function shareQRImage(options: {
  rawPayload?: string;
  imageDataUrl?: string;
  title?: string;
  text?: string;
  accountName?: string;
  bank?: BankProvider;
  bankCustomName?: string;
}): Promise<boolean> {
  try {
    const dataUrl = await generateQRPngDataUrl(
      options.rawPayload,
      options.imageDataUrl,
      640,
      {
        bank: options.bank,
        accountName: options.accountName,
        bankCustomName: options.bankCustomName,
      }
    );

    if (isNativeAndroid() && dataUrl) {
      return await shareImageNative(dataUrl, options.title, options.text);
    }

    if (dataUrl && typeof navigator !== 'undefined' && navigator.share) {
      const blob = dataUrlToBlob(dataUrl);
      const file = new File([blob], 'pocketqr.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: options.title || 'PocketQR',
          text: options.text || '',
          files: [file],
        });
        return true;
      }
      await navigator.share({
        title: options.title || 'PocketQR',
        text: options.text || '',
      });
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
