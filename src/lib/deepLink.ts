import type { PayingBankApp } from '../types/payment';
import { isNativeAndroid, launchNativeApp } from './nativeBanking';

export interface LaunchResult {
  success: boolean;
  copiedText: string;
  bankName: string;
  scheme: string;
}

const DEFAULT_BANK_STORAGE_KEY = 'pocketqr_default_paying_bank';

/**
 * Retrieves the user's preferred default paying bank if set to "ALWAYS".
 */
export function getDefaultPayingBank(): string | null {
  try {
    return localStorage.getItem(DEFAULT_BANK_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Saves or clears the user's preferred default paying bank.
 */
export function setDefaultPayingBank(bankId: string | null): void {
  try {
    if (bankId) {
      localStorage.setItem(DEFAULT_BANK_STORAGE_KEY, bankId);
    } else {
      localStorage.removeItem(DEFAULT_BANK_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to save default bank preference:', err);
  }
}

/**
 * Returns the appropriate official app store URL (Play Store for Android, App Store for iOS).
 */
export function getAppStoreUrl(app: PayingBankApp): string {
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent || '');

  return isIOS ? app.appStoreUrl : app.playStoreUrl;
}

/**
 * Returns the direct URI scheme for the target platform (e.g. gcash://, maya://).
 */
export function getDirectAppScheme(app: PayingBankApp): string {
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent || '');

  return isIOS && app.iosScheme ? app.iosScheme : app.scheme;
}

/**
 * Copies the recipient details to clipboard and dispatches the native app launch.
 * If running in Native APK, uses Android's native startActivity.
 * If running on Web/PWA, uses direct hyperlink/scheme navigation.
 */
export function launchBankingApp(
  app: PayingBankApp,
  accountNumber: string
): LaunchResult {
  // 1. Copy the recipient account number to clipboard immediately
  if (accountNumber && typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(accountNumber).catch((err) => {
      console.warn('Clipboard write error:', err);
    });
  }

  // 2. If running as native Android APK, use native intent launch
  if (isNativeAndroid()) {
    launchNativeApp(app);
    return {
      success: true,
      copiedText: accountNumber,
      bankName: app.name,
      scheme: app.scheme,
    };
  }

  // 3. Web/PWA dispatch
  const targetUrl = getDirectAppScheme(app);
  try {
    const a = document.createElement('a');
    a.href = targetUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1000);
  } catch (e) {
    console.warn('Deep link launch error, attempting location assign:', e);
    try {
      window.location.href = targetUrl;
    } catch {}
  }

  return {
    success: true,
    copiedText: accountNumber,
    bankName: app.name,
    scheme: targetUrl,
  };
}

/**
 * Formats a clean summary string for the user to paste anywhere.
 */
export function formatPaymentSummary(
  recipientName: string,
  accountNumber: string,
  receivingBank?: string,
  amount?: string
): string {
  const lines = [
    `Payment Details (QR Ph / InstaPay):`,
    `Recipient: ${recipientName}`,
    `Account No.: ${accountNumber}`,
    receivingBank ? `Bank / Wallet: ${receivingBank}` : '',
    amount ? `Amount: ₱${amount}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}
