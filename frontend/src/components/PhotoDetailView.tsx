/**
 * PhotoDetailView — the split view behind "click a photo, talk to the
 * mentor about it": the photo + its scores on the left, a MentorChat scoped
 * to that exact photo on the right. Page-level overlay (not the old
 * ImageLightbox modal, which stays a separate, untouched component for the
 * simple full-size-view flow elsewhere).
 *
 * Scoping: MentorChat's photoId must be the photo's raw storage key (e.g.
 * "photos/abc.jpg"), not its imageUrl — the backend's chat route passes
 * photo_id straight through as memory_store.recall(scope=photo_id), and the
 * memory a critique wrote for this photo was scoped under that same storage
 * key (app/coach.py). See PortfolioListItem.storageKey (types/memory.ts).
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DimensionBar } from './DimensionBar';
import { MentorChat } from './MentorChat';
import { Tag } from './primitives/Tag';
import type { PortfolioListItem } from '../types/memory';

const DIMENSIONS: { key: keyof PortfolioListItem['scores']; label: string }[] = [
  { key: 'composition', label: 'Composition' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'technique', label: 'Technique' },
  { key: 'creativity', label: 'Creativity' },
  { key: 'subject_impact', label: 'Subject' },
];

interface Props {
  photo: PortfolioListItem;
  persona: 'hobbyist' | 'working_pro';
  judgeMode?: boolean;
  onClose: () => void;
}

export const PhotoDetailView: React.FC<Props> = ({ photo, persona, judgeMode = false, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // A photo without a storage key (e.g. legacy data saved before this field
  // existed) still opens — chat just falls back to portfolio-wide memory
  // instead of erroring, matching sendMentorMessage's `photoId?: string`.
  const photoId = photo.storageKey || undefined;
  const scopedMemoryCopy = photoId
    ? 'I only draw on memory tied to this specific frame.'
    : 'I’ll start from this photo and your broader library memory.';
  const scopedEmptyCopy = photoId
    ? 'Ask what’s working, what to try next, or how this compares to your other shots — I only recall memory scoped to this photo.'
    : 'Ask what’s working or what to try next — replies draw on your broader library memory for this frame.';
  // genre isn't on PortfolioListItem's wire contract yet (only on
  // AnalysisResult/MemoryReceipt items) — read it defensively so this Tag
  // renders the moment the backend starts including it, and quietly does
  // nothing until then, matching the task's "genre Tag if present" framing.
  const genre = (photo as PortfolioListItem & { genre?: string }).genre;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col md:flex-row"
      role="dialog"
      aria-modal="true"
      aria-label="Photo detail and mentor chat"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 text-stone-200 hover:bg-white/20 transition-colors"
        aria-label="Close photo detail"
      >
        <X className="w-5 h-5" aria-hidden />
      </button>

      {/* Left pane: photo + scores */}
      <div className="w-full md:w-1/2 flex flex-col overflow-y-auto p-4 sm:p-6 md:border-r border-warm/40">
        <div className="flex-1 min-h-0 flex items-center justify-center bg-photo-black rounded-xl overflow-hidden mb-4 max-h-[45vh] md:max-h-[60vh]">
          {photo.imageUrl ? (
            <img
              src={photo.imageUrl}
              alt={photo.sceneDescription?.slice(0, 120) || 'Portfolio photo'}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>

        <div className="space-y-4 max-w-lg">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-on-brand text-xs font-bold tabular-nums">
              {photo.overallAverage}/10
            </span>
            {genre && <Tag variant="outline">{genre}</Tag>}
          </div>

          {photo.sceneDescription && (
            <p className="text-sm text-stone-300 leading-relaxed">{photo.sceneDescription}</p>
          )}

          <div className="space-y-3 pt-2 border-t border-warm/40">
            {DIMENSIONS.map((d, i) => (
              <DimensionBar key={d.key} label={d.label} value={photo.scores[d.key]} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Right pane: mentor chat scoped to this photo */}
      <div className="w-full md:w-1/2 flex flex-col min-h-[50vh] md:min-h-0 p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="font-serif text-xl text-white">Ask about this photo</h2>
          <p className="text-muted text-sm mt-1">{scopedMemoryCopy}</p>
        </div>
        <MentorChat
          persona={persona}
          photoId={photoId}
          placeholder="Ask about this photo…"
          emptyStateDescription={scopedEmptyCopy}
          prominentReceipt={judgeMode}
        />
      </div>
    </div>,
    document.body,
  );
};
