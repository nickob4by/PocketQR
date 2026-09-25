import type { BankProvider } from '../types/qr';

export interface QRThemeStyle {
  fgColor: string;
  badgeBorderColor: string;
  badgeTextColor: string;
  badgeBg: string;
  label: string;
}

/**
 * High-contrast, brand-aligned colors for QR modules that scan reliably with all cameras.
 */
export const BANK_QR_PALETTES: Record<BankProvider, QRThemeStyle> = {
  gcash: {
    fgColor: '#005CE6',
    badgeBorderColor: '#005CE6',
    badgeTextColor: '#003B99',
    badgeBg: '#FFFFFF',
    label: 'GCASH',
  },
  maya: {
    fgColor: '#056B3A',
    badgeBorderColor: '#00D66F',
    badgeTextColor: '#054024',
    badgeBg: '#FFFFFF',
    label: 'MAYA',
  },
  rcbc: {
    fgColor: '#0A3180',
    badgeBorderColor: '#0A3180',
    badgeTextColor: '#001A4E',
    badgeBg: '#FFFFFF',
    label: 'RCBC',
  },
  bpi: {
    fgColor: '#8B0000',
    badgeBorderColor: '#8B0000',
    badgeTextColor: '#5C0000',
    badgeBg: '#FFFFFF',
    label: 'BPI',
  },
  unionbank: {
    fgColor: '#B43403',
    badgeBorderColor: '#EA580C',
    badgeTextColor: '#7C2200',
    badgeBg: '#FFFFFF',
    label: 'UBP',
  },
  bdo: {
    fgColor: '#002B66',
    badgeBorderColor: '#003366',
    badgeTextColor: '#001A40',
    badgeBg: '#FFFFFF',
    label: 'BDO',
  },
  gotyme: {
    fgColor: '#0F766E',
    badgeBorderColor: '#0D9488',
    badgeTextColor: '#042F2E',
    badgeBg: '#FFFFFF',
    label: 'GOTYME',
  },
  seabank: {
    fgColor: '#C2410C',
    badgeBorderColor: '#FF5722',
    badgeTextColor: '#7C2200',
    badgeBg: '#FFFFFF',
    label: 'SEABANK',
  },
  metrobank: {
    fgColor: '#172554',
    badgeBorderColor: '#1E3A8A',
    badgeTextColor: '#0F172A',
    badgeBg: '#FFFFFF',
    label: 'MBTC',
  },
  cimb: {
    fgColor: '#7F1D1D',
    badgeBorderColor: '#B91C1C',
    badgeTextColor: '#450A0A',
    badgeBg: '#FFFFFF',
    label: 'CIMB',
  },
  other: {
    fgColor: '#0F172A',
    badgeBorderColor: '#334155',
    badgeTextColor: '#0F172A',
    badgeBg: '#FFFFFF',
    label: 'QR PH',
  },
};

/**
 * Returns the module foreground color for a card's QR code.
 * If bank is 'other' or custom color preference is set, defaults to dark contrast theme.
 */
export function getQRModuleColor(bank: BankProvider): string {
  const palette = BANK_QR_PALETTES[bank];
  if (bank === 'other') {
    // If other, optionally use custom theme or dark slate
    return '#0F172A';
  }
  return palette?.fgColor || '#0F172A';
}

/**
 * Generates an SVG data URL for the center badge with the payee's name and bank label.
 */
export function createCenterNameBadge(
  name: string,
  bank: BankProvider,
  bankCustomName?: string
): string {
  const palette = BANK_QR_PALETTES[bank] || BANK_QR_PALETTES.other;
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
    <rect x="2" y="2" width="116" height="116" rx="24" fill="#FFFFFF" stroke="${palette.badgeBorderColor}" stroke-width="6"/>
    
    <!-- Top Bank Pill -->
    <rect x="18" y="16" width="84" height="26" rx="8" fill="${palette.badgeBorderColor}"/>
    <text x="60" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="14" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">${brandLabel}</text>
    
    <!-- Payee Name / Initials in Center -->
    <text x="60" y="74" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="900" font-size="${displayName.length > 5 ? '20' : '23'}" fill="${palette.badgeTextColor}" text-anchor="middle" letter-spacing="0.5">${displayName}</text>
    
    <!-- Verified Bottom Indicator Bar -->
    <rect x="36" y="90" width="48" height="6" rx="3" fill="${palette.badgeBorderColor}" opacity="0.8"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
