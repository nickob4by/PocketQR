/**
 * Color manipulation and dynamic Material/Google Stitch theme token generator.
 * Converts any user-selected hex color into a complete, accessible palette of CSS variables.
 */

export interface HSL {
  h: number; // 0 - 360
  s: number; // 0 - 100
  l: number; // 0 - 100
}

export interface RGB {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
}

export function hexToRgb(hex: string): RGB {
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return { r: 0, g: 240, b: 160 }; // fallback to default mint
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h / 360 + 1 / 3);
  const g = hue2rgb(p, q, h / 360);
  const b = hue2rgb(p, q, h / 360 - 1 / 3);

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

export interface ThemeTokens {
  primary: string;                  // Light readable tint (L ≈ 86%)
  primaryContainer: string;         // Vibrant base accent (user chosen or vibrant L ≈ 48%)
  primaryFixed: string;             // Bright neon highlight (L ≈ 65%)
  primaryFixedDim: string;          // Midtone accent for borders (L ≈ 44%)
  onPrimaryContainer: string;       // Deep contrast shade for container text (L ≈ 18%)
  onPrimary: string;                // Dark contrast for pure accent backgrounds (L ≈ 10%)
  onPrimaryFixed: string;           // Ultra-deep contrast (L ≈ 7%)
  onPrimaryFixedVariant: string;    // Dark midtone (L ≈ 15%)
}

/**
 * Derives a full suite of accessible, harmonized Material tokens from any base hex color.
 */
export function deriveThemeTokens(baseHex: string): ThemeTokens {
  const rgb = hexToRgb(baseHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const sat = Math.max(50, hsl.s); // Ensure sufficient vibrance

  return {
    primary: hslToHex(hsl.h, Math.min(sat, 85), 86),
    primaryContainer: baseHex.toUpperCase(),
    primaryFixed: hslToHex(hsl.h, sat, Math.max(58, Math.min(72, hsl.l + 10))),
    primaryFixedDim: hslToHex(hsl.h, sat, Math.max(38, Math.min(50, hsl.l - 5))),
    onPrimaryContainer: hslToHex(hsl.h, Math.min(sat, 90), 18),
    onPrimary: hslToHex(hsl.h, Math.min(sat, 90), 10),
    onPrimaryFixed: hslToHex(hsl.h, Math.min(sat, 90), 7),
    onPrimaryFixedVariant: hslToHex(hsl.h, Math.min(sat, 90), 15),
  };
}

const STORAGE_KEY = 'pocketqr_custom_theme_color';

/**
 * Injects dynamic theme CSS variables into the root HTML element and persists preference.
 */
export function applyCustomTheme(hex: string): void {
  try {
    const tokens = deriveThemeTokens(hex);
    const root = document.documentElement;

    root.style.setProperty('--theme-primary', tokens.primary);
    root.style.setProperty('--theme-primary-container', tokens.primaryContainer);
    root.style.setProperty('--theme-primary-fixed', tokens.primaryFixed);
    root.style.setProperty('--theme-primary-fixed-dim', tokens.primaryFixedDim);
    root.style.setProperty('--theme-on-primary-container', tokens.onPrimaryContainer);
    root.style.setProperty('--theme-on-primary', tokens.onPrimary);
    root.style.setProperty('--theme-on-primary-fixed', tokens.onPrimaryFixed);
    root.style.setProperty('--theme-on-primary-fixed-variant', tokens.onPrimaryFixedVariant);

    root.setAttribute('data-colorway', 'CUSTOM');
    localStorage.setItem(STORAGE_KEY, hex.toUpperCase());
  } catch (err) {
    console.error('Failed to apply custom theme:', err);
  }
}

/**
 * Loads and restores saved theme on application launch.
 */
export function loadSavedTheme(): string {
  const savedCustom = localStorage.getItem(STORAGE_KEY);
  if (savedCustom && /^#[0-9A-Fa-f]{6}$/.test(savedCustom)) {
    applyCustomTheme(savedCustom);
    return savedCustom.toUpperCase();
  }

  // Fallback to legacy presets if present
  const legacyTone = localStorage.getItem('pocketqr_theme_tone') || 'MINT';
  const legacyMap: Record<string, string> = {
    MINT: '#00F0A0',
    AMBER: '#FEB700',
    CYAN: '#00E1FF',
  };
  const hex = legacyMap[legacyTone] || '#00F0A0';
  applyCustomTheme(hex);
  return hex;
}

export function getCurrentThemeColor(): string {
  return localStorage.getItem(STORAGE_KEY) || '#00F0A0';
}
