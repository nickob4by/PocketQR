import jsQR from 'jsqr';

export interface DecodedQRResult {
  success: boolean;
  payload?: string;
  error?: string;
  width?: number;
  height?: number;
}

/**
 * Converts a File or Blob into a base64 Data URL.
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to data URL'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Loads an image from a source URL/data URL into an HTMLImageElement.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for QR decoding'));
    img.src = src;
  });
}

/**
 * Decodes a QR code from an image data URL, File, or Blob using client-side jsQR.
 */
export async function decodeQRCode(source: string | File | Blob): Promise<DecodedQRResult> {
  try {
    let dataUrl: string;
    if (typeof source === 'string') {
      dataUrl = source;
    } else {
      dataUrl = await fileToDataUrl(source);
    }

    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      return { success: false, error: 'Could not create canvas 2D context' };
    }

    // 1. Try scanning at full resolution
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let code = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data) {
      return {
        success: true,
        payload: code.data,
        width: canvas.width,
        height: canvas.height,
      };
    }

    // 2. If high resolution (e.g. mobile screenshot > 1600px), downsample to ~1000px and re-scan
    const maxDim = Math.max(canvas.width, canvas.height);
    if (maxDim > 1200) {
      const scale = 1000 / maxDim;
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      code = jsQR(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code && code.data) {
        return {
          success: true,
          payload: code.data,
          width: canvas.width,
          height: canvas.height,
        };
      }
    }

    // 3. Try grayscale/contrast enhancement if still not found
    tryEnhanceContrast(ctx, canvas.width, canvas.height);
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    code = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data) {
      return {
        success: true,
        payload: code.data,
        width: canvas.width,
        height: canvas.height,
      };
    }

    return {
      success: false,
      error: 'No QR code could be detected in this image. You can still save it as an image card or enter details manually.',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown QR decoding error';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Simple contrast boost on canvas ImageData to aid jsQR detection on blurry or dark photos.
 */
function tryEnhanceContrast(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    // Luminance
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Threshold high contrast
    const thresholded = gray > 140 ? 255 : 0;
    d[i] = thresholded;
    d[i + 1] = thresholded;
    d[i + 2] = thresholded;
  }
  ctx.putImageData(imgData, 0, 0);
}
