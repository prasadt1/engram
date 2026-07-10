/**
 * MemoryThreads — genre "memory threads" on Home: one card per genre the
 * mentor has enough frames to remember, each a small chronological reel you
 * step through with prev/next. Replaces the MemoryLane strip's usage on Home
 * (MemoryLane stays in the tree, unused, so the swap is reversible).
 *
 * All captions are computed from the already-fetched portfolio entries — no
 * new network calls, no invented numbers.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Card } from './primitives';
import { HomeSectionHeader } from './HomeSectionHeader';
import { portfolioImageUrl } from '../lib/portfolioImageUrl';
import { formatPhotoDate } from '../lib/formatPhotoDate';
import type { PortfolioListItem } from '../types/memory';

const MAX_THREADS = 5;
const MIN_THREAD_PHOTOS = 2;
/** Overall-score gain (first → latest) needed before we claim progress. */
const PROGRESS_MIN_DELTA = 0.3;
const AUTOPLAY_MS = 2500;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export interface GenreThread {
  genre: string;
  photos: PortfolioListItem[];
}

function humanizeGenre(genre: string): string {
  const s = genre.replace(/_/g, ' ').trim();
  if (!s) return genre;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Group portfolio entries into per-genre chronological threads. */
export function buildGenreThreads(pool: PortfolioListItem[]): GenreThread[] {
  const byGenre = new Map<string, PortfolioListItem[]>();
  for (const photo of pool) {
    const genre = photo.genre?.trim();
    if (!genre || !photo.imageUrl?.trim()) continue;
    const bucket = byGenre.get(genre);
    if (bucket) bucket.push(photo);
    else byGenre.set(genre, [photo]);
  }

  return [...byGenre.entries()]
    .map(([genre, photos]) => ({
      genre,
      photos: [...photos].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    }))
    .filter((thread) => thread.photos.length >= MIN_THREAD_PHOTOS)
    .sort((a, b) => b.photos.length - a.photos.length)
    .slice(0, MAX_THREADS);
}

interface ThreadCardProps {
  thread: GenreThread;
  onOpenPhoto?: (photoId: string) => void;
}

const ThreadCard: React.FC<ThreadCardProps> = ({ thread, onOpenPhoto }) => {
  const { genre, photos } = thread;
  const prefersReducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [imgVisible, setImgVisible] = useState(true);
  const indexRef = useRef(0);
  indexRef.current = index;

  const pauseAutoplay = useCallback(() => {
    setPlaying(false);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= photos.length || next === index) return;
      setImgVisible(false);
      window.setTimeout(() => {
        setIndex(next);
        setImgVisible(true);
      }, 180);
    },
    [index, photos.length],
  );

  useEffect(() => {
    if (!playing || prefersReducedMotion || photos.length < 2) return;
    const id = window.setInterval(() => {
      const i = indexRef.current;
      if (i >= photos.length - 1) {
        setPlaying(false);
        return;
      }
      setImgVisible(false);
      window.setTimeout(() => {
        setIndex(i + 1);
        setImgVisible(true);
      }, 180);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, prefersReducedMotion, photos.length]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (prefersReducedMotion || photos.length < 2) return;
    setPlaying((p) => !p);
  };

  const genreTitle = humanizeGenre(genre);
  const genreLower = genreTitle.toLowerCase();
  const current = photos[index]!;
  const first = photos[0]!;
  const latest = photos[photos.length - 1]!;
  const maxScore = Math.max(...photos.map((p) => p.overallAverage));

  const firstDate = formatPhotoDate(first.createdAt);
  const improved = latest.overallAverage - first.overallAverage >= PROGRESS_MIN_DELTA;
  const threadLine = improved
    ? `${photos.length} ${genreLower} photos since ${firstDate} — overall ${first.overallAverage.toFixed(1)} → ${latest.overallAverage.toFixed(1)}.`
    : `${photos.length} ${genreLower} photos since ${firstDate}.`;

  const isStrongest = current.overallAverage === maxScore;
  const perPhotoLine = isStrongest
    ? `Your strongest ${genreLower} yet — ${current.overallAverage.toFixed(1)}/10.`
    : `${current.overallAverage.toFixed(1)}/10 · ${formatPhotoDate(current.createdAt)}`;

  const atStart = index === 0;
  const atEnd = index === photos.length - 1;
  const dateChip = formatPhotoDate(current.createdAt);

  return (
    <div className="flex flex-col w-[min(320px,84vw)] shrink-0 snap-start rounded-xl border-2 border-brand-500/25 bg-photo-black overflow-hidden shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-surface-1 border-b border-warm/50">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-white truncate">{genreTitle}</h3>
          <p className="text-[11px] text-stone-400 leading-snug line-clamp-2">{threadLine}</p>
        </div>
        <span className="text-[11px] text-stone-400 tabular-nums shrink-0">
          {index + 1} of {photos.length}
        </span>
      </div>

      <div
        className="group relative aspect-[4/3] overflow-hidden"
        onMouseEnter={pauseAutoplay}
        onFocusCapture={pauseAutoplay}
      >
        <button
          type="button"
          onClick={() => onOpenPhoto?.(current.id)}
          className="absolute inset-0 w-full h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
          aria-label={`Open this ${genreLower} photo in My Work`}
        >
          <img
            src={portfolioImageUrl(current.imageUrl)}
            alt={current.sceneDescription || `${genreTitle} photo`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              imgVisible ? 'opacity-100' : 'opacity-0'
            } ${
              playing && !prefersReducedMotion
                ? 'scale-110 transition-transform duration-[2500ms] ease-linear'
                : 'scale-100 transition-transform duration-300 group-hover:scale-[1.02]'
            }`}
            loading="lazy"
          />
        </button>
        {!prefersReducedMotion && photos.length >= 2 && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute top-2 left-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-stone-100 hover:bg-black/80 border border-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
            aria-label={playing ? 'Pause thread playback' : 'Play thread slideshow'}
          >
            {playing ? <Pause className="w-3.5 h-3.5" aria-hidden /> : <Play className="w-3.5 h-3.5" aria-hidden />}
          </button>
        )}
        {dateChip && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-stone-100 text-[11px] font-medium tabular-nums pointer-events-none">
            {dateChip}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
        <p className="absolute bottom-2 left-3 right-3 text-xs text-white leading-snug drop-shadow-md pointer-events-none">
          {perPhotoLine}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-surface-1 border-t border-warm/50">
        <button
          type="button"
          onClick={() => {
            pauseAutoplay();
            goTo(index - 1);
          }}
          disabled={atStart}
          aria-label={`Previous ${genreLower} photo`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-warm text-stone-300 hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </button>
        <div className="flex items-center gap-1" aria-hidden>
          {photos.map((p, i) => (
            <span
              key={p.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-4 bg-brand-400' : 'w-1.5 bg-surface-2 border border-warm'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            pauseAutoplay();
            goTo(index + 1);
          }}
          disabled={atEnd}
          aria-label={`Next ${genreLower} photo`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-warm text-stone-300 hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
        >
          <ChevronRight className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  );
};

interface Props {
  photos: PortfolioListItem[];
  onOpenPhoto?: (photoId: string) => void;
}

export const MemoryThreads: React.FC<Props> = ({ photos, onOpenPhoto }) => {
  const threads = useMemo(() => buildGenreThreads(photos), [photos]);
  if (threads.length === 0) return null;

  return (
    <section className="w-full" aria-label="Memory threads">
      <Card padding="lg" className="border-brand-500/35 bg-gradient-to-b from-brand-500/10 to-surface-1/80 border-l-4 border-l-brand-500/50">
        <HomeSectionHeader
          eyebrow="Memory threads"
          title="Your journey, as I remember it"
          subtitle="One thread per genre I've seen enough of — step through each to watch your eye develop. Tap a frame to open it in My Work."
        />

        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
          {threads.map((thread) => (
            <ThreadCard key={thread.genre} thread={thread} onOpenPhoto={onOpenPhoto} />
          ))}
        </div>
      </Card>
    </section>
  );
};

export default MemoryThreads;
