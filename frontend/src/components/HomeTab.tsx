/**
 * HomeTab — Layered homepage: first-visit pitch vs returning personal hero.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  ImageIcon,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { AnalyzingOverlay } from './AnalyzingOverlay';
import { InlineAlertBanner } from './InlineAlertBanner';
import { LibraryBackdrop } from './LibraryBackdrop';
import { PhotoMat } from './PhotoMat';
import { Button, Card, Tag, Eyebrow, StatCard } from './primitives';
import { useCountUp } from '../hooks/useCountUp';
import { formatSkillLabel } from '../lib/formatSkillLabel';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { pickHomeHeroPhoto } from '../lib/pickHomeHeroPhoto';
import {
  fetchAestheticProfile,
  fetchPortfolio,
  fetchPortfolioStats,
  fetchPortfolioTrends,
} from '../services/memoryClient';
import { useAuth } from '../auth/useAuth';
import { analyzePhoto } from '../services/agentClient';
import { fetchAssignments } from '../services/practiceClient';
import type { AppTab } from '../config/navConfig';
import type { AnalysisResult } from '../types';
import type { Assignment, UserMode } from '../types/practice';
import type {
  AestheticProfileSummary,
  PortfolioListItem,
  PortfolioStats,
  PortfolioTrendsResponse,
} from '../types/memory';

interface Props {
  mode: UserMode;
  activeAssignment: Assignment | null;
  /** Demo / shared library scope (no signed-in user). */
  useDemoLibrary?: boolean;
  onNavigate: (tab: AppTab) => void;
  onOpenSettings: () => void;
  onAnalysisComplete?: (result: AnalysisResult, imageUrl: string, filename: string) => void;
}

const PRACTICE_WIN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

const EXAMPLE_PHOTO = {
  url: 'https://picsum.photos/seed/iris-home-hero/1200/800',
  sceneDescription: 'Golden hour light on rocky foreground with long shadows across the frame.',
  overallAverage: 7.4,
  glassBoxSummary:
    'Strong diagonal leading lines draw the eye through the frame. The golden hour light creates depth, though shadow detail could be lifted in the foreground rocks.',
};

const CAPABILITIES = [
  { title: 'Glass Box Critique', desc: 'Five dimensions scored with visible reasoning' },
  { title: 'Practice Assignments', desc: 'Targeted challenges that build your weakest skills' },
  { title: 'Mentor Chat', desc: 'Portfolio-aware conversation with memory' },
  { title: 'Organize & Tag', desc: 'AI-suggested tags, duplicate detection, your approval' },
] as const;

function mentorInsightText(
  profile: AestheticProfileSummary,
  trendDelta: number | null,
  trendLabel: string | null,
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
    return `I notice you're drawn to ${tags} work.${trend}`;
  }
  return "Keep uploading — I'll help you see patterns across your shoots.";
}

export const HomeTab: React.FC<Props> = ({
  activeAssignment,
  useDemoLibrary = false,
  onNavigate,
  onAnalysisComplete,
}) => {
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [bestPhoto, setBestPhoto] = useState<PortfolioListItem | null>(null);
  const [earliestPhoto, setEarliestPhoto] = useState<PortfolioListItem | null>(null);
  const [contactSheet, setContactSheet] = useState<PortfolioListItem[]>([]);
  const [profile, setProfile] = useState<AestheticProfileSummary | null>(null);
  const [trends, setTrends] = useState<PortfolioTrendsResponse | null>(null);
  const [portfolioTotal, setPortfolioTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const auth = useAuth();
  const [heroSrc, setHeroSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const prevHeroIdRef = useRef<string | null>(null);
  const heroSrcRef = useRef<string | null>(null);
  heroSrcRef.current = heroSrc;
  const [uploading, setUploading] = useState(false);
  const [analyzingImageUrl, setAnalyzingImageUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analyzeWaitSec, setAnalyzeWaitSec] = useState(0);
  const [latestPracticeWin, setLatestPracticeWin] = useState<Assignment | null>(null);
  const [recentCompletedAssignment, setRecentCompletedAssignment] = useState<Assignment | null>(null);
  const [practiceWinPhoto, setPracticeWinPhoto] = useState<PortfolioListItem | null>(null);
  const [completedAssignmentCount, setCompletedAssignmentCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exampleGlassBoxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initialLoadDone = useRef(false);

  const load = useCallback(async () => {
    // Show skeleton only on the very first load; subsequent calls (e.g. auth
    // userId stabilising after Firebase init) refresh silently so the hero
    // doesn't flash away.
    const isInitial = !initialLoadDone.current;
    if (isInitial) setLoading(true);
    setLoadError(null);
    try {
      const [portfolioStats, recentPhotos, topByScore, oldestPortfolio, aesthetic, trendData, assignments] =
        await Promise.all([
        fetchPortfolioStats(),
        fetchPortfolio({ limit: 10, sortBy: 'date', sortOrder: 'desc' }),
        fetchPortfolio({ limit: 24, sortBy: 'score', sortOrder: 'desc' }),
        fetchPortfolio({ limit: 5, sortOrder: 'asc' }).catch(() => ({ entries: [], total: 0 })),
        fetchAestheticProfile().catch(() => null),
        fetchPortfolioTrends(6).catch(() => null),
        fetchAssignments().catch(() => ({ proposed: [], active: [], completed: [] })),
      ]);

      setStats(portfolioStats);
      const hero = pickHomeHeroPhoto(portfolioStats.strongest, topByScore.entries);
      setBestPhoto(hero);
      setPortfolioTotal(portfolioStats.total);
      setContactSheet(recentPhotos.entries);
      setProfile(aesthetic);
      setTrends(trendData);
      const win = pickLatestPracticeWin(assignments.completed);
      setLatestPracticeWin(win);
      setRecentCompletedAssignment(pickMostRecentCompleted(assignments.completed));
      setCompletedAssignmentCount(assignments.completed.length);

      if (win?.completionShootIds?.length) {
        const shootId = win.completionShootIds[0];
        const match = recentPhotos.entries.find((e) => e.shootId === shootId);
        if (match) {
          setPracticeWinPhoto(match);
        } else {
          const more = await fetchPortfolio({ limit: 80, sortBy: 'date', sortOrder: 'desc' }).catch(
            () => ({ entries: [], total: 0 }),
          );
          setPracticeWinPhoto(more.entries.find((e) => e.shootId === shootId) ?? null);
        }
      } else {
        setPracticeWinPhoto(null);
      }

      const validOldest = oldestPortfolio.entries.find(
        (e) => e.imageUrl && e.overallAverage > 0,
      );
      setEarliestPhoto(validOldest ?? null);
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
    if (auth.loading) return;
    void load();
  }, [auth.loading, load]);

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
  const isReturning = !loading && !loadError && portfolioTotal > 0 && bestPhoto != null;

  const heroPhoto = isReturning ? bestPhoto! : null;
  const heroScore = heroPhoto?.overallAverage ?? EXAMPLE_PHOTO.overallAverage;
  const heroImageReady = heroSrc != null;
  const animatedScore = useCountUp(heroScore, 900, heroImageReady);

  const bestTrend = trends?.dimensions?.find(
    (d) => d.delta != null && d.delta > 0 && ['composition', 'lighting', 'overall'].includes(d.key),
  );
  const trendDelta = bestTrend?.delta ?? null;
  const trendLabel = bestTrend?.label ?? null;

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

  // Preload hero image; keep the current frame visible when only the signed URL
  // refreshes on a background refetch (auth scope stabilising, etc.).
  useEffect(() => {
    const heroId = heroPhoto?.id ?? null;
    const url = heroPhoto?.imageUrl?.trim() || null;

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
          if (!prev) setImageError(true);
          return prev;
        });
      }
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [heroPhoto?.id, heroPhoto?.imageUrl]);

  useEffect(() => {
    if (heroSrc || imageError || !heroPhoto?.imageUrl) return;
    const timeout = window.setTimeout(() => setImageError(true), 8000);
    return () => window.clearTimeout(timeout);
  }, [heroPhoto?.imageUrl, heroSrc, imageError, heroPhoto]);

  return (
    <>
      {isReturning && contactSheet.length > 0 && (
        <LibraryBackdrop
          photos={contactSheet.map((p) => ({ id: p.id, imageUrl: p.imageUrl }))}
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

        {/* First visit: pitch hero */}
        {isFirstVisit && (
          <div className="bg-gradient-to-b from-surface-2 to-canvas rounded-2xl p-8 md:p-12 border border-warm">
            <h1 className="font-serif text-3xl md:text-4xl text-white mb-4 leading-tight">
              Your AI photography mentor —
              <br />
              that remembers every shot you upload.
            </h1>
            <p className="text-stone-400 text-base md:text-lg mb-8 max-w-xl">
              Glass Box critiques on five dimensions, a private library that grows with you,
              practice assignments, and mentor chat.
            </p>
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

        {/* Returning: split hero — clean photo + editorial panel (magazine layout) */}
        {isReturning && heroPhoto && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)] overflow-hidden bg-photo-black -mx-3 md:-mx-6 rounded-none md:rounded-2xl md:mx-0 border border-warm/40 md:border-warm/60">
            {/* Photo column — no overlays on desktop */}
            <div className="relative aspect-[5/4] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[440px]">
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
                      alt={heroPhoto.sceneDescription || 'Your strongest work'}
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

            {/* Editorial panel */}
            <div className="flex flex-col gap-5 p-5 md:p-6 lg:p-8 bg-surface-1 border-t lg:border-t-0 lg:border-l border-warm/50">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <Eyebrow tone="faint" className="tracking-[0.2em]">Best in your library</Eyebrow>
                  {heroImageReady && (
                    <div className="hidden lg:flex items-baseline gap-1 shrink-0">
                      <span className="text-4xl font-bold text-brand-400 tabular-nums font-serif leading-none">
                        {animatedScore.toFixed(1)}
                      </span>
                      <span className="text-sm text-stone-500">/ 10</span>
                    </div>
                  )}
                </div>

                <p className="font-serif text-lg md:text-xl text-white leading-snug line-clamp-4">
                  {heroPhoto.sceneDescription || 'Your photograph'}
                </p>

                {heroPhoto.glassBoxSummary.length > 0 && (
                  <p className="text-sm text-stone-400 leading-relaxed line-clamp-2 border-l-2 border-brand-500/40 pl-3">
                    {heroPhoto.glassBoxSummary[0]}
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
                    <Tag key={tag} variant="outline">{tag.replace(/_/g, ' ')}</Tag>
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
                <Button
                  variant="secondary"
                  iconRight={<ArrowRight className="w-4 h-4" />}
                  onClick={() => onNavigate('practice')}
                  fullWidth
                >
                  Continue practice
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* First visit: example Glass Box */}
        {isFirstVisit && (
          <Card
            ref={exampleGlassBoxRef}
            tabIndex={-1}
            padding="lg"
            className="max-w-4xl mx-auto focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <Eyebrow className="mb-4">Example Critique</Eyebrow>
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
              {CAPABILITIES.map((cap) => (
                <Card key={cap.title}>
                  <h3 className="text-white text-sm font-medium mb-1">{cap.title}</h3>
                  <p className="text-stone-400 text-xs">{cap.desc}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* At a glance (returning) — above the fold after hero */}
        {isReturning && !loading && (
          <div className="max-w-4xl mx-auto px-1 space-y-2">
            <Eyebrow>At a glance</Eyebrow>
            <div className="grid sm:grid-cols-3 gap-4">
              <StatCard
                icon={<BarChart3 className="w-5 h-5" />}
                label="Avg score"
                value={avgLibraryScore != null ? avgLibraryScore.toFixed(1) : '—'}
                unit={avgLibraryScore != null ? '/ 10' : undefined}
                note={avgLibraryScore != null ? 'Across your recent library' : 'Upload more to see averages'}
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
                          {trendLabel} up +{trendDelta.toFixed(1)} pts
                        </p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          Out of 10 · vs your earlier uploads
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
                        <p className="text-[10px] text-stone-500 mt-1">Overall score · recent uploads</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <StatCard
                icon={<Award className="w-5 h-5" />}
                label="Assignments done"
                value={completedAssignmentCount}
                detail={
                  (activeAssignment ?? recentCompletedAssignment)
                    ? shortAssignmentBrief((activeAssignment ?? recentCompletedAssignment)!.brief)
                    : undefined
                }
                note={
                  activeAssignment
                    ? 'Active practice brief'
                    : completedAssignmentCount === 0
                      ? 'Accept a challenge in Practice'
                      : 'Completed practice briefs'
                }
                action={
                  <Button variant="subtle" size="sm" onClick={() => onNavigate('practice')}>
                    Practice →
                  </Button>
                }
              />
            </div>
          </div>
        )}

        {/* Contact sheet — primary library access, kept high on the page */}
        {isReturning && (
          <section className="max-w-6xl mx-auto px-1">
            <div className="flex items-end justify-between gap-4 mb-3">
              <div>
                <h2 className="font-serif text-xl md:text-2xl text-white">Contact sheet</h2>
                <p className="text-stone-400 text-xs md:text-sm mt-0.5">Recent frames from your library</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  icon={<Upload className="w-4 h-4" />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Upload
                </Button>
                <Button variant="subtle" size="sm" onClick={() => onNavigate('work')}>
                  Library →
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="shrink-0 w-48 h-32 rounded-xl bg-surface-2 animate-pulse" />
                ))}
              </div>
            ) : contactSheet.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
                {contactSheet.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => onNavigate('work')}
                    className="shrink-0 w-44 sm:w-52 snap-start group text-left"
                  >
                    <PhotoMat variant="contact" className="transition-transform duration-300 group-hover:-translate-y-1">
                      <div className="aspect-[4/5] relative">
                        <img
                          src={photo.imageUrl}
                          alt={photo.sceneDescription || 'Photo'}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-brand-500 text-on-brand text-xs font-bold tabular-nums">
                          {photo.overallAverage.toFixed(1)}
                        </span>
                      </div>
                    </PhotoMat>
                    {photo.sceneDescription && (
                      <p className="mt-1.5 text-xs text-stone-400 line-clamp-1 leading-relaxed">
                        {photo.sceneDescription}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {isReturning && showMentorCard && profile && (
          <Card padding="sm" className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <Eyebrow tone="faint" className="mb-1">From your mentor</Eyebrow>
              <p className="text-stone-300 text-sm leading-relaxed font-serif line-clamp-2">
                {mentorInsightText(profile, trendDelta, trendLabel)}
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
                +{growthFrameOverallDelta.toFixed(1)} overall between these two frames
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
