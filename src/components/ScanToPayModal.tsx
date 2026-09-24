import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  X,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Image,
  AlertCircle,
  Loader2,
  ScanLine,
  RefreshCw,
} from 'lucide-react';
import type { ParsedEMVCo } from '../lib/emvcoParser';
import { parseQRPhPayload } from '../lib/emvcoParser';
import { decodeQRCode, fileToDataUrl } from '../lib/qrDecoder';
import { triggerHaptic } from '../lib/security';
import { PaymentRoutingSheet } from './PaymentRoutingSheet';
import type { QRCardItem } from '../types/qr';

interface ScanToPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToWallet: (card: QRCardItem) => void;
  onNotify: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
}

export const ScanToPayModal: React.FC<ScanToPayModalProps> = ({
  isOpen,
  onClose,
  onSaveToWallet,
  onNotify,
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

    // Tier 1: Ideal HD resolution with desired facing mode
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
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

    // Tier 2: Facing mode only (no resolution constraints)
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: targetFacing,
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
      video: true,
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

      onNotify(
        'QR Code Scanned!',
        parsed.merchantName ? `Payee: ${parsed.merchantName}` : 'Ready to select paying bank',
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
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-200 safe-p">
      <div className="relative w-full h-full max-w-lg md:max-w-xl bg-slate-900 border border-slate-800 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
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

        {/* Top Control Bar */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent safe-top">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isCameraReady ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-1.5">
              <ScanLine className="w-4 h-4 text-emerald-400" />
              Scan to Pay
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Flashlight / Torch button */}
            {torchSupported && (
              <button
                onClick={toggleTorch}
                title={torchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                className={`min-h-[44px] min-w-[44px] p-2.5 rounded-full backdrop-blur-md border transition-all flex items-center justify-center ${
                  torchOn
                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                    : 'bg-black/50 text-white border-white/20 hover:bg-black/70'
                }`}
              >
                {torchOn ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
              </button>
            )}

            {/* Switch Camera */}
            <button
              onClick={switchCamera}
              title="Switch Front/Back Camera"
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 transition-all flex items-center justify-center"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 transition-all flex items-center justify-center"
              aria-label="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder View */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-sm flex flex-col items-center">
              <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
              <h4 className="text-base font-bold text-white mb-2">Camera Unavailable</h4>
              <p className="text-xs text-slate-300 mb-6 leading-relaxed">{cameraError}</p>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={startCamera}
                  className="min-h-[44px] flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs active:scale-95 transition-all"
                >
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                  <span>Try Again</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg active:scale-95 transition-all"
                >
                  <Image className="w-4 h-4" />
                  <span>Upload Photo</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Loading camera placeholder */}
              {!isCameraReady && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3 z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs font-medium">Starting camera...</span>
                </div>
              )}

              {/* HTML5 Live Video Stream */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Scanning Reticle Frame */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-emerald-400/40 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                  {/* Glowing Corner Accents */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                  {/* Animated Scanning Laser Line */}
                  <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399] animate-pulse-subtle top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Loading Indicator when parsing */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-2 z-20">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs font-semibold">Decoding QR Ph Payload...</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 sm:p-5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3 safe-bottom shrink-0">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-200 block">
              Align QR Ph code inside the frame
            </span>
            <span className="text-[11px] text-slate-400 truncate block">
              Scans GCash, Maya, RCBC, BPI & any QR Ph standee
            </span>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold shrink-0 transition-colors"
          >
            <Image className="w-4 h-4 text-blue-400" />
            <span>Upload Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
