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

  // Multi-tier fallback camera requester scaled for portrait mobile screens
  const requestMediaStream = async (targetFacing: 'environment' | 'user'): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API (navigator.mediaDevices.getUserMedia) is not supported in this browser.');
    }

    // Tier 1: Portrait HD resolution matching mobile phone screens (1080x1920)
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
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw err;
      }
      console.warn('Tier 1 portrait camera constraints failed, attempting fallback...', err);
    }

    // Tier 2: Facing mode with ideal portrait aspect ratio
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
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
  const startCamera = useCallback(async (targetFacing: 'environment' | 'user' = facingMode) => {
    stopCamera();
    setCameraError(null);
    setIsCameraReady(false);

    // Short pause to guarantee OS camera lock release on mobile switching
    await new Promise((r) => setTimeout(r, 60));

    try {
      const mediaStream = await requestMediaStream(targetFacing);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = mediaStream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;

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
      } else {
        setTorchSupported(false);
      }

      setIsCameraReady(true);
    } catch (err: any) {
      console.warn('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser or app settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. You can upload a QR screenshot instead.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is already in use by another app or browser tab. Please close other camera apps and tap "Retry Sensor".');
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

    startCamera(facingMode);

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

  // Torch toggle with active feedback and unsupported fallback notification
  const toggleTorch = async () => {
    triggerHaptic('light');
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) {
      onNotify('Camera Inactive', 'Optic sensor is offline. Tap retry sensor.', 'info');
      return;
    }

    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err: any) {
      console.warn('Torch constraint error:', err);
      onNotify('Flashlight Unavailable', 'Flash is not supported on this camera or device', 'info');
    }
  };

  // Switch Camera front/back with clean teardown
  const switchCamera = () => {
    triggerHaptic('light');
    stopCamera();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Upload screenshot fallback with input reset
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      triggerHaptic('light');
      const dataUrl = await fileToDataUrl(file);
      const result = await decodeQRCode(dataUrl);

      if (result.success && result.payload) {
        handleQRDetected(result.payload, dataUrl);
      } else {
        onNotify('No QR Code Found', 'Please choose a clear QR Ph code image or screenshot', 'error');
      }
    } catch (err) {
      console.warn('Error reading image file:', err);
      onNotify('Error Reading Image', 'Could not process the selected file', 'error');
    } finally {
      setIsProcessing(false);
      if (e.target) {
        e.target.value = '';
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
    <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-black text-on-surface flex flex-col justify-between overflow-hidden select-none">
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

      {/* LIVE CAMERA STREAM - Edge-to-Edge Full Screen (Zero Side Borders, Scaled with Phone) */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        className="fixed inset-0 w-full h-full object-cover z-0"
      />

      {/* Camera Loading or Error State */}
      {cameraError ? (
        <div className="absolute inset-0 bg-surface/95 flex flex-col items-center justify-center p-6 text-center z-20">
          <span className="material-symbols-outlined text-4xl text-amber-400 mb-2">
            warning
          </span>
          <span className="font-label-md text-label-md text-on-surface font-bold font-mono">
            OPTIC SENSOR OFFLINE
          </span>
          <p className="font-body-sm text-body-sm text-outline mt-1 mb-4 leading-relaxed font-sans max-w-xs">
            {cameraError}
          </p>
          <div className="flex gap-2 w-full max-w-xs font-mono">
            <button
              onClick={() => {
                triggerHaptic('light');
                startCamera(facingMode);
              }}
              className="flex-1 py-2 bg-surface-container-high hover:bg-surface-bright text-primary-fixed font-label-sm text-label-sm rounded-lg border border-white/[0.08] active:translate-y-0.5 transition-transform cursor-pointer"
            >
              RETRY SENSOR
            </button>
            <button
              onClick={() => {
                triggerHaptic('light');
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                  fileInputRef.current.click();
                }
              }}
              className="flex-1 py-2 bg-primary-container hover:opacity-90 text-on-primary-container font-label-sm text-label-sm rounded-lg font-bold active:translate-y-0.5 transition-transform cursor-pointer"
            >
              UPLOAD FILE
            </button>
          </div>
        </div>
      ) : !isCameraReady ? (
        <div className="absolute inset-0 bg-surface-container-lowest flex flex-col items-center justify-center gap-2 z-10 font-mono">
          <span className="material-symbols-outlined text-3xl text-primary animate-spin">
            refresh
          </span>
          <span className="font-label-sm text-label-sm text-primary tracking-widest">
            CALIBRATING SENSOR...
          </span>
        </div>
      ) : null}

      {/* Full-Screen CRT Scanline & Dot-Matrix Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_at_center,rgba(0,240,160,0.04)_0%,rgba(11,14,21,0.75)_100%)]"></div>
      <div className="fixed inset-0 pointer-events-none z-[1] opacity-25 bg-[linear-gradient(rgba(18,19,22,0)_50%,rgba(0,0,0,0.8)_50%)] bg-[length:100%_4px]"></div>

      {/* Top Floating Cyber HUD Header Bar (Safe Area Aware) */}
      <div className="relative z-10 w-full pt-safe px-4 pt-3 pb-2 flex flex-col gap-2 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        {/* Status Strip: ROM & Live Link */}
        <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm font-mono">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-fixed border border-white/[0.08]">
              ROM: 82%
            </span>
            <span className="text-outline">|</span>
            <span className="text-tertiary tracking-widest">BAT [||||]</span>
          </div>
          <div className="flex items-center gap-1.5 text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
            <span className="text-primary-fixed">LIVE-LINK</span>
          </div>
        </div>

        {/* Navigation & Cyber Branding Row */}
        <div className="flex items-center justify-between mt-0.5">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              aria-label="Close Viewfinder"
              className="w-8 h-8 rounded-lg bg-surface-container-high/80 hover:bg-surface-bright border border-white/[0.08] backdrop-blur-md flex items-center justify-center text-on-surface active:translate-y-0.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-headline-md text-headline-md tracking-tight text-primary-fixed uppercase font-bold text-sm">
                  POCKET•QR
                </span>
                <span className="font-label-sm text-label-sm text-outline px-1 rounded bg-surface-container-low font-mono border border-white/[0.06]">
                  v1.0
                </span>
              </div>
              <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono">
                Cyber Viewfinder
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            aria-label="Close"
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg bg-surface-container-high/80 hover:bg-surface-bright border border-white/[0.08] backdrop-blur-md flex items-center justify-center active:translate-y-0.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Hardware Telemetry Strip */}
        <div className="flex items-center justify-between px-2 py-1 rounded bg-black/60 backdrop-blur-md text-on-surface-variant font-label-sm text-label-sm font-mono border border-white/[0.08]">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-ping"></span>
            <span className="text-primary-fixed uppercase tracking-wider">
              OPTIC_SENS: {facingMode === 'environment' ? 'REAR_4K' : 'FRONT_HD'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-outline">
            <span>LAT: 14.55° N</span>
            <span>|</span>
            <span className="text-primary-fixed font-bold">
              {isProcessing ? 'DECODING...' : 'HUD: 60FPS'}
            </span>
          </div>
        </div>

        {/* Camera Controls Ribbon (Flash, Gallery, Lens Flip) */}
        <div className="grid grid-cols-3 gap-2 font-mono">
          {/* Flash / Torch */}
          <button
            onClick={toggleTorch}
            title={torchSupported ? (torchOn ? 'Turn off Flash' : 'Turn on Flash') : 'Toggle Flash'}
            className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg border backdrop-blur-md transition-all shadow-[0_2px_0_0_#0b0e15] cursor-pointer active:translate-y-0.5 ${
              torchOn
                ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)] font-bold'
                : 'bg-surface-container-high/80 hover:bg-surface-bright text-on-surface border-white/[0.08]'
            } ${!torchSupported && isCameraReady ? 'opacity-80' : ''}`}
          >
            <span className={`material-symbols-outlined text-[16px] ${torchOn ? 'text-black' : 'text-amber-400'}`}>
              bolt
            </span>
            <span className={`font-label-sm text-label-sm tracking-widest font-bold ${torchOn ? 'text-black' : 'text-amber-400'}`}>
              FLASH: {torchOn ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Gallery Upload */}
          <button
            onClick={() => {
              triggerHaptic('light');
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
                fileInputRef.current.click();
              }
            }}
            title="Upload QR from Gallery"
            className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg bg-surface-container-high/80 text-on-surface hover:bg-surface-bright backdrop-blur-md active:translate-y-0.5 transition-all shadow-[0_2px_0_0_#0b0e15] border border-white/[0.08] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-tertiary">
              photo_library
            </span>
            <span className="font-label-sm text-label-sm tracking-widest text-tertiary uppercase font-bold">
              GALLERY
            </span>
          </button>

          {/* Flip Lens */}
          <button
            onClick={switchCamera}
            title="Flip Front / Rear Camera"
            className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg bg-surface-container-high/80 text-on-surface hover:bg-surface-bright backdrop-blur-md active:translate-y-0.5 transition-all shadow-[0_2px_0_0_#0b0e15] border border-white/[0.08] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-primary-fixed">
              flip_camera_android
            </span>
            <span className="font-label-sm text-label-sm tracking-widest text-primary-fixed uppercase font-bold">
              {facingMode === 'environment' ? 'LENS: S1' : 'LENS: SELF'}
            </span>
          </button>
        </div>
      </div>

      {/* Center Targeting Reticle Deck (Full Phone Screen Center, Zero Side Constraints) */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center pointer-events-none px-4">
        {/* Reticle Frame */}
        <div className="relative w-60 h-60 sm:w-68 sm:h-68 flex items-center justify-center">
          {/* Neon Corner Brackets */}
          <div
            className="absolute -top-1 -left-1 w-7 h-7 border-t-2 border-l-2 rounded-tl-sm"
            style={{ borderColor: 'var(--theme-primary-container, #00f0a0)' }}
          ></div>
          <div
            className="absolute -top-1 -right-1 w-7 h-7 border-t-2 border-r-2 rounded-tr-sm"
            style={{ borderColor: 'var(--theme-primary-container, #00f0a0)' }}
          ></div>
          <div
            className="absolute -bottom-1 -left-1 w-7 h-7 border-b-2 border-l-2 rounded-bl-sm"
            style={{ borderColor: 'var(--theme-primary-container, #00f0a0)' }}
          ></div>
          <div
            className="absolute -bottom-1 -right-1 w-7 h-7 border-b-2 border-r-2 rounded-br-sm"
            style={{ borderColor: 'var(--theme-primary-container, #00f0a0)' }}
          ></div>

          {/* Pulsing Lock Box */}
          <div className="w-full h-full rounded-xl shadow-[0_0_18px_rgba(0,240,160,0.25)] bg-black/30 backdrop-blur-[2px] border border-white/[0.1] flex flex-col items-center justify-between p-3 animate-pulse font-mono">
            {/* Floating Corner Metric Tags */}
            <div className="w-full flex justify-between font-label-sm text-label-sm text-primary-fixed">
              <span>[POS:X-294]</span>
              <span>[POS:Y-802]</span>
            </div>

            {/* Center Crosshair Target Marker */}
            <div className="relative flex items-center justify-center w-12 h-12">
              <div
                className="absolute w-full h-[1px]"
                style={{ backgroundColor: 'var(--theme-primary-container, #00f0a0)' }}
              ></div>
              <div
                className="absolute h-full w-[1px]"
                style={{ backgroundColor: 'var(--theme-primary-container, #00f0a0)' }}
              ></div>
              <div
                className="w-3.5 h-3.5 rounded-full animate-ping"
                style={{ backgroundColor: 'var(--theme-primary-container, #00f0a0)' }}
              ></div>
            </div>

            <div className="w-full flex justify-between font-label-sm text-label-sm text-tertiary-fixed">
              <span>DIST: 0.28M</span>
              <span>CONF: 99.8%</span>
            </div>
          </div>

          {/* Animated Laser Scanning Line */}
          <div
            className="absolute inset-x-1 h-0.5 opacity-90 pointer-events-none animate-pulse top-1/2 -translate-y-1/2"
            style={{
              background: 'linear-gradient(to right, transparent, var(--theme-primary-container, #00f0a0), transparent)',
              boxShadow: '0 0 14px var(--theme-primary-container, #00f0a0)',
            }}
          ></div>
        </div>

        {/* Bottom Target Status Banner */}
        <div className="mt-4 px-3 py-1 rounded bg-black/70 backdrop-blur-md font-mono border border-white/[0.08] text-[10px] flex items-center gap-2 shadow-lg">
          <div className="flex items-center gap-1.5 text-primary-fixed">
            <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
            <span className="font-bold tracking-wider">QRPH SENSOR ACTIVE</span>
          </div>
          <span className="text-outline">::</span>
          <span className="text-secondary tracking-wider">INSTAPAY ROUTED</span>
        </div>

        {/* Micro Instruction Deck */}
        <div className="mt-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.08] text-white/80 font-mono text-xs flex items-center gap-1.5 shadow-md">
          <span className="material-symbols-outlined text-[14px] text-tertiary">info</span>
          <span>POINT CAMERA AT ANY QRPH, GCASH, OR MAYA CODE</span>
        </div>
      </div>

      {/* Floating Bottom Action Deck (Safe Area Inset) */}
      <div className="relative z-10 w-full pb-safe px-4 pb-4 pt-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        <button
          onClick={() => {
            triggerHaptic('light');
            onClose();
          }}
          className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-headline-md text-sm font-bold tracking-wider uppercase border border-white/[0.15] backdrop-blur-md active:translate-y-0.5 transition-all cursor-pointer shadow-[0_2px_0_0_#0b0e15] font-mono"
        >
          CANCEL SCAN
        </button>
      </div>
    </div>
  );
};
