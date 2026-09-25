import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  hexToRgb,
  rgbToHsl,
  hslToHex,
  applyCustomTheme,
  getCurrentThemeColor,
} from '../lib/colorDeriver';
import type { HSL } from '../lib/colorDeriver';
import { triggerHaptic } from '../lib/security';

interface PhotoshopColorPickerProps {
  onColorChange?: (hex: string) => void;
  onNotify?: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
}

const PRESET_SWATCHES = [
  { name: 'NEO MINT', hex: '#00F0A0' },
  { name: 'CYBER AMBER', hex: '#FEB700' },
  { name: 'TERMINAL CYAN', hex: '#00E1FF' },
  { name: 'SYNTH MAGENTA', hex: '#FF007F' },
  { name: 'ELECTRIC PURPLE', hex: '#A855F7' },
  { name: 'MATRIX LIME', hex: '#22C55E' },
  { name: 'SOLAR ORANGE', hex: '#FF5722' },
  { name: 'ROYAL BLUE', hex: '#005CE6' },
];

export const PhotoshopColorPicker: React.FC<PhotoshopColorPickerProps> = ({
  onColorChange,
  onNotify,
}) => {
  const [currentColor, setCurrentColor] = useState<string>(() => getCurrentThemeColor());
  const [hexInput, setHexInput] = useState<string>(() => getCurrentThemeColor());

  // HSL representation for 2D plane (S & V) and Hue slider (H)
  const [hsl, setHsl] = useState<HSL>(() => {
    const rgb = hexToRgb(getCurrentThemeColor());
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
  });

  const svBoxRef = useRef<HTMLDivElement>(null);
  const isDraggingSV = useRef(false);
  const nativeColorInputRef = useRef<HTMLInputElement>(null);

  // Update theme when color changes
  const updateColor = useCallback(
    (newHex: string, updateInput = true) => {
      const formatted = newHex.toUpperCase();
      setCurrentColor(formatted);
      if (updateInput) setHexInput(formatted);
      applyCustomTheme(formatted);
      onColorChange?.(formatted);
    },
    [onColorChange]
  );

  // Calculate color from SV plane coordinates (X: Saturation 0-100%, Y: Value/Brightness 100-0%)
  const handleSVMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!svBoxRef.current) return;
      const rect = svBoxRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

      const s = Math.round((x / rect.width) * 100);
      const v = Math.round((1 - y / rect.height) * 100);

      // Convert HSV (S, V) to HSL Lightness & Saturation
      const l = ((2 - s / 100) * (v / 100)) / 2;
      const computedS = l !== 0 && l !== 1 ? ((v / 100 - l) / Math.min(l, 1 - l)) * 100 : 0;

      const newHsl = {
        h: hsl.h,
        s: Math.round(Math.max(0, Math.min(100, computedS))),
        l: Math.round(Math.max(0, Math.min(100, l * 100))),
      };

      setHsl(newHsl);
      const hex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
      updateColor(hex);
    },
    [hsl.h, updateColor]
  );

  // Touch and Mouse listeners for SV Box
  const handleSVStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDraggingSV.current = true;
    triggerHaptic('light');
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    handleSVMove(clientX, clientY);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingSV.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      handleSVMove(clientX, clientY);
    };

    const handleEnd = () => {
      if (isDraggingSV.current) {
        isDraggingSV.current = false;
        triggerHaptic('light');
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [handleSVMove]);

  // Hue Slider Change (0 - 360)
  const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newH = parseInt(e.target.value, 10);
    const newHsl = { ...hsl, h: newH };
    setHsl(newHsl);
    const hex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
    updateColor(hex);
  };

  // Hex Input Submit / Validation
  const handleHexSubmit = (val: string) => {
    setHexInput(val);
    let cleaned = val.trim();
    if (!cleaned.startsWith('#')) cleaned = '#' + cleaned;
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
      const rgb = hexToRgb(cleaned);
      const newHsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      setHsl(newHsl);
      updateColor(cleaned, false);
      triggerHaptic('success');
    }
  };

  // Preset Selection
  const handleSelectPreset = (presetHex: string, name: string) => {
    const rgb = hexToRgb(presetHex);
    const newHsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    setHsl(newHsl);
    updateColor(presetHex);
    triggerHaptic('light');
    onNotify?.('Theme Applied', `${name} (${presetHex}) active`, 'success');
  };

  // Calculate SV crosshair position
  const svBackgroundHue = hslToHex(hsl.h, 100, 50);

  // Approximate HSV coordinates for cursor positioning
  const v = hsl.l + (hsl.s * Math.min(hsl.l, 100 - hsl.l)) / 100;
  const s = v === 0 ? 0 : 2 * (1 - hsl.l / v) * 100;
  const cursorLeft = `${Math.max(0, Math.min(100, s))}%`;
  const cursorTop = `${Math.max(0, Math.min(100, 100 - v))}%`;

  return (
    <div className="flex flex-col gap-3 font-mono p-space-md rounded-xl bg-surface-container border border-outline-variant/30 shadow-lg">
      {/* Title Header Strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">palette</span>
          <span className="font-headline-md text-headline-md text-on-surface text-[14px] font-bold uppercase">
            Photoshop Color Selector
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider font-bold">
          24-BIT FULL RGB
        </span>
      </div>

      {/* 2D Photoshop Saturation & Brightness Box */}
      <div
        ref={svBoxRef}
        onMouseDown={handleSVStart}
        onTouchStart={handleSVStart}
        className="relative w-full h-40 rounded-lg cursor-crosshair overflow-hidden shadow-inner border border-outline-variant/40 select-none touch-none"
        style={{ backgroundColor: svBackgroundHue }}
      >
        {/* Horizontal White Gradient (Saturation 0% to 100%) */}
        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent pointer-events-none" />

        {/* Vertical Black Gradient (Brightness 100% to 0%) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent pointer-events-none" />

        {/* Tactile Reticle Cursor */}
        <div
          className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_4px_rgba(0,0,0,0.8)] pointer-events-none flex items-center justify-center"
          style={{ left: cursorLeft, top: cursorTop }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full border border-black/40"
            style={{ backgroundColor: currentColor }}
          />
        </div>
      </div>

      {/* 360° Rainbow Hue Bar Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] text-outline">
          <span className="uppercase font-bold tracking-wider">HUE SPECTRUM</span>
          <span>{hsl.h}° // 360°</span>
        </div>
        <input
          type="range"
          min="0"
          max="360"
          value={hsl.h}
          onChange={handleHueChange}
          className="hue-slider w-full cursor-pointer border border-outline-variant/40"
          style={{
            background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
          }}
        />
      </div>

      {/* Live Swatch, Hex Input & Native Eyedropper Control */}
      <div className="flex items-center gap-2 pt-1">
        {/* Dynamic Color Swatch Preview */}
        <div
          className="w-10 h-10 rounded-lg border-2 border-outline-variant/60 shadow-md flex-shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
          style={{ backgroundColor: currentColor }}
          onClick={() => nativeColorInputRef.current?.click()}
          title="Tap to use system eyedropper / color wheel"
        >
          <span className="material-symbols-outlined text-[16px] text-black/50 drop-shadow">colorize</span>
        </div>

        {/* Hidden Native Color Input for OS Eyedropper / Wheel */}
        <input
          ref={nativeColorInputRef}
          type="color"
          value={currentColor}
          onChange={(e) => {
            handleHexSubmit(e.target.value);
            triggerHaptic('light');
          }}
          className="hidden"
        />

        {/* Hex Input Form */}
        <div className="flex-1 flex items-center rounded-lg bg-surface-container-lowest border border-outline-variant/40 px-2.5 py-1.5 focus-within:border-primary-fixed-dim">
          <span className="text-outline text-xs mr-1 font-bold">#</span>
          <input
            type="text"
            value={hexInput.replace('#', '')}
            onChange={(e) => handleHexSubmit(e.target.value)}
            placeholder="00F0A0"
            maxLength={7}
            className="w-full bg-transparent text-on-surface font-headline-md text-xs font-bold uppercase tracking-wider outline-none"
          />
        </div>

        {/* Eyedropper Button */}
        <button
          type="button"
          onClick={() => nativeColorInputRef.current?.click()}
          className="px-2.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary-fixed border border-outline-variant/40 flex items-center gap-1 text-xs cursor-pointer active:translate-y-0.5"
          title="Open system color wheel"
        >
          <span className="material-symbols-outlined text-[16px]">colorize</span>
          <span className="text-[10px] font-bold uppercase hidden sm:inline">PICK</span>
        </button>
      </div>

      {/* Cyberdeck Tactical Swatches Strip */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[10px] text-outline uppercase tracking-wider font-bold">
          CYBERDECK PRESETS // QUICK SWATCHES
        </span>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {PRESET_SWATCHES.map((swatch) => {
            const isSelected = currentColor.toUpperCase() === swatch.hex.toUpperCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => handleSelectPreset(swatch.hex, swatch.name)}
                title={`${swatch.name} (${swatch.hex})`}
                className={`h-7 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-white scale-105 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                    : 'border-outline-variant/30 hover:scale-102 hover:border-outline-variant'
                }`}
                style={{ backgroundColor: swatch.hex }}
              >
                {isSelected && (
                  <span className="material-symbols-outlined text-[14px] text-black font-bold drop-shadow">
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
