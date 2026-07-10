/**
 * HomeTab — Layered homepage: first-visit pitch vs returning personal hero.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  Database,
  ImageIcon,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { AnalyzingOverlay } from './AnalyzingOverlay';
import { InlineAlertBanner } from './InlineAlertBanner';
import { JourneySection } from './JourneySection';
import { MemoryThreads, buildGenreThreads } from './MemoryThreads';
import { ContactSheet } from './ContactSheet';
import { LibraryBackdrop } from './LibraryBackdrop';
import { PhotoMat } from './PhotoMat';
import { Button, Card, Tag, Eyebrow, StatCard } from './primitives';
import { useCountUp } from '../hooks/useCountUp';
import { formatSkillLabel } from '../lib/formatSkillLabel';
import { formatTagLabel } from '../lib/formatTagLabel';
import {
  buildHeroMentorCaption,
  currentFocusFromJourney,
  type HeroMentorCaption,
} from '../lib/coachingBrief';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { pickHomeHeroPhoto } from '../lib/pickHomeHeroPhoto';
import { portfolioImageUrl } from '../lib/portfolioImageUrl';
import { getApiUserScope } from '../lib/apiFetch';
import {
  fetchAestheticProfile,
  fetchPortfolio,
  fetchPortfolioStats,
  fetchPortfolioTrends,
} from '../services/memoryClient';
import { useAuth } from '../auth/useAuth';
import { analyzePhoto } from '../services/agentClient';
import { fetchAssignments } from '../services/practiceClient';
import { fetchJourney } from '../services/journeyClient';
import { FEATURES } from '../config/features';
import type { AppTab } from '../config/navConfig';
import type { AnalysisResult } from '../types';
import type { Assignment, AssignmentsResponse, UserMode } from '../types/practice';
import type {
  AestheticProfileSummary,
  PortfolioListItem,
  PortfolioStats,
  PortfolioTrendsResponse,
} from '../types/memory';
import type { JourneyResponse } from '../services/journeyClient';

interface Props {
  mode: UserMode;
  activeAssignment: Assignment | null;
  /** Demo / shared library scope (no signed-in user). */
  useDemoLibrary?: boolean;
  onNavigate: (tab: AppTab) => void;
  onOpenSettings: () => void;
  onOpenProof?: () => void;
  /** Open a specific photo in My Work (memory thread, contact sheet). */
  onOpenPhoto?: (photoId: string) => void;
  onAnalysisComplete?: (result: AnalysisResult, imageUrl: string, filename: string) => void;
  /** Incremented when portfolio changes (e.g. My Work upload) to refresh hero/journey. */
  portfolioRefreshKey?: number;
  /** True when Home tab is visible — refetch when returning after uploads elsewhere. */
  isActive?: boolean;
}

const PRACTICE_WIN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Module-level Home snapshot (scoped by user). Survives tab switches when
 * Home stays mounted (hidden) and also covers remount fallback. Fresh loads
 * replace it; `fetchedAt` drives TTL skip so returning within ~60s does not
 * re-hit the portfolio/journey stack.
 */
/** Skip background revalidation when returning to a still-fresh Home. */
const HOME_CACHE_TTL_MS = 60_000;

interface HomeSnapshot {
  stats: PortfolioStats | null;
  heroFallbackPool: PortfolioListItem[];
  bestPhoto: PortfolioListItem | null;
  earliestPhoto: PortfolioListItem | null;
  memoryLaneSource: PortfolioListItem[];
  contactSheet: PortfolioListItem[];
  profile: AestheticProfileSummary | null;
  trends: PortfolioTrendsResponse | null;
  journey: JourneyResponse | null;
  portfolioTotal: number;
  latestPracticeWin: Assignment | null;
  recentCompletedAssignment: Assignment | null;
  practiceWinPhoto: PortfolioListItem | null;
  completedAssignmentCount: number;
  heroSrc: string | null;
  fetchedAt: number;
}

const homeSnapshotCache = new Map<string, HomeSnapshot>();

function homeScopeKey(): string {
  return getApiUserScope() ?? 'anon';
}

function pickLatestPracticeWin(completed: Assignment[]): Assignment | null {
  const cutoff = Date.now() - PRACTICE_WIN_WINDOW_MS;
  for (const a of completed) {
    if (!a.completedAt || a.skillDelta == null || a.skillDelta.delta <= 0) continue;
    if (new Date(a.completedAt).getTime() < cutoff) continue;
    return a;
  }
  return null;
}

function pickMostRecentCompleted(completed: Assignment[]): Assignment | null {
  return (
    [...completed]
      .filter((a) => a.completedAt)
      .sort(
        (a, b) =>
          new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
      )[0] ?? null
  );
}

/** First clause of a practice brief — fits the At a glance card. */
function shortAssignmentBrief(brief: string, maxLen = 58): string {
  const first = brief.split(/[:•]/)[0].trim();
  if (first.length <= maxLen) return first;
  return `${first.slice(0, maxLen - 1).trimEnd()}…`;
}

interface ReturningPhotoHeroProps {
  heroPhoto: PortfolioListItem;
  heroSrc: string | null;
  heroImageReady: boolean;
  imageError: boolean;
  animatedScore: number;
  portfolioTotal: number;
  stats: PortfolioStats | null;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onNavigate: (tab: AppTab) => void;
  mentorCaption: HeroMentorCaption;
  compact?: boolean;
}

function ReturningPhotoHero({
  heroPhoto,
  heroSrc,
  heroImageReady,
  imageError,
  animatedScore,
  portfolioTotal,
  stats,
  uploading,
  fileInputRef,
  onNavigate,
  mentorCaption,
  compact = false,
}: ReturningPhotoHeroProps) {
  return (
    <div
      data-testid="home-mentor-hero"
      className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)] overflow-hidden bg-photo-black -mx-3 md:-mx-6 rounded-none md:rounded-2xl md:mx-0 border border-warm/40 md:border-warm/60 ${
        compact ? 'max-w-4xl mx-auto opacity-95' : ''
      }`}
    >
      <div
        className={`relative aspect-[5/4] sm:aspect-[16/10] lg:aspect-auto ${
          compact ? 'lg:min-h-[320px]' : 'lg:min-h-[440px]'
        }`}
      >
        {imageError && !heroSrc ? (
          <div className="absolute inset-0 bg-surface-2 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <ImageIcon className="w-12 h-12 text-stone-600" />
            <p className="text-sm text-muted max-w-xs">
              Couldn&apos;t load this preview — your library is still here. Upload or open My Work.
            </p>
          </div>
        ) : (
          <>
            {heroSrc && (
              <img
                src={heroSrc}
                alt={heroPhoto.sceneDescription || 'A frame from your library'}
                className="absolute inset-0 w-full h-full object-cover object-[center_42%]"
              />
            )}
            {!heroSrc && (
              <div className="absolute inset-0 bg-surface-2 animate-pulse flex items-center justify-center z-10">
                <ImageIcon className="w-12 h-12 text-stone-600" />
              </div>
            )}
          </>
        )}

        {heroImageReady && (
          <div className="lg:hidden absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500 shadow-lg score-badge">
            <span className="text-xl font-bold text-on-brand tabular-nums font-serif">
              {animatedScore.toFixed(1)}
            </span>
            <span className="text-[10px] font-semibold text-on-brand/70">/ 10</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 p-5 md:p-6 lg:p-8 bg-surface-1 border-t lg:border-t-0 lg:border-l border-warm/50">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <Eyebrow tone="faint" className="tracking-[0.2em]">
              {mentorCaption.eyebrow}
            </Eyebrow>
            {heroImageReady && (
              <div className="hidden lg:flex items-baseline gap-1 shrink-0">
                <span className="text-4xl font-bold text-brand-400 tabular-nums font-serif leading-none">
                  {animatedScore.toFixed(1)}
                </span>
                <span className="text-sm text-stone-500">/ 10</span>
              </div>
            )}
          </div>

          <p className="font-serif text-lg md:text-xl text-white leading-snug">
            {mentorCaption.headline}
          </p>

          {mentorCaption.focusLine && (
            <p className="text-sm text-brand-400/90 leading-relaxed">{mentorCaption.focusLine}</p>
          )}

          {mentorCaption.latestLine && (
            <p className="text-sm text-stone-400 leading-relaxed border-l-2 border-brand-500/40 pl-3">
              {mentorCaption.latestLine}
            </p>
          )}

          {heroPhoto.sceneDescription && (
            <p className="hidden md:block text-xs text-stone-500 leading-relaxed line-clamp-2">
              Shown: {heroPhoto.sceneDescription}
            </p>
          )}

          <p className="text-xs text-stone-500">
            {portfolioTotal} photo{portfolioTotal === 1 ? '' : 's'}
            {stats?.firstUpload ? ` · Member since ${stats.firstUpload}` : ''}
          </p>
        </div>

        {heroPhoto.aestheticTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {heroPhoto.aestheticTags.slice(0, 4).map((tag) => (
              <Tag key={tag} variant="outline">
                {formatTagLabel(tag)}
              </Tag>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 mt-auto pt-2">
          <Button
            icon={<Upload className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            fullWidth
          >
            Upload photo
          </Button>
          {FEATURES.practice && (
            <Button
              variant="secondary"
              iconRight={<ArrowRight className="w-4 h-4" />}
              onClick={() => onNavigate('practice')}
              fullWidth
            >
              Practice →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const EXAMPLE_PHOTO = {
  url: 'https://picsum.photos/seed/iris-home-hero/1200/800',
  sceneDescription: 'Golden hour light on rocky foreground with long shadows across the frame.',
  overallAverage: 7.4,
  glassBoxSummary:
    'Strong diagonal leading lines draw the eye through the frame. The golden hour light creates depth, though shadow detail could be lifted in the foreground rocks.',
};

const CAPABILITIES: ReadonlyArray<{
  title: string;
  desc: string;
  /** Feature flag gating this capability — flag-off features must not be
   * advertised on the first-visit screen (they don't exist in this build). */
  flag?: keyof typeof FEATURES;
}> = [
  { title: 'Glass Box Critique', desc: 'Five dimensions scored with visible reasoning' },
  { title: 'Practice Assignments', desc: 'Targeted challenges that build your weakest skills', flag: 'practice' },
  { title: 'Mentor Chat', desc: 'Portfolio-aware conversation with memory' },
  { title: 'Organize & Tag', desc: 'AI-suggested tags, duplicate detection, your approval', flag: 'triage' },
];

const VISIBLE_CAPABILITIES = CAPABILITIES.filter((cap) => !cap.flag || FEATURES[cap.flag]);

const EMPTY_ASSIGNMENTS: AssignmentsResponse = { proposed: [], active: [], completed: [] };

function mentorInsightText(
  profile: AestheticProfileSummary,
  trendDelta: number | null,
  trendLabel: string | null,
  mode: UserMode,
): string {
  if (profile.dominantTags.length > 0) {
    const tags = profile.dominantTags
      .slice(0, 2)
      .join(' and ')
      .replace(/_/g, ' ');
    const trend =
      trendDelta != null && trendDelta > 0 && trendLabel
        ? ` Your ${trendLabel.toLowerCase()} has improved +${trendDelta.toFixed(1)} recently.`
        : '';
    if (mode === 'working_pro') {
      return `Your portfolio leans toward ${tags} — I track that for consistency across client work.${trend}`;
    }
    return `I notice you're drawn to ${tags} work.${trend}`;
  }
  return mode === 'working_pro'
    ? 'Keep building the portfolio — I track consistency and repeatable strengths across shoots.'
    : "Keep uploading — I'll help you see patterns across your shoots.";
}

export const HomeTab: React.FC<Props> = ({
  mode,
  activeAssignment,
  useDemoLibrary = false,
  onNavigate,
  onOpenProof,
  onOpenPhoto,
  onAnalysisComplete,
  portfolioRefreshKey = 0,
  isActive = true,
}) => {
  // Hydrate synchronously from the last successful load for this user scope
  // (see homeSnapshotCache) so a remount on Back paints the real page, not the
  // skeleton. Read once at mount — a fresh fetch still runs to revalidate.
  const cachedSnapshot = useRef<HomeSnapshot | undefined>(
    homeSnapshotCache.get(homeScopeKey()),
  ).current;

  const [stats, setStats] = useState<PortfolioStats | null>(cachedSnapshot?.stats ?? null);
  const [bestPhoto, setBestPhoto] = useState<PortfolioListItem | null>(cachedSnapshot?.bestPhoto ?? null);
  const [heroFallbackPool, setHeroFallbackPool] = useState<PortfolioListItem[]>(cachedSnapshot?.heroFallbackPool ?? []);
  const [earliestPhoto, setEarliestPhoto] = useState<PortfolioListItem | null>(cachedSnapshot?.earliestPhoto ?? null);
  const [memoryLaneSource, setMemoryLaneSource] = useState<PortfolioListItem[]>(cachedSnapshot?.memoryLaneSource ?? []);
  const [contactSheet, setContactSheet] = useState<PortfolioListItem[]>(cachedSnapshot?.contactSheet ?? []);
  const [profile, setProfile] = useState<AestheticProfileSummary | null>(cachedSnapshot?.profile ?? null);
  const [trends, setTrends] = useState<PortfolioTrendsResponse | null>(cachedSnapshot?.trends ?? null);
  const [journey, setJourney] = useState<JourneyResponse | null>(cachedSnapshot?.journey ?? null);
  const [portfolioTotal, setPortfolioTotal] = useState(cachedSnapshot?.portfolioTotal ?? 0);
  const [loading, setLoading] = useState(!cachedSnapshot);
  const [loadError, setLoadError] = useState<string | null>(null);
  const auth = useAuth();
  const [heroSrc, setHeroSrc] = useState<string | null>(cachedSnapshot?.heroSrc ?? null);
  const [imageError, setImageError] = useState(false);
  const prevHeroIdRef = useRef<string | null>(cachedSnapshot?.bestPhoto?.id ?? null);
  const heroSrcRef = useRef<string | null>(null);
  heroSrcRef.current = heroSrc;
  const [uploading, setUploading] = useState(false);
  const [analyzingImageUrl, setAnalyzingImageUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analyzeWaitSec, setAnalyzeWaitSec] = useState(0);
  const [latestPracticeWin, setLatestPracticeWin] = useState<Assignment | null>(cachedSnapshot?.latestPracticeWin ?? null);
  const [recentCompletedAssignment, setRecentCompletedAssignment] = useState<Assignment | null>(cachedSnapshot?.recentCompletedAssignment ?? null);
  const [practiceWinPhoto, setPracticeWinPhoto] = useState<PortfolioListItem | null>(cachedSnapshot?.practiceWinPhoto ?? null);
  const [completedAssignmentCount, setCompletedAssignmentCount] = useState(cachedSnapshot?.completedAssignmentCount ?? 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exampleGlassBoxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // A cached snapshot counts as an initial load already done, so revalidation
  // after Back refreshes silently instead of flashing the skeleton.
  const initialLoadDone = useRef(cachedSnapshot != null);
  const lastPortfolioKey = useRef(portfolioRefreshKey);

  const load = useCallback(async () => {
    // Show skeleton only on the very first load; subsequent calls (e.g. auth
    // userId stabilising after Firebase init, or revalidating a cached
    // snapshot) refresh silently so the hero doesn't flash away.
    const isInitial = !initialLoadDone.current;
    if (isInitial) setLoading(true);
    setLoadError(null);
    try {
      const [portfolioStats, recentPhotos, topByScore, oldestPortfolio, aesthetic, trendData, assignments, journeyData] =
        await Promise.all([
        fetchPortfolioStats(),
        fetchPortfolio({ limit: 10, sortBy: 'date', sortOrder: 'desc' }),
        fetchPortfolio({ limit: 24, sortBy: 'score', sortOrder: 'desc' }),
        fetchPortfolio({ limit: 5, sortOrder: 'asc' }).catch(() => ({ entries: [], total: 0 })),
        fetchAestheticProfile().catch(() => null),
        fetchPortfolioTrends(6).catch(() => null),
        // With practice off there is no /api/v1/assignments route — skip the
        // guaranteed-404 fetch entirely and use the empty default directly.
        FEATURES.practice
          ? fetchAssignments().catch(() => EMPTY_ASSIGNMENTS)
          : Promise.resolve(EMPTY_ASSIGNMENTS),
        fetchJourney().catch(() => null),
      ]);

      setStats(portfolioStats);
      const heroPool = topByScore.entries.filter((e) => e.imageUrl?.trim() && e.overallAverage > 0);
      setHeroFallbackPool(heroPool);
      const hero = pickHomeHeroPhoto(portfolioStats.strongest, heroPool);
      setBestPhoto(hero);
      setPortfolioTotal(portfolioStats.total);
      setContactSheet(recentPhotos.entries);
      setProfile(aesthetic);
      setTrends(trendData);
      // Journey's summary sentence is a live LLM call (~5-10s) — the
      // slowest thing in this Promise.all by a wide margin. In dev,
      // StrictMode's double-invoke means load() actually runs twice per
      // mount; if the second run's journey fetch loses the race (aborted,
      // or the model is briefly slower) it must not blank out a summary
      // the first run already fetched successfully — keep the last
      // non-null result rather than the last result.
      // Keep the last non-null journey (see comment above); resolve the value
      // we actually settle on so the cache snapshot matches on-screen state.
      const scope = homeScopeKey();
      const resolvedJourney = journeyData ?? homeSnapshotCache.get(scope)?.journey ?? null;
      setJourney((prev) => journeyData ?? prev);
      const win = pickLatestPracticeWin(assignments.completed);
      setLatestPracticeWin(win);
      const recentCompleted = pickMostRecentCompleted(assignments.completed);
      setRecentCompletedAssignment(recentCompleted);
      setCompletedAssignmentCount(assignments.completed.length);

      let winPhoto: PortfolioListItem | null = null;
      if (win?.completionShootIds?.length) {
        const shootId = win.completionShootIds[0];
        const match = recentPhotos.entries.find((e) => e.shootId === shootId);
        if (match) {
          winPhoto = match;
        } else {
          const more = await fetchPortfolio({ limit: 80, sortBy: 'date', sortOrder: 'desc' }).catch(
            () => ({ entries: [], total: 0 }),
          );
          winPhoto = more.entries.find((e) => e.shootId === shootId) ?? null;
        }
      }
      setPracticeWinPhoto(winPhoto);

      const validOldest = oldestPortfolio.entries.find(
        (e) => e.imageUrl && e.overallAverage > 0,
      );
      setEarliestPhoto(validOldest ?? null);

      const poolById = new Map<string, PortfolioListItem>();
      for (const e of [...oldestPortfolio.entries, ...recentPhotos.entries, ...topByScore.entries]) {
        if (e?.id && e.imageUrl?.trim()) poolById.set(e.id, e);
      }
      const laneSource = [...poolById.values()].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMemoryLaneSource(laneSource);

      // Persist a snapshot so the next remount (Back to Home) hydrates
      // instantly. heroSrc is patched separately once the image preloads.
      homeSnapshotCache.set(scope, {
        stats: portfolioStats,
        heroFallbackPool: heroPool,
        bestPhoto: hero,
        earliestPhoto: validOldest ?? null,
        memoryLaneSource: laneSource,
        contactSheet: recentPhotos.entries,
        profile: aesthetic,
        trends: trendData,
        journey: resolvedJourney,
        portfolioTotal: portfolioStats.total,
        latestPracticeWin: win,
        recentCompletedAssignment: recentCompleted,
        practiceWinPhoto: winPhoto,
        completedAssignmentCount: assignments.completed.length,
        heroSrc: homeSnapshotCache.get(scope)?.heroSrc ?? null,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Could not load your library. Check your connection and try again.',
      );
    } finally {
      initialLoadDone.current = true;
      setLoading(false);
    }
  }, [auth.userId, useDemoLibrary]);

  useEffect(() => {
    if (auth.loading || !isActive) return;
    const snap = homeSnapshotCache.get(homeScopeKey());
    // Skip revalidation when returning to Home with a still-fresh snapshot
    // and no explicit portfolio bump (upload elsewhere). portfolioRefreshKey
    // always forces load.
    if (
      snap &&
      portfolioRefreshKey === lastPortfolioKey.current &&
      Date.now() - (snap.fetchedAt ?? 0) < HOME_CACHE_TTL_MS
    ) {
      return;
    }
    lastPortfolioKey.current = portfolioRefreshKey;
    void load();
  }, [auth.loading, load, portfolioRefreshKey, isActive]);

  // Once the hero image URL resolves, patch it into the cached snapshot so a
  // remount rehydrates the exact frame (the preload effect then short-circuits
  // via `url === heroSrcRef.current` and never blanks it).
  useEffect(() => {
    const snap = homeSnapshotCache.get(homeScopeKey());
    if (snap) snap.heroSrc = heroSrc;
  }, [heroSrc]);

  useEffect(() => {
    if (!uploading) {
      setAnalyzeWaitSec(0);
      return;
    }
    const tick = window.setInterval(() => setAnalyzeWaitSec((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, [uploading]);

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (analyzingImageUrl) URL.revokeObjectURL(analyzingImageUrl);
    setAnalyzingImageUrl(null);
    setUploading(false);
  }, [analyzingImageUrl]);

  const scrollToDemoCritique = useCallback(() => {
    exampleGlassBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    exampleGlassBoxRef.current?.focus();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setUploading(true);
    setAnalyzingImageUrl(previewUrl);
    setUploadError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await analyzePhoto({
        imageFile: file,
        assignmentId: activeAssignment?.id,
        signal: controller.signal,
      });
      onAnalysisComplete?.(result, previewUrl, file.name);
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      setAnalyzingImageUrl(null);
      if (err instanceof Error && err.name === 'AbortError') {
        setUploadError('Analysis cancelled.');
      } else {
        setUploadError(friendlyErrorMessage(err));
      }
    } finally {
      abortRef.current = null;
      setUploading(false);
      setAnalyzingImageUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isFirstVisit = !loading && !loadError && portfolioTotal === 0;
  const hasLibrary = !loading && !loadError && portfolioTotal > 0;
  const heroCandidate = bestPhoto ?? contactSheet[0] ?? null;
  const isReturning = hasLibrary && heroCandidate != null;
  const heroPhoto = isReturning ? heroCandidate : null;
  const heroScore = heroPhoto?.overallAverage ?? EXAMPLE_PHOTO.overallAverage;
  const heroImageReady = heroSrc != null;
  const animatedScore = useCountUp(heroScore, 900, heroImageReady);

  /** Prefer current-focus or overall trend when the best raw delta belongs to a
   *  skill already cleared — avoids "Composition 8.0 → 8.6" right after the
   *  mentor stopped coaching composition. */
  const bestTrend = useMemo(() => {
    const dims =
      trends?.dimensions?.filter(
        (d) => d.delta != null && d.delta > 0 && ['composition', 'lighting', 'overall'].includes(d.key),
      ) ?? [];
    if (dims.length === 0) return undefined;

    const clearedKeys = new Set(
      journey?.skills?.filter((s) => s.status === 'cleared').map((s) => s.name) ?? [],
    );
    const focus = currentFocusFromJourney(journey?.skills);
    if (focus) {
      const focusTrend = dims.find((d) => d.key === focus.name);
      if (focusTrend) return focusTrend;
    }
    return dims.find((d) => d.key === 'overall' || !clearedKeys.has(d.key)) ?? dims[0];
  }, [trends, journey]);
  const trendDelta = bestTrend?.delta ?? null;
  const trendLabel = bestTrend?.label ?? null;

  /** Before → now framing for the trend card: the same older-half / newer-half
   * split compute_delta (app/memory_engine.py) uses, so "6.8 → 7.4" is exactly
   * the pair whose difference is the delta. Null when the series is too short
   * for the backend to have produced a delta at all. */
  const trendBeforeNow = (() => {
    const values = bestTrend?.values;
    if (!values || values.length < 4 || trendDelta == null) return null;
    const mid = Math.floor(values.length / 2);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return { before: avg(values.slice(0, mid)), now: avg(values.slice(mid)) };
  })();

  /** What the trend delta actually compares, in human terms: compute_delta
   * (backend) is the newer half of the recent-uploads window minus the older
   * half — say so instead of showing a bare "+0.6". Null below 4 points,
   * where the backend returns no delta anyway. */
  const trendComparisonNote = (() => {
    const n = trends?.points.length ?? 0;
    if (n < 4) return null;
    const older = Math.floor(n / 2);
    return `avg of your last ${n - older} uploads vs the ${older} before`;
  })();

  const mentorThreshold = useDemoLibrary ? 1 : 3;
  const showMentorCard = Boolean(profile && portfolioTotal >= mentorThreshold);

  const GROWTH_MIN_PHOTOS = 6;
  const showGrowth =
    isReturning &&
    portfolioTotal >= GROWTH_MIN_PHOTOS &&
    earliestPhoto &&
    bestPhoto &&
    earliestPhoto.id !== bestPhoto.id;

  /** Delta between the two frames shown in Then/Now (not the portfolio trend series). */
  const growthFrameOverallDelta = bestPhoto && earliestPhoto
    ? bestPhoto.overallAverage - earliestPhoto.overallAverage
    : null;
  const growthFrameCompositionDelta =
    bestPhoto && earliestPhoto
      ? bestPhoto.scores.composition - earliestPhoto.scores.composition
      : null;

  const avgLibraryScore = (() => {
    const scores = profile?.averageScores;
    if (!scores) return null;
    const keys = ['composition', 'lighting', 'technique', 'creativity', 'subject_impact'] as const;
    const vals = keys.map((k) => scores[k]).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();

  const showMemoryProofCard = !FEATURES.practice && Boolean(journey);

  const latestUpload = contactSheet[0] ?? null;
  const mentorCaption = useMemo(
    () =>
      buildHeroMentorCaption({
        identity: journey?.identity,
        skills: journey?.skills,
        latestUpload,
        portfolioTotal,
      }),
    [journey?.identity, journey?.skills, latestUpload, portfolioTotal],
  );

  const genreThreads = useMemo(
    () => buildGenreThreads(memoryLaneSource),
    [memoryLaneSource],
  );
  const showMemoryThreads = genreThreads.length > 0;

  // Preload hero image; keep the current frame visible when only the signed URL
  // refreshes on a background refetch (auth scope stabilising, etc.).
  useEffect(() => {
    const heroId = heroPhoto?.id ?? null;
    const url = portfolioImageUrl(heroPhoto?.imageUrl) || null;

    if (!heroId || !url) {
      prevHeroIdRef.current = null;
      setHeroSrc(null);
      setImageError(false);
      return;
    }

    if (heroId !== prevHeroIdRef.current) {
      prevHeroIdRef.current = heroId;
      setHeroSrc(null);
      setImageError(false);
    }

    if (url === heroSrcRef.current) return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setHeroSrc(url);
        setImageError(false);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setHeroSrc((prev) => {
          if (prev) return prev;
          const currentIdx = heroFallbackPool.findIndex((p) => p.id === heroId);
          const next = currentIdx >= 0 ? heroFallbackPool[currentIdx + 1] : null;
          if (next?.imageUrl) {
            setBestPhoto(next);
            setImageError(false);
            return prev;
          }
          setImageError(true);
          return prev;
        });
      }
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [heroPhoto?.id, heroPhoto?.imageUrl, heroFallbackPool]);

  useEffect(() => {
    if (heroSrc || imageError || !heroPhoto?.imageUrl) return;
    const timeout = window.setTimeout(() => setImageError(true), 8000);
    return () => window.clearTimeout(timeout);
  }, [heroPhoto?.imageUrl, heroSrc, imageError, heroPhoto]);

  return (
    <>
      {isReturning && contactSheet.length > 0 && (
        <LibraryBackdrop
          photos={contactSheet.map((p) => ({ id: p.id, imageUrl: portfolioImageUrl(p.imageUrl) }))}
        />
      )}

      {uploading && analyzingImageUrl && (
        <AnalyzingOverlay
          imageUrl={analyzingImageUrl}
          waitSec={analyzeWaitSec}
          onCancel={cancelUpload}
        />
      )}

      <div
        className={`relative z-10 pb-8 ${isReturning ? 'space-y-5 md:space-y-6' : 'space-y-10'}`}
      >
        {uploadError && (
          <InlineAlertBanner message={uploadError} onDismiss={() => setUploadError(null)} />
        )}

        {loadError && (
          <div className="max-w-4xl mx-auto space-y-3">
            <InlineAlertBanner message={loadError} variant="error" />
            <Button onClick={() => void load()}>Retry loading library</Button>
          </div>
        )}

        {loading && (
          <div className="max-w-4xl mx-auto space-y-5 animate-pulse" aria-busy="true" aria-label="Loading your library">
            <div className="h-[min(50vh,520px)] min-h-[280px] rounded-2xl bg-surface-2 border border-warm" />
            <div className="grid sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-surface-2 border border-warm" />
              ))}
            </div>
            <p className="text-center text-sm text-stone-500">
              Loading portfolio from MongoDB… this can take a few seconds on cold start.
            </p>
          </div>
        )}

        {isFirstVisit && (
          <div className="bg-gradient-to-b from-surface-2 to-canvas rounded-2xl p-8 md:p-12 border border-warm">
            <h1 className="font-serif text-3xl md:text-4xl text-white mb-4 leading-tight">
              Upload one photo.
              <br />
              Get a critique that remembers.
            </h1>
            <p className="text-stone-400 text-base md:text-lg mb-6 max-w-xl">
              I explain what worked, what to practice next, and remember the pattern so future
              critiques adapt to you.
            </p>
            <ol className="text-sm text-stone-400 mb-8 max-w-xl space-y-2 list-decimal list-inside">
              <li>Critique this photo</li>
              <li>Remember the lesson</li>
              <li>Name your current focus</li>
              <li>Adapt the next critique</li>
            </ol>
            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                icon={<Upload className="w-5 h-5" />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                Upload your first photo
              </Button>
              <Button variant="ghost" size="lg" onClick={scrollToDemoCritique}>
                See demo critique
              </Button>
            </div>
          </div>
        )}

        {hasLibrary && !isReturning && (
          <div className="max-w-4xl mx-auto space-y-4 text-center py-12">
            <p className="text-stone-400 text-sm">
              {portfolioTotal} photo{portfolioTotal === 1 ? '' : 's'} in your library — open My Work to browse.
            </p>
            <Button onClick={() => onNavigate('work')}>Open My Work</Button>
          </div>
        )}

        {isReturning && heroPhoto && (
          <ReturningPhotoHero
            heroPhoto={heroPhoto}
            heroSrc={heroSrc}
            heroImageReady={heroImageReady}
            imageError={imageError}
            animatedScore={animatedScore}
            portfolioTotal={portfolioTotal}
            stats={stats}
            uploading={uploading}
            fileInputRef={fileInputRef}
            onNavigate={onNavigate}
            mentorCaption={mentorCaption}
          />
        )}

        {isReturning && showMemoryThreads && (
          <MemoryThreads
            photos={memoryLaneSource}
            onOpenPhoto={(photoId) => onOpenPhoto?.(photoId)}
          />
        )}

        {isReturning && !showMemoryThreads && (
          <ContactSheet
            variant="heroFallback"
            photos={contactSheet}
            loading={loading}
            uploading={uploading}
            onOpenPhoto={(photoId) => onOpenPhoto?.(photoId)}
            onNavigateLibrary={() => onNavigate('work')}
            onUpload={() => fileInputRef.current?.click()}
          />
        )}

        {isReturning && journey && (
          <JourneySection
            summary={journey.summary}
            skills={journey.skills}
            stats={journey.stats}
            displayName={journey.displayName ?? null}
            mode={mode}
          />
        )}

        {isReturning && showMemoryThreads && (
          <ContactSheet
            photos={contactSheet}
            loading={loading}
            uploading={uploading}
            onOpenPhoto={(photoId) => onOpenPhoto?.(photoId)}
            onNavigateLibrary={() => onNavigate('work')}
            onUpload={() => fileInputRef.current?.click()}
          />
        )}

        {/* First visit: example Glass Box */}
        {isFirstVisit && (
          <Card
            ref={exampleGlassBoxRef}
            tabIndex={-1}
            padding="lg"
            className="max-w-4xl mx-auto focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <Eyebrow className="mb-4">What this becomes after a few uploads</Eyebrow>
            <div className="flex flex-col md:flex-row gap-6">
              <img
                src={EXAMPLE_PHOTO.url}
                alt={EXAMPLE_PHOTO.sceneDescription}
                className="w-full md:w-64 h-48 object-cover rounded-lg"
              />
              <div className="flex-1">
                <p className="text-stone-300 text-sm leading-relaxed mb-4">
                  {EXAMPLE_PHOTO.glassBoxSummary}
                </p>
                <div className="flex gap-2">
                  <Tag variant="brand" className="tabular-nums">Composition 8.2</Tag>
                  <Tag variant="brand" className="tabular-nums">Lighting 7.8</Tag>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* First visit: capabilities grid */}
        {isFirstVisit && (
          <section className="max-w-4xl mx-auto">
            <h2 className="font-serif text-2xl text-white mb-6">What Engram can do</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {VISIBLE_CAPABILITIES.map((cap) => (
                <Card key={cap.title}>
                  <h3 className="text-white text-sm font-medium mb-1">{cap.title}</h3>
                  <p className="text-stone-400 text-xs">{cap.desc}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* At a glance — below the library roll so the personal read leads */}
        {isReturning && !loading && (
          <div className="max-w-4xl mx-auto px-1 space-y-2">
            <Eyebrow>At a glance</Eyebrow>
            <div className="grid sm:grid-cols-3 gap-4">
              <StatCard
                icon={<BarChart3 className="w-5 h-5" />}
                label="Avg score"
                value={avgLibraryScore != null ? avgLibraryScore.toFixed(1) : '—'}
                unit={avgLibraryScore != null ? '/ 10' : undefined}
                note={
                  avgLibraryScore != null
                    ? // 20 mirrors the server's window: aesthetic_profile uses
                      // .limit(20) in app/server.py — keep the two in sync.
                      portfolioTotal <= 20
                      ? `All five skills, averaged across your ${portfolioTotal} photos`
                      : 'All five skills, averaged across your last 20 photos'
                    : 'Upload more to see averages'
                }
              />

              <Card padding="sm" className="bg-surface-1/80">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 mt-0.5 p-2 rounded-md bg-surface-2 text-brand-400 inline-flex">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Eyebrow tone="faint" className="mb-1">Recent trend</Eyebrow>
                    {trendDelta != null && trendLabel ? (
                      <>
                        <p className="text-sm font-serif text-white">
                          {trendBeforeNow
                            ? `${trendLabel}: ${trendBeforeNow.before.toFixed(1)} → ${trendBeforeNow.now.toFixed(1)}`
                            : `${trendLabel} up +${trendDelta.toFixed(1)} pts`}
                        </p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          Out of 10 · {trendComparisonNote ?? 'vs your earlier uploads'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-serif text-white">
                          {portfolioTotal} photos in your library
                        </p>
                        <p className="text-xs text-stone-400 mt-0.5">Upload a few more to see score trends</p>
                      </>
                    )}
                    {trends && trends.points.length >= 2 && !trends.insufficientData && (
                      <div className="mt-2">
                        <div className="h-8">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trends.points}>
                              <Line
                                type="monotone"
                                dataKey="overall"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-stone-500 mt-1">
                          Overall score · your last {trends.points.length} uploads
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {showMemoryProofCard ? (
                <StatCard
                  icon={<Database className="w-5 h-5" />}
                  label="Memory proof"
                  value={journey!.stats.skills_cleared}
                  unit={journey!.stats.skills_cleared === 1 ? 'skill cleared' : 'skills cleared'}
                  note={`${journey!.stats.live_memories} live · ${journey!.stats.superseded_memories} retired`}
                  action={
                    onOpenProof ? (
                      <Button variant="subtle" size="sm" onClick={onOpenProof}>
                        See proof →
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <StatCard
                  icon={<Award className="w-5 h-5" />}
                  label="Assignments done"
                  value={
                    completedAssignmentCount === 0
                      ? FEATURES.practice
                        ? 'Accept your first challenge in Practice →'
                        : 'Coming soon'
                      : completedAssignmentCount
                  }
                  detail={
                    completedAssignmentCount > 0 &&
                    (activeAssignment ?? recentCompletedAssignment)
                      ? shortAssignmentBrief((activeAssignment ?? recentCompletedAssignment)!.brief)
                      : undefined
                  }
                  note={
                    activeAssignment
                      ? 'Active practice brief'
                      : completedAssignmentCount > 0
                        ? 'Completed practice briefs'
                        : undefined
                  }
                  action={
                    FEATURES.practice ? (
                      <Button variant="subtle" size="sm" onClick={() => onNavigate('practice')}>
                        Practice →
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </div>
          </div>
        )}

        {isReturning && showMentorCard && profile && (
          <Card padding="sm" className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <Eyebrow tone="faint" className="mb-1">From your mentor</Eyebrow>
              <p className="text-stone-300 text-sm leading-relaxed font-serif line-clamp-2">
                {mentorInsightText(profile, trendDelta, trendLabel, mode)}
              </p>
            </div>
            <Button
              size="sm"
              iconRight={<ArrowRight className="w-4 h-4" />}
              onClick={() => onNavigate('mentor')}
            >
              Ask mentor
            </Button>
          </Card>
        )}

        {isReturning && latestPracticeWin?.skillDelta && (
          <Card padding="sm" className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4">
            {practiceWinPhoto?.imageUrl ? (
              <PhotoMat variant="contact" aspect="aspect-square" className="w-20 shrink-0">
                <img
                  src={practiceWinPhoto.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </PhotoMat>
            ) : (
              <div
                className="w-20 h-20 shrink-0 rounded-lg bg-surface-2 border border-warm flex items-center justify-center"
                aria-hidden
              >
                <Award className="w-8 h-8 text-stone-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Eyebrow tone="brand" className="mb-1">Practice win</Eyebrow>
              <p className="text-sm font-serif text-white">
                {formatSkillLabel(latestPracticeWin.targetSkill)} +{latestPracticeWin.skillDelta.delta.toFixed(1)} pts
              </p>
              <p className="text-xs text-stone-400 mt-0.5 line-clamp-2">{latestPracticeWin.brief}</p>
              {latestPracticeWin.appliedBrief != null && (
                <p className="text-xs text-stone-400 mt-1">
                  Brief {latestPracticeWin.appliedBrief ? 'applied' : 'not yet applied'}
                </p>
              )}
            </div>
            <Button variant="subtle" size="sm" onClick={() => onNavigate('practice')}>
              Practice →
            </Button>
          </Card>
        )}

        {/* Growth comparison — below library strip; large comparison last */}
        {showGrowth && (
          <section className="max-w-5xl mx-auto px-1">
            <div className="mb-4">
              <h2 className="font-serif text-xl md:text-2xl text-white mb-1">Your growth</h2>
              <p className="text-stone-400 text-xs md:text-sm">
                Your oldest upload vs highest-scoring photo · {portfolioTotal} photos in library
              </p>
            </div>
            <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-8">
              <div className="flex-1">
                <Eyebrow tone="faint" className="mb-3">Then</Eyebrow>
                <PhotoMat variant="contact" aspect="aspect-[4/3]">
                  <img
                    src={earliestPhoto!.imageUrl}
                    alt="Earlier work"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </PhotoMat>
                <p className="mt-2 text-sm text-stone-400 flex justify-between">
                  <span>Earlier work</span>
                  <span className="text-stone-300 tabular-nums">{earliestPhoto!.overallAverage.toFixed(1)}</span>
                </p>
              </div>
              <div className="hidden md:flex items-center text-brand-400/60">
                <ArrowRight className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <Eyebrow tone="brand" className="mb-3">Now</Eyebrow>
                <PhotoMat variant="contact" aspect="aspect-[4/3]">
                  <img
                    src={bestPhoto!.imageUrl}
                    alt="Strongest work"
                    className="w-full h-full object-cover ring-1 ring-brand-500/40"
                  />
                </PhotoMat>
                <p className="mt-2 text-sm text-stone-400 flex justify-between">
                  <span>Strongest</span>
                  <span className="text-brand-400 font-semibold tabular-nums">
                    {bestPhoto!.overallAverage.toFixed(1)}
                  </span>
                </p>
              </div>
            </div>
            {growthFrameOverallDelta != null && growthFrameOverallDelta > 0 && (
              <p className="text-center mt-4 text-brand-400 font-medium text-sm">
                <TrendingUp className="w-4 h-4 inline mr-1.5" />
                This photo scores +{growthFrameOverallDelta.toFixed(1)} overall vs your first
                upload
                {growthFrameCompositionDelta != null && growthFrameCompositionDelta > 0 && (
                  <span className="text-stone-400 font-normal">
                    {' '}
                    (composition +{growthFrameCompositionDelta.toFixed(1)})
                  </span>
                )}
              </p>
            )}
          </section>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload photo"
      />
    </>
  );
};
