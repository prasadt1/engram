/**
 * ContactSheet — compact newest-first library roll (not the memory journey).
 * Small square thumbs in a wrap grid so it reads differently from MemoryLane.
 */

import React, { useState } from 'react';
import { ImageIcon, Upload } from 'lucide-react';
import { Button, Eyebrow } from './primitives';
import { portfolioImageUrl } from '../lib/portfolioImageUrl';
import type { PortfolioListItem } from '../types/memory';

const PLACEHOLDER_SCENE_RE = /under review|placeholder summary|could not be generated/i;

function contactSheetThumbTitle(photo: PortfolioListItem): string {
  const score = `${photo.overallAverage.toFixed(1)}/10`;

  const scene = photo.sceneDescription?.trim();
  if (scene && !PLACEHOLDER_SCENE_RE.test(scene)) {
    const short = scene.length > 72 ? `${scene.slice(0, 69)}…` : scene;
    return `${score} — ${short}`;
  }

  const summary = photo.glassBoxSummary?.find((line) => line?.trim())?.trim();
  if (summary && !PLACEHOLDER_SCENE_RE.test(summary)) {
    const short = summary.length > 72 ? `${summary.slice(0, 69)}…` : summary;
    return `${score} — ${short}`;
  }

  const tags = photo.aestheticTags
    .slice(0, 2)
    .map((t) => t.replace(/_/g, ' '))
    .join(', ');
  if (tags) return `${score} — ${tags}`;

  return `${score} — open in library`;
}

function contactSheetThumbAlt(photo: PortfolioListItem): string {
  const title = contactSheetThumbTitle(photo);
  return title.startsWith(photo.overallAverage.toFixed(1))
    ? `Portfolio photo, ${title}`
    : title;
}

interface Props {
  photos: PortfolioListItem[];
  loading?: boolean;
  uploading?: boolean;
  onOpenPhoto?: (photoId: string) => void;
  onNavigateLibrary: () => void;
  onUpload: () => void;
}

export const ContactSheet: React.FC<Props> = ({
  photos,
  loading = false,
  uploading = false,
  onOpenPhoto,
  onNavigateLibrary,
  onUpload,
}) => {
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set());

  if (!loading && photos.length === 0) return null;

  return (
    <section
      className="max-w-6xl mx-auto px-1 pt-6 border-t border-warm/50"
      aria-label="Recent uploads"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <Eyebrow tone="faint" className="mb-1">
            Library roll
          </Eyebrow>
          <h2 className="font-serif text-lg md:text-xl text-white">Recent uploads</h2>
          <p className="text-stone-500 text-xs md:text-sm mt-1 max-w-xl">
            Newest first — every critiqued frame in your library. Not the memory story above; just
            your full roll, like a contact sheet print.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            icon={<Upload className="w-4 h-4" />}
            onClick={onUpload}
            disabled={uploading}
          >
            Upload
          </Button>
          <Button variant="subtle" size="sm" onClick={onNavigateLibrary}>
            Open library →
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-md bg-surface-2 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 sm:gap-2.5">
          {photos.map((photo) => {
            const thumbUrl = portfolioImageUrl(photo.imageUrl);
            const broken = !thumbUrl || brokenIds.has(photo.id);
            return (
            <button
              key={photo.id}
              type="button"
              onClick={() => onOpenPhoto?.(photo.id)}
              className="group relative w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 shrink-0 rounded-md overflow-hidden border border-warm/70 bg-photo-black hover:border-brand-400/50 hover:ring-1 hover:ring-brand-400/30 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
              title={contactSheetThumbTitle(photo)}
            >
              {broken ? (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
                  <ImageIcon className="w-5 h-5 text-stone-600" aria-hidden />
                </div>
              ) : (
                <img
                  src={thumbUrl}
                  alt={contactSheetThumbAlt(photo)}
                  className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  loading="lazy"
                  onError={() => {
                    setBrokenIds((prev) => {
                      if (prev.has(photo.id)) return prev;
                      const next = new Set(prev);
                      next.add(photo.id);
                      return next;
                    });
                  }}
                />
              )}
              <span className="absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] font-bold tabular-nums text-white bg-black/65">
                {photo.overallAverage.toFixed(1)}
              </span>
            </button>
          );
          })}
        </div>
      )}
    </section>
  );
};

export default ContactSheet;
