import type { BankProvider } from '../types/qr';

export interface QRThemeStyle {
  fgColor: string;
  bgColor: string;
  badgeBorderColor: string;
  badgeTextColor: string;
  badgeBg: string;
  label: string;
}

/**
 * High-contrast, brand-aligned light mode palettes (dark QR modules on pure white background).
 */
export const BANK_QR_LIGHT_PALETTES: Record<BankProvider, QRThemeStyle> = {
  gcash: {
    fgColor: '#005CE6',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#005CE6',
    badgeTextColor: '#003B99',
    badgeBg: '#FFFFFF',
    label: 'GCASH',
  },
  maya: {
    fgColor: '#056B3A',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#00D66F',
    badgeTextColor: '#054024',
    badgeBg: '#FFFFFF',
    label: 'MAYA',
  },
  rcbc: {
    fgColor: '#0A3180',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#0A3180',
    badgeTextColor: '#001A4E',
    badgeBg: '#FFFFFF',
    label: 'RCBC',
  },
  bpi: {
    fgColor: '#8B0000',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#8B0000',
    badgeTextColor: '#5C0000',
    badgeBg: '#FFFFFF',
    label: 'BPI',
  },
  unionbank: {
    fgColor: '#B43403',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#EA580C',
    badgeTextColor: '#7C2200',
    badgeBg: '#FFFFFF',
    label: 'UBP',
  },
  bdo: {
    fgColor: '#002B66',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#003366',
    badgeTextColor: '#001A40',
    badgeBg: '#FFFFFF',
    label: 'BDO',
  },
  gotyme: {
    fgColor: '#0F766E',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#0D9488',
    badgeTextColor: '#042F2E',
    badgeBg: '#FFFFFF',
    label: 'GOTYME',
  },
  seabank: {
    fgColor: '#C2410C',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#FF5722',
    badgeTextColor: '#7C2200',
    badgeBg: '#FFFFFF',
    label: 'SEABANK',
  },
  metrobank: {
    fgColor: '#172554',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#1E3A8A',
    badgeTextColor: '#0F172A',
    badgeBg: '#FFFFFF',
    label: 'MBTC',
  },
  cimb: {
    fgColor: '#7F1D1D',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#B91C1C',
    badgeTextColor: '#450A0A',
    badgeBg: '#FFFFFF',
    label: 'CIMB',
  },
  other: {
    fgColor: '#0F172A',
    bgColor: '#FFFFFF',
    badgeBorderColor: '#334155',
    badgeTextColor: '#0F172A',
    badgeBg: '#FFFFFF',
    label: 'QR PH',
  },
};

/**
 * Luminous, cyberpunk dark mode palettes (vibrant neon QR modules on dark canvas).
 */
export const BANK_QR_DARK_PALETTES: Record<BankProvider, QRThemeStyle> = {
  gcash: {
    fgColor: '#38BDF8',
    bgColor: '#0F131A',
    badgeBorderColor: '#38BDF8',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'GCASH',
  },
  maya: {
    fgColor: '#00F0A0',
    bgColor: '#0F131A',
    badgeBorderColor: '#00F0A0',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'MAYA',
  },
  rcbc: {
    fgColor: '#60A5FA',
    bgColor: '#0F131A',
    badgeBorderColor: '#60A5FA',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'RCBC',
  },
  bpi: {
    fgColor: '#F87171',
    bgColor: '#0F131A',
    badgeBorderColor: '#F87171',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'BPI',
  },
  unionbank: {
    fgColor: '#FB923C',
    bgColor: '#0F131A',
    badgeBorderColor: '#FB923C',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'UBP',
  },
  bdo: {
    fgColor: '#60A5FA',
    bgColor: '#0F131A',
    badgeBorderColor: '#3B82F6',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'BDO',
  },
  gotyme: {
    fgColor: '#2DD4BF',
    bgColor: '#0F131A',
    badgeBorderColor: '#2DD4BF',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'GOTYME',
  },
  seabank: {
    fgColor: '#FB923C',
    bgColor: '#0F131A',
    badgeBorderColor: '#FB923C',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'SEABANK',
  },
  metrobank: {
    fgColor: '#93C5FD',
    bgColor: '#0F131A',
    badgeBorderColor: '#60A5FA',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'MBTC',
  },
  cimb: {
    fgColor: '#F87171',
    bgColor: '#0F131A',
    badgeBorderColor: '#EF4444',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'CIMB',
  },
  other: {
    fgColor: '#E2E8F0',
    bgColor: '#0F131A',
    badgeBorderColor: '#94A3B8',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171F',
    label: 'QR PH',
  },
};

/**
 * Standard palette export (defaults to light for classic backward compatibility).
 */
export const BANK_QR_PALETTES: Record<BankProvider, QRThemeStyle> = BANK_QR_LIGHT_PALETTES;

/**
 * Checks whether adaptive dark QR code styling is currently active.
 */
export function isAdaptiveQRDark(): boolean {
  if (typeof window === 'undefined') return true;
  const isAdaptiveEnabled = localStorage.getItem('pocketqr_adaptive_qr_bg') !== 'false';
  if (!isAdaptiveEnabled) return false;
  const themeMode =
    document.documentElement.getAttribute('data-theme') ||
    localStorage.getItem('pocketqr_theme_mode') ||
    'dark';
  return themeMode === 'dark';
}

/**
 * Returns complete QR styling (fgColor, bgColor, badge colors) based on the bank and dark mode flag.
 */
export function getQRColors(bank: BankProvider, isDark = false): QRThemeStyle {
  const table = isDark ? BANK_QR_DARK_PALETTES : BANK_QR_LIGHT_PALETTES;
  return table[bank] || table.other;
}

/**
 * Returns the module foreground color for a card's QR code.
 */
export function getQRModuleColor(bank: BankProvider, isDark = false): string {
  return getQRColors(bank, isDark).fgColor;
}

/**
 * Generates an SVG data URL for the center badge with the payee's name and bank label.
 */
export function createCenterNameBadge(
  name: string,
  bank: BankProvider,
  bankCustomName?: string,
  isDark = false
): string {
  const palette = getQRColors(bank, isDark);
  const brandLabel = (bankCustomName || palette.label).toUpperCase().slice(0, 7);

  // Compute initials or short display name
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  let displayName = '';

  if (words.length === 1) {
    displayName = words[0].slice(0, 6).toUpperCase();
  } else if (trimmed.length <= 8) {
    displayName = trimmed.toUpperCase();
  } else {
    // Show first name or initials
    const first = words[0];
    if (first.length <= 6) {
      displayName = first.toUpperCase();
    } else {
      displayName = words
        .map((w) => w[0])
        .join('')
        .slice(0, 4)
        .toUpperCase();
    }
  }

  const pillTextFill = isDark ? '#0F131A' : '#FFFFFF';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <!-- Outer Card Frame with subtle drop shadow -->
    <rect x="2" y="2" width="116" height="116" rx="24" fill="${palette.badgeBg}" stroke="${palette.badgeBorderColor}" stroke-width="6"/>
    
    <!-- Top Bank Pill -->
    <rect x="18" y="16" width="84" height="26" rx="8" fill="${palette.badgeBorderColor}"/>
    <text x="60" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="14" fill="${pillTextFill}" text-anchor="middle" letter-spacing="1">${brandLabel}</text>
    
    <!-- Payee Name / Initials in Center -->
    <text x="60" y="74" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="900" font-size="${displayName.length > 5 ? '20' : '23'}" fill="${palette.badgeTextColor}" text-anchor="middle" letter-spacing="0.5">${displayName}</text>
    
    <!-- Verified Bottom Indicator Bar -->
    <rect x="36" y="90" width="48" height="6" rx="3" fill="${palette.badgeBorderColor}" opacity="0.8"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
