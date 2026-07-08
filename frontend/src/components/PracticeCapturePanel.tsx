/**
 * Inline practice submission — upload against the active assignment without
 * leaving the Practice tab. Reuses Studio's PhotoUploader + analysis results.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { analyzePhoto } from '../services/agentClient';
import { mapAnalysisResult } from '../lib/mapAnalysisResult';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { formatSkillLabel } from '../lib/formatSkillLabel';
import type { AnalysisResult } from '../types';
import type { Assignment } from '../types/practice';
import PhotoUploader from './studio/PhotoUploader';
import StudioAnalysisResults from './studio/StudioAnalysisResults';
import { ActivePracticeBanner } from './studio/ActivePracticeBanner';
import { Button } from './primitives';
import { useToast } from './ToastHost';
import { SubViewBack } from './SubViewBack';

interface Props {
  assignment: Assignment;
  onBack: () => void;
  onAnalyzed: () => void;
  onCompleteAssignment: () => void;
  completing: boolean;
}

export const PracticeCapturePanel: React.FC<Props> = ({
  assignment,
  onBack,
  onAnalyzed,
  onCompleteAssignment,
  completing,
}) => {
  const toast = useToast();
  const [phase, setPhase] = useState<'upload' | 'analyzing' | 'result'>('upload');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState('photo.jpg');
  const [error, setError] = useState<string | null>(null);
  const [waitSec, setWaitSec] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (phase !== 'analyzing') {
      setWaitSec(0);
      return;
    }
    const tick = window.setInterval(() => setWaitSec((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, [phase]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setPhase('upload');
    setError(null);
  }, [imageUrl]);

  const handleImageSelected = async (file: File, previewUrl: string) => {
    setPhase('analyzing');
    setResult(null);
    setImageUrl(previewUrl);
    setFilename(file.name);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const analysisResult = await analyzePhoto({
        imageFile: file,
        assignmentId: assignment.id,
        signal: controller.signal,
      });
      setResult(analysisResult);
      setPhase('result');
      toast({
        variant: 'success',
        icon: <CheckCircle2 className="w-[18px] h-[18px]" />,
        title: 'Submitted for practice',
        message: `Critiqued against ${formatSkillLabel(assignment.targetSkill)}.`,
      });
      onAnalyzed();
    } catch (err) {
      console.error('Practice analysis failed:', err);
      URL.revokeObjectURL(previewUrl);
      setImageUrl(null);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Analysis cancelled.');
      } else {
        setError(friendlyErrorMessage(err));
      }
      setPhase('upload');
    } finally {
      abortRef.current = null;
    }
  };

  if (phase === 'result' && result && imageUrl) {
    return (
      <div className="animate-fadeIn space-y-4 max-w-4xl mx-auto">
        <SubViewBack label="Practice" onClick={onBack} />
        <p className="text-sm text-brand-400 bg-brand-500/10 border border-brand-500/30 rounded-lg px-3 py-2">
          Linked to active practice: {formatSkillLabel(assignment.targetSkill)}
        </p>
        <StudioAnalysisResults
          analysis={mapAnalysisResult(result)}
          imageSrc={imageUrl}
          originalFilename={filename}
          onReset={onBack}
          memoryUpdate={result.memoryUpdate}
        />
        <div className="flex flex-wrap gap-3 pb-8">
          <Button
            disabled={completing}
            icon={
              completing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )
            }
            onClick={onCompleteAssignment}
          >
            Mark practice complete
          </Button>
          <Button variant="secondary" onClick={onBack}>
            Keep practicing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn relative max-w-3xl mx-auto space-y-6">
      <SubViewBack label="Practice" onClick={phase === 'analyzing' ? cancel : onBack} />
      <ActivePracticeBanner assignment={assignment} />
      <div className="text-center max-w-xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl font-medium text-white mb-2">
          {phase === 'analyzing' ? 'Critiquing against your brief' : 'Upload your practice shot'}
        </h2>
        {phase === 'upload' && (
          <p className="text-muted text-sm">
            A new photo for this assignment — not one already in your library. JPG, PNG, or WEBP.
          </p>
        )}
      </div>
      {error && (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
      <PhotoUploader
        onImageSelected={(file, preview) => void handleImageSelected(file, preview)}
        isAnalyzing={phase === 'analyzing'}
        waitSec={waitSec}
        onCancel={cancel}
      />
    </div>
  );
};
