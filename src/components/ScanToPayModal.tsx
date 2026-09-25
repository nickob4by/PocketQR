import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import type { ParsedEMVCo } from '../lib/emvcoParser';
import { parseQRPhPayload } from '../lib/emvcoParser';
import { decodeQRCode, fileToDataUrl } from '../lib/qrDecoder';
import { triggerHaptic } from '../lib/security';
import { copyQRImageToClipboard } from '../lib/qrImageUtils';
import { PaymentRoutingSheet } from './PaymentRoutingSheet';
import type { QRCardItem } from '../types/qr';

interface ScanToPayModalProps {
  isOpen: boolean;
  existingCards?: QRCardItem[];
  onClose: () => void;
  onSaveToWallet: (card: QRCardItem) => void;
  onNotify: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
  onLogAdded?: () => void;
}

export const ScanToPayModal: React.FC<ScanToPayModalProps> = ({
  isOpen,
  existingCards = [],
  onClose,
  onSaveToWallet,
  onNotify,
  onLogAdded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Scanned result routing sheet
  const [scannedResult, setScannedResult] = useState<{
    parsed: ParsedEMVCo;
    rawPayload: string;
    imageDataUrl?: string;
  } | null>(null);

  // Stop camera tracks cleanly without triggering re-render cascades
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  // Multi-tier fallback camera requester for maximum mobile compatibility
  const requestMediaStream = async (targetFacing: 'environment' | 'user'): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API (navigator.mediaDevices.getUserMedia) is not supported in this browser.');
    }

    // Tier 1: Portrait HD resolution with desired facing mode
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 },
        },
        audio: false,
      });
    } catch (err: any) {
      // If permission was explicitly denied, do not retry constraints
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw err;
      }
      console.warn('Tier 1 camera constraints failed, attempting fallback...', err);
    }

    // Tier 2: Facing mode with portrait aspect ratio
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: targetFacing,
          aspectRatio: { ideal: 9 / 16 },
        },
        audio: false,
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw err;
      }
      console.warn('Tier 2 camera constraints failed, attempting basic video...', err);
    }

    // Tier 3: Bare minimum video stream
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: targetFacing },
      audio: false,
    });
  };

  // Handle detection from camera or file
  const handleQRDetected = useCallback(
    (payload: string, imgDataUrl?: string) => {
      setIsProcessing(true);
      triggerHaptic('success');

      // Stop camera immediately once detected
      stopCamera();

      // Parse EMVCo / QR Ph payload
      const parsed = parseQRPhPayload(payload);

      setScannedResult({
        parsed,
        rawPayload: payload,
        imageDataUrl: imgDataUrl,
      });

      // Auto-copy QR image and account number to clipboard immediately upon scan
      copyQRImageToClipboard({
        rawPayload: payload,
        imageDataUrl: imgDataUrl,
        textFallback: parsed.accountNumber || payload,
      }).catch(() => {});

      onNotify(
        'QR Code Scanned!',
        parsed.merchantName ? `Payee: ${parsed.merchantName} (QR copied)` : 'QR image copied to clipboard',
        'success'
      );
      setIsProcessing(false);
    },
    [onNotify, stopCamera]
  );

  // Start camera and scanning frame loop
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setIsCameraReady(false);

    try {
      const mediaStream = await requestMediaStream(facingMode);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = mediaStream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;

        // Ensure video metadata is loaded before attempting play
        if (video.readyState < 1) {
          await new Promise<void>((resolve) => {
            const onLoaded = () => {
              video.removeEventListener('loadedmetadata', onLoaded);
              resolve();
            };
            video.addEventListener('loadedmetadata', onLoaded, { once: true });
          });
        }

        try {
          await video.play();
        } catch (playErr) {
          console.warn('video.play() aborted or error:', playErr);
        }
      }

      // Check flashlight/torch capability
      const track = mediaStream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const caps = track.getCapabilities() as any;
        setTorchSupported(Boolean(caps && caps.torch));
      }

      setIsCameraReady(true);
    } catch (err: any) {
      console.warn('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings (tap the lock or page settings icon in your address bar).');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. You can upload a QR screenshot instead.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Your camera is already in use by another app or browser tab. Please close other camera apps and tap "Try Again".');
      } else {
        setCameraError(`Camera error: ${err.message || 'Unable to start camera stream'}. You can upload a photo screenshot instead.`);
      }
    }
  }, [facingMode, stopCamera]);

  // Main lifecycle: start camera when modal opens, stop on close
  useEffect(() => {
    if (!isOpen || scannedResult) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, scannedResult, facingMode, startCamera, stopCamera]);

  // Active scanning frame loop
  useEffect(() => {
    if (!isOpen || !isCameraReady || scannedResult || cameraError) return;

    let isActive = true;

    const scanFrame = () => {
      if (!isActive) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        video &&
        canvas &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height, {
              inversionAttempts: 'attemptBoth',
            });

            if (code && code.data) {
              const snapshot = canvas.toDataURL('image/jpeg', 0.85);
              handleQRDetected(code.data, snapshot);
              return;
            }
          } catch (scanErr) {
            console.warn('QR scan processing error:', scanErr);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isOpen, isCameraReady, scannedResult, cameraError, handleQRDetected]);

  // Torch toggle
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn } as any],
        });
        setTorchOn(!torchOn);
        triggerHaptic('light');
      } catch (err) {
        console.warn('Torch constraint error:', err);
      }
    }
  };

  // Switch Camera front/back
  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    triggerHaptic('light');
  };

  // Upload screenshot fallback
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setIsProcessing(true);
        const dataUrl = await fileToDataUrl(file);
        const result = await decodeQRCode(dataUrl);

        if (result.success && result.payload) {
          handleQRDetected(result.payload, dataUrl);
        } else {
          onNotify('No QR Code Found', 'Please choose a clear QR Ph code image or screenshot', 'error');
        }
      } catch {
        onNotify('Error Reading Image', 'Could not process the selected file', 'error');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  if (!isOpen) return null;

  // If a QR was scanned, show the PaymentRoutingSheet
  if (scannedResult) {
    return (
      <PaymentRoutingSheet
        parsed={scannedResult.parsed}
        rawPayload={scannedResult.rawPayload}
        imageDataUrl={scannedResult.imageDataUrl}
        onClose={() => {
          setScannedResult(null);
          onClose();
        }}
        onSaveToWallet={(card) => {
          onSaveToWallet(card);
        }}
        onNotify={onNotify}
        onLogAdded={onLogAdded}
        existingCards={existingCards}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-black text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Hidden Canvas for QR frame analysis */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden File Picker Fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* LIVE CAMERA STREAM - Edge-to-Edge Full Screen (Zero Side Borders) */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        className="fixed inset-0 w-full h-full object-cover z-0"
      />

      {/* Camera Loading or Error State */}
      {cameraError ? (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-20">
          <span className="material-symbols-outlined text-4xl text-amber-400 mb-2">
            warning
          </span>
          <span className="font-label-md text-label-md text-white font-bold font-mono">
            OPTIC SENSOR OFFLINE
          </span>
          <p className="font-body-sm text-body-sm text-outline mt-1 mb-4 leading-relaxed font-sans max-w-xs">
            {cameraError}
          </p>
          <div className="flex gap-2 w-full max-w-xs font-mono">
            <button
              onClick={startCamera}
              className="flex-1 py-2.5 bg-white/20 hover:bg-white/30 text-white font-label-sm text-label-sm rounded-lg border border-white/20 active:scale-95 transition-transform cursor-pointer"
            >
              RETRY SENSOR
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 bg-primary-container text-on-primary-container font-label-sm text-label-sm rounded-lg font-bold active:scale-95 transition-transform cursor-pointer"
            >
              UPLOAD FILE
            </button>
          </div>
        </div>
      ) : !isCameraReady ? (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-2 z-10 font-mono">
          <span className="material-symbols-outlined text-3xl text-primary-fixed animate-spin">
            refresh
          </span>
          <span className="font-label-sm text-label-sm text-primary-fixed tracking-widest">
            CALIBRATING SENSOR...
          </span>
        </div>
      ) : null}

      {/* Floating Top Controls Header (Glassmorphic, Safe Area Inset) */}
      <div className="relative z-10 w-full pt-safe px-4 pt-3 pb-3 flex flex-col gap-2 bg-gradient-to-b from-black/85 via-black/40 to-transparent">
        <div className="flex items-center justify-between text-xs font-mono text-outline">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
            <span className="text-primary-fixed uppercase tracking-wider font-bold">LIVE OPTIC LINK</span>
          </div>
          <span className="tracking-widest uppercase text-white/70">
            {facingMode === 'environment' ? 'LENS: REAR' : 'LENS: SELF'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            aria-label="Close Viewfinder"
            className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>

          {/* Quick Hardware Controls (Flashlight, Gallery Upload, Lens Flip) */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTorch}
              disabled={!torchSupported}
              title="Toggle Flashlight"
              className={`w-10 h-10 rounded-xl backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer ${
                torchOn
                  ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                  : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
              } ${!torchSupported ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'}`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {torchOn ? 'flash_on' : 'flash_off'}
              </span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload QR from Gallery"
              className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/80 active:scale-95 transition-transform cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">photo_library</span>
            </button>

            <button
              onClick={switchCamera}
              title="Switch Camera"
              className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/80 active:scale-95 transition-transform cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">flip_camera_android</span>
            </button>
          </div>
        </div>
      </div>

      {/* Center Viewport Cutout & Targeting Reticle */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center pointer-events-none px-4">
        {/* Reticle Frame (260px square) */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
          {/* Cyber Neon Corner Brackets */}
          <div
            className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-sm"
            style={{
              borderColor: 'var(--theme-primary-container, #00f0a0)',
              boxShadow: '0 0 10px var(--theme-primary-container, #00f0a0)',
            }}
          ></div>
          <div
            className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-sm"
            style={{
              borderColor: 'var(--theme-primary-container, #00f0a0)',
              boxShadow: '0 0 10px var(--theme-primary-container, #00f0a0)',
            }}
          ></div>
          <div
            className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-sm"
            style={{
              borderColor: 'var(--theme-primary-container, #00f0a0)',
              boxShadow: '0 0 10px var(--theme-primary-container, #00f0a0)',
            }}
          ></div>
          <div
            className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-sm"
            style={{
              borderColor: 'var(--theme-primary-container, #00f0a0)',
              boxShadow: '0 0 10px var(--theme-primary-container, #00f0a0)',
            }}
          ></div>

          {/* Center Target Box Frame */}
          <div className="w-full h-full border border-white/20 rounded-xl flex flex-col justify-between p-3 font-mono">
            <div className="w-full flex justify-between text-[10px] text-white/80 font-bold">
              <span className="tracking-wider">[QRPH-TARGET]</span>
              <span style={{ color: 'var(--theme-primary-fixed, #4dffb2)' }}>
                {isProcessing ? 'DECODING...' : 'AIM READY'}
              </span>
            </div>

            {/* Center Crosshair Marker */}
            <div className="relative self-center flex items-center justify-center w-12 h-12">
              <div
                className="absolute w-full h-[1px]"
                style={{ backgroundColor: 'var(--theme-primary-container, #00f0a0)' }}
              ></div>
              <div
                className="absolute h-full w-[1px]"
                style={{ backgroundColor: 'var(--theme-primary-container, #00f0a0)' }}
              ></div>
              <div
                className="w-3 h-3 rounded-full animate-ping"
                style={{ backgroundColor: 'var(--theme-primary-container, #00f0a0)' }}
              ></div>
            </div>

            <div className="w-full flex justify-between text-[9px] text-white/50 tracking-wider">
              <span>STANDARDIZED</span>
              <span>EMVCo 2.0</span>
            </div>
          </div>

          {/* Animated Laser Scanning Line */}
          <div
            className="absolute inset-x-2 h-0.5 opacity-85 pointer-events-none animate-pulse top-1/2 -translate-y-1/2"
            style={{
              background: 'linear-gradient(to right, transparent, var(--theme-primary-container, #00f0a0), transparent)',
              boxShadow: '0 0 14px var(--theme-primary-container, #00f0a0)',
            }}
          ></div>
        </div>

        {/* Micro Instruction Tag below Reticle */}
        <div className="mt-4 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white font-mono text-xs flex items-center gap-1.5 shadow-lg">
          <span className="material-symbols-outlined text-[16px] text-primary-fixed">qr_code_scanner</span>
          <span>Point camera at any QR Ph, GCash, or Maya code</span>
        </div>
      </div>

      {/* Floating Bottom Action Deck (Safe Area Inset) */}
      <div className="relative z-10 w-full pb-safe px-4 pb-4 pt-3 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-98 transition-all backdrop-blur-md border border-white/20 text-white font-headline-md text-sm font-bold uppercase tracking-wider font-mono cursor-pointer"
        >
          CANCEL SCAN
        </button>
      </div>
    </div>
  );
};

