/**
 * MemoryLane — visual memory thread: portfolio frames on a timeline with
 * mentor-voice captions. Judge-mode centerpiece for the Track 1 story.
 */

import React from 'react';
import { Card, Eyebrow, Tag } from './primitives';
import type { PortfolioListItem } from '../types/memory';
import type { JourneyResponse } from '../services/journeyClient';
import { portfolioImageUrl } from '../lib/portfolioImageUrl';
import { humanizeSkillName } from '../lib/scoreContext';

export type MemoryLaneChip = 'remembered' | 'improved' | 'cleared' | 'retired' | 'next';

export interface MemoryLaneFrame {
  photo: PortfolioListItem;
  caption: string;
  chip?: MemoryLaneChip;
  milestone?: string;
}

const CHIP_LABELS: Record<MemoryLaneChip, string> = {
  remembered: 'Remembered',
  improved: 'Improved',
  cleared: 'Cleared',
  retired: 'Retired',
  next: 'Next focus',
};

/** Spread picks across the timeline so early / middle / late are represented. */
function spreadIndices(length: number, count: number): number[] {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const idx = Math.round((i / (count - 1)) * (length - 1));
    if (!out.includes(idx)) out.push(idx);
  }
  return out;
}

export function buildMemoryLaneFrames(
  pool: PortfolioListItem[],
  journey: JourneyResponse | null,
): MemoryLaneFrame[] {
  const photos = pool.filter((p) => p.imageUrl?.trim());
  if (photos.length === 0) return [];

  const cleared = journey?.skills.filter((s) => s.status === 'cleared') ?? [];
  const watching = (journey?.skills.filter((s) => s.status === 'watching') ?? []).sort(
    (a, b) => b.consecutive - a.consecutive || a.name.localeCompare(b.name),
  );
  const focus = watching[0] ?? null;

  const count = Math.min(5, photos.length);
  const indices = spreadIndices(photos.length, count);

  return indices.map((idx, slot) => {
    const photo = photos[idx]!;
    const isFirst = idx === 0;
    const isLast = idx === photos.length - 1;
    let caption: string;
    let chip: MemoryLaneChip | undefined;
    let milestone: string | undefined;

    if (isFirst) {
      caption = 'Where it started — I began learning your eye from this frame.';
      chip = 'remembered';
      milestone = 'First critique';
    } else if (isLast && cleared.length > 0) {
      const names = cleared.map((s) => humanizeSkillName(s.name).toLowerCase()).join(' and ');
      caption = `Today — ${names} cleared, so I stopped repeating that beginner advice.`;
      chip = 'retired';
      milestone = 'Now';
    } else if (isLast && focus) {
      caption = `Now sharpening ${humanizeSkillName(focus.name).toLowerCase()} — ${focus.consecutive} of 3 strong uploads toward clearing.`;
      chip = 'next';
      milestone = 'Current focus';
    } else if (slot === 1) {
      caption = 'Mid-journey — framing and light started to hold more deliberately.';
      chip = 'improved';
      milestone = 'Progress';
    } else if (cleared[0] && slot === indices.length - 2) {
      caption = `Breakthrough — ${humanizeSkillName(cleared[0].name).toLowerCase()} crossed three strong uploads in a row.`;
      chip = 'cleared';
      milestone = 'Cleared';
    } else {
      caption = 'Another step — each upload updates what I remember and what I retire.';
      chip = 'improved';
      milestone = `Session ${slot + 1}`;
    }

    return { photo, caption, chip, milestone };
  });
}

interface Props {
  frames: MemoryLaneFrame[];
  portfolioTotal?: number;
  onOpenPhoto?: (photoId: string) => void;
}

export const MemoryLane: React.FC<Props> = ({ frames, portfolioTotal, onOpenPhoto }) => {
  if (frames.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-1" aria-label="Memory thread">
      <Card padding="lg" className="border-brand-500/35 bg-gradient-to-b from-brand-500/10 to-surface-1/80 border-l-4 border-l-brand-500/50">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <Eyebrow tone="brand" className="mb-1">
              Memory journey
            </Eyebrow>
            <h2 className="font-serif text-xl md:text-2xl text-white leading-snug">
              How I remember your progress
            </h2>
          </div>
          {portfolioTotal != null && portfolioTotal > 0 && (
            <p className="text-xs text-stone-400 shrink-0">
              {frames.length} milestones · {portfolioTotal} total critiques
            </p>
          )}
        </div>
        <p className="text-sm text-stone-400 mb-5 max-w-2xl">
          A curated arc through your library — first frame, breakthroughs, and what I&apos;m
          coaching now. Scroll the timeline; this is the story, not every upload.
        </p>

        <div className="relative">
          <div
            className="hidden md:block absolute top-[6.75rem] left-8 right-8 h-0.5 bg-gradient-to-r from-brand-500/20 via-brand-400/60 to-brand-500/20 pointer-events-none"
            aria-hidden
          />
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
            {frames.map((frame, index) => (
              <div
                key={frame.photo.id}
                className="relative flex flex-col w-[min(260px,78vw)] shrink-0 snap-start"
              >
                {index < frames.length - 1 && (
                  <span
                    className="md:hidden absolute top-[6.75rem] left-full w-3 h-0.5 bg-brand-400/70 z-10"
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  onClick={() => onOpenPhoto?.(frame.photo.id)}
                  className="group text-left rounded-xl overflow-hidden border-2 border-brand-500/25 bg-photo-black hover:border-brand-400/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 shadow-lg shadow-black/20 flex flex-col"
                >
                  {(frame.milestone || frame.chip) && (
                    <div className="flex flex-wrap gap-1.5 px-3 py-2.5 bg-surface-1 border-b border-warm/50">
                      {frame.milestone && (
                        <Tag variant="outline" className="bg-surface-2 border-stone-600 text-stone-200">
                          {frame.milestone}
                        </Tag>
                      )}
                      {frame.chip && (
                        <Tag variant="brand" className="bg-brand-500/25 text-brand-300 border border-brand-500/40">
                          {CHIP_LABELS[frame.chip]}
                        </Tag>
                      )}
                    </div>
                  )}
                  <div className="aspect-[4/3] relative">
                    <img
                      src={portfolioImageUrl(frame.photo.imageUrl)}
                      alt={frame.photo.sceneDescription || 'Portfolio photo'}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-[10px] text-brand-300/90 uppercase tracking-wider mb-0.5 drop-shadow-sm">
                        {index + 1} of {frames.length}
                      </p>
                      <p className="text-xs text-white leading-snug line-clamp-3 drop-shadow-md">{frame.caption}</p>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
};

export default MemoryLane;
