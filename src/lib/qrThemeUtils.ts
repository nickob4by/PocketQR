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
 * Luminous, cyberpunk dark mode palettes (vibrant neon QR modules on deep dark canvas).
 */
export const BANK_QR_DARK_PALETTES: Record<BankProvider, QRThemeStyle> = {
  gcash: {
    fgColor: '#38BDF8',
    bgColor: '#0b0e15',
    badgeBorderColor: '#38BDF8',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'GCASH',
  },
  maya: {
    fgColor: '#00F0A0',
    bgColor: '#0b0e15',
    badgeBorderColor: '#00F0A0',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'MAYA',
  },
  rcbc: {
    fgColor: '#60A5FA',
    bgColor: '#0b0e15',
    badgeBorderColor: '#60A5FA',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'RCBC',
  },
  bpi: {
    fgColor: '#F87171',
    bgColor: '#0b0e15',
    badgeBorderColor: '#F87171',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'BPI',
  },
  unionbank: {
    fgColor: '#FB923C',
    bgColor: '#0b0e15',
    badgeBorderColor: '#FB923C',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'UBP',
  },
  bdo: {
    fgColor: '#60A5FA',
    bgColor: '#0b0e15',
    badgeBorderColor: '#3B82F6',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'BDO',
  },
  gotyme: {
    fgColor: '#2DD4BF',
    bgColor: '#0b0e15',
    badgeBorderColor: '#2DD4BF',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'GOTYME',
  },
  seabank: {
    fgColor: '#FB923C',
    bgColor: '#0b0e15',
    badgeBorderColor: '#FB923C',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'SEABANK',
  },
  metrobank: {
    fgColor: '#93C5FD',
    bgColor: '#0b0e15',
    badgeBorderColor: '#60A5FA',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'MBTC',
  },
  cimb: {
    fgColor: '#F87171',
    bgColor: '#0b0e15',
    badgeBorderColor: '#EF4444',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'CIMB',
  },
  other: {
    fgColor: '#E2E8F0',
    bgColor: '#0b0e15',
    badgeBorderColor: '#94A3B8',
    badgeTextColor: '#FFFFFF',
    badgeBg: '#14171f',
    label: 'QR PH',
  },
};

/**
 * Standard palette export (pure dark mode).
 */
export const BANK_QR_PALETTES: Record<BankProvider, QRThemeStyle> = BANK_QR_DARK_PALETTES;

/**
 * Checks whether dark QR code styling is active (always true).
 */
export function isAdaptiveQRDark(): boolean {
  return true;
}

/**
 * Returns complete QR styling (fgColor, bgColor, badge colors) based on the bank.
 */
export function getQRColors(bank: BankProvider, _isDark = true): QRThemeStyle {
  return BANK_QR_DARK_PALETTES[bank] || BANK_QR_DARK_PALETTES.other;
}

/**
 * Returns the module foreground color for a card's QR code.
 */
export function getQRModuleColor(bank: BankProvider, _isDark = true): string {
  return getQRColors(bank).fgColor;
}

/**
 * Generates an SVG data URL for the center badge with the payee's name and bank label.
 */
export function createCenterNameBadge(
  name: string,
  bank: BankProvider,
  bankCustomName?: string,
  _isDark = true
): string {
  const palette = getQRColors(bank);
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

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <!-- Outer Card Frame with subtle drop shadow -->
    <rect x="2" y="2" width="116" height="116" rx="24" fill="${palette.badgeBg}" stroke="${palette.badgeBorderColor}" stroke-width="6"/>
    
    <!-- Top Bank Pill -->
    <rect x="18" y="16" width="84" height="26" rx="8" fill="${palette.badgeBorderColor}"/>
    <text x="60" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="14" fill="#0b0e15" text-anchor="middle" letter-spacing="1">${brandLabel}</text>
    
    <!-- Payee Name / Initials in Center -->
    <text x="60" y="74" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="900" font-size="${displayName.length > 5 ? '20' : '23'}" fill="${palette.badgeTextColor}" text-anchor="middle" letter-spacing="0.5">${displayName}</text>
    
    <!-- Verified Bottom Indicator Bar -->
    <rect x="36" y="90" width="48" height="6" rx="3" fill="${palette.badgeBorderColor}" opacity="0.8"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
