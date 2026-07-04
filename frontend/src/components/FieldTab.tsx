import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, ChevronUp, Loader2, Target, Upload } from 'lucide-react';
import { SubViewBack } from './SubViewBack';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { analyzeLoadingStage, analyzeWaitHint } from '../lib/analyzeWaitCopy';
import { usePreferUploadCapture } from '../hooks/usePreferUploadCapture';
import { analyzePhoto } from '../services/agentClient';
import { ContinueOnPhoneQr } from './ContinueOnPhoneQr';
import type { Assignment } from '../types/practice';

interface Props {
  assignment: Assignment | null;
  onCaptureAnalyzed?: () => void;
  onGoToPractice: () => void;
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export const FieldTab: React.FC<Props> = ({
  assignment,
  onCaptureAnalyzed,
  onGoToPractice,
}) => {
  const preferUpload = usePreferUploadCapture();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [streaming, setStreaming] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeWaitSec, setAnalyzeWaitSec] = useState(0);
  const [lastCaptureOk, setLastCaptureOk] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera not available on this device. Use upload instead.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError('Camera permission denied or unavailable. Use upload instead.');
    }
  }, []);

  useEffect(() => {
    if (preferUpload && !useCamera) {
      stopCamera();
      return;
    }
    void startCamera();
    return () => stopCamera();
  }, [preferUpload, useCamera, startCamera, stopCamera]);

  useEffect(() => {
    if (!analyzing) {
      setAnalyzeWaitSec(0);
      return;
    }
    const tick = window.setInterval(() => setAnalyzeWaitSec((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, [analyzing]);

  const runAnalysis = async (file: File) => {
    if (!assignment) return;
    setAnalyzing(true);
    setLastCaptureOk(false);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await analyzePhoto({
        imageFile: file,
        assignmentId: assignment.id,
        signal: controller.signal,
      });
      setLastCaptureOk(true);
      onCaptureAnalyzed?.();
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Analysis cancelled.');
      } else {
        setError(friendlyErrorMessage(e));
      }
    } finally {
      abortRef.current = null;
      setAnalyzing(false);
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streaming) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    void runAnalysis(dataUrlToFile(dataUrl, 'field-capture.jpg'));
  };

  if (!assignment) {
    return (
      <div className="max-w-lg mx-auto text-center p-10 rounded-2xl border border-dashed border-warm">
        <Target className="w-10 h-10 text-stone-600 mx-auto mb-3" aria-hidden />
        <h2 className="text-xl font-bold text-white mb-2">Submit for assignment</h2>
        <p className="text-muted text-sm mb-4">
          Accept a practice assignment first — then upload a photo linked to the brief.
        </p>
        <button
          type="button"
          onClick={onGoToPractice}
          className="text-brand-400 font-semibold text-sm hover:underline"
        >
          Go to Practice
        </button>
      </div>
    );
  }

  const briefLong = assignment.brief.length > 200;
  const showCamera = !preferUpload || useCamera;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn pb-6">
      <SubViewBack label="Practice" onClick={onGoToPractice} />

      <div>
        <h2 className="font-serif text-2xl text-white mb-1">
          {preferUpload && !useCamera ? 'Upload for this assignment' : 'Shoot for this assignment'}
        </h2>
        <p className="text-stone-400 text-sm">
          {preferUpload && !useCamera
            ? 'Use your phone or DSLR to shoot, then upload the frame here. Iris will critique it against your assignment brief.'
            : 'Capture with your camera — Iris will critique the frame against your brief right away.'}
        </p>
      </div>

      <div className="rounded-2xl border border-brand-500/40 bg-surface-1 p-4">
        <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-2">
          Active brief
        </p>
        <p
          className={`text-sm text-stone-200 leading-relaxed ${
            briefExpanded || !briefLong ? '' : 'line-clamp-3'
          }`}
        >
          {assignment.brief}
        </p>
        {briefLong && (
          <button
            type="button"
            onClick={() => setBriefExpanded((e) => !e)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
          >
            {briefExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> Show full brief
              </>
            )}
          </button>
        )}
      </div>

      <ContinueOnPhoneQr />

      {showCamera ? (
        <div className="relative rounded-2xl overflow-hidden bg-photo-black border border-warm min-h-[320px] md:min-h-[420px] sm:aspect-[4/3]">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full min-h-[320px] md:min-h-[420px] sm:min-h-0 object-cover sm:object-contain"
            aria-label="Camera preview for practice assignment"
          />
          {analyzing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-canvas-elevated/80 px-6 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-brand-400 mb-3" />
              <p className="text-sm text-stone-200 font-medium mb-1">
                {analyzeLoadingStage(analyzeWaitSec)}
              </p>
              <p className="text-xs text-muted">{analyzeWaitHint(analyzeWaitSec)}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-warm bg-surface-1 p-10 text-center">
          {analyzing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-brand-400" />
              <p className="text-sm text-stone-200">{analyzeLoadingStage(analyzeWaitSec)}</p>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-stone-500 mx-auto mb-3" aria-hidden />
              <p className="text-sm text-stone-300 mb-4">
                JPG, PNG, or WEBP from your camera roll or SD card
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-500 text-on-brand font-semibold hover:bg-brand-400"
              >
                <Upload className="w-5 h-5" />
                Upload for this assignment
              </button>
            </>
          )}
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <p
          className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2"
          role="alert"
        >
          {error}
        </p>
      )}

      {lastCaptureOk && (
        <p className="text-sm text-brand-400 bg-brand-500/10 border border-brand-500/30 rounded-lg px-3 py-2">
          Submitted for this assignment. Mark complete in Practice when you are done.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {showCamera ? (
          <>
            <button
              type="button"
              disabled={!streaming || analyzing}
              onClick={captureFromVideo}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-brand-500 text-on-brand font-bold text-sm disabled:opacity-50 min-h-[52px] flex-1 sm:flex-none"
            >
              <Camera className="w-5 h-5" />
              Capture &amp; analyze
            </button>
            <button
              type="button"
              disabled={analyzing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-warm text-stone-200 text-sm font-medium hover:bg-surface-2 disabled:opacity-50 min-h-[44px]"
            >
              <Upload className="w-5 h-5" />
              Gallery
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={analyzing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-brand-500 text-on-brand font-semibold hover:bg-brand-400 disabled:opacity-50 min-h-[44px] flex-1"
            >
              <Upload className="w-5 h-5" />
              Upload for this assignment
            </button>
            <button
              type="button"
              disabled={analyzing}
              onClick={() => setUseCamera(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-warm text-stone-200 text-sm font-medium hover:bg-surface-2 disabled:opacity-50 min-h-[44px]"
            >
              <Camera className="w-5 h-5" />
              Use this camera
            </button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void runAnalysis(file);
        }}
      />
    </div>
  );
};
