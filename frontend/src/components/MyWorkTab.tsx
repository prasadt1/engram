/**
 * MyWorkTab — Merged Studio + Memory surface.
 *
 * Default: Gallery of your photos with scores and Glass Box summaries.
 * Upload: Prominent CTA opens upload flow, results integrate back to gallery.
 * Implements "Photos are the interface" — gallery first, upload as action.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowUpDown,
  BookmarkCheck,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Database,
  ImageIcon,
  Images,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { SimilarPhotosRow } from './SimilarPhotosRow';
import { LazyPortfolioImage } from './LazyPortfolioImage';
import { searchModeLabel, searchPortfolioLibrary } from '../services/portfolioInsightsClient';
import { SubViewBack } from './SubViewBack';
import { FilmGrain } from './FilmGrain';
import { FocusAreas } from './FocusAreas';
import { InlineAlertBanner } from './InlineAlertBanner';
import { EmptyState } from './EmptyState';
import { DimensionBar } from './DimensionBar';
import { useToast } from './ToastHost';
import { Button, Card, Tag as TagPrimitive, Eyebrow, IconButton } from './primitives';
import { getScoreContext } from '../lib/scoreContext';
import { apiUnreachableMessage } from '../lib/apiHelp';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { formatSkillLabel } from '../lib/formatSkillLabel';
import { isListedForSale, LISTED_FOR_SALE_TAG, listedForSaleLabel } from '../lib/listedForSale';
import { MemoryGridSkeleton } from './SkeletonBlocks';
import PhotoUploader from './studio/PhotoUploader';
import StudioAnalysisResults from './studio/StudioAnalysisResults';
import { MemoryReceipt } from './MemoryReceipt';
import { PhotoDetailView } from './PhotoDetailView';
import { ActivePracticeBanner } from './studio/ActivePracticeBanner';
import { fetchAestheticProfile, fetchPortfolio, fetchPortfolioTrends, deletePortfolioEntries, deletePortfolioEntry, type SortField, type SortOrder } from '../services/memoryClient';
import { FEATURES } from '../config/features';
import { analyzePhoto } from '../services/agentClient';
import { mapAnalysisResult } from '../lib/mapAnalysisResult';
import type { AnalysisResult } from '../types';
import type {
  AestheticProfileSummary,
  PortfolioListItem,
  PortfolioTrendsResponse,
} from '../types/memory';
import type { Assignment, UserMode } from '../types/practice';
import { useAuth } from '../auth/useAuth';

const TREND_DISPLAY_KEYS = ['composition', 'lighting', 'technique', 'overall'] as const;

const SCORE_LABELS: { key: keyof AestheticProfileSummary['averageScores']; label: string }[] = [
  { key: 'composition', label: 'Composition' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'technique', label: 'Technique' },
  { key: 'creativity', label: 'Creativity' },
  { key: 'subject_impact', label: 'Subject' },
];

/** Pending analysis passed from Home after upload */
interface PendingAnalysis {
  result: AnalysisResult;
  imageUrl: string;
  filename: string;
}

interface MyWorkTabProps {
  /** Drives the persona for PhotoDetailView's scoped mentor chat. */
  mode: UserMode;
  judgeMode?: boolean;
  /** Open this portfolio entry in PhotoDetailView after gallery load (from Home memory thread). */
  focusPhotoId?: string | null;
  onFocusPhotoHandled?: () => void;
  activeAssignment?: Assignment | null;
  onAssignmentComplete?: () => void;
  onGoHome?: () => void;
  /** Navigate to Practice tab. Optional dimension will auto-trigger a challenge for that skill. */
  onGoToPractice?: (focusDimension?: string) => void;
  /** Analysis result from Home upload to show immediately */
  pendingAnalysis?: PendingAnalysis | null;
  onClearPendingAnalysis?: () => void;
  /** Sidebar + home stats — call after delete or new upload */
  onPortfolioChanged?: () => void;
}

type ViewMode = 'gallery' | 'upload' | 'analyzing' | 'result';

export const MyWorkTab: React.FC<MyWorkTabProps> = ({
  mode,
  judgeMode = false,
  focusPhotoId,
  onFocusPhotoHandled,
  activeAssignment,
  onAssignmentComplete,
  onGoHome,
  onGoToPractice,
  pendingAnalysis,
  onClearPendingAnalysis,
  onPortfolioChanged,
}) => {
  const toast = useToast();
  const auth = useAuth();
  // Gallery state
  const [entries, setEntries] = useState<PortfolioListItem[]>([]);
  const [profile, setProfile] = useState<AestheticProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Clicking a photo in the grid opens the split-view detail (photo + scoped
  // mentor chat) — ImageLightbox stays in the codebase as a component but is
  // no longer wired to this click; PhotoDetailView is the library-flow entry point.
  const [detailEntry, setDetailEntry] = useState<PortfolioListItem | null>(null);
  /** True when detail was opened from Home (memory thread / contact sheet). */
  const detailReturnHomeRef = useRef(false);
  const [trends, setTrends] = useState<PortfolioTrendsResponse | null>(null);

  // Sort and filter state
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [userTagFilter, setUserTagFilter] = useState<string | null>(null);
  const [allUserTags, setAllUserTags] = useState<string[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [searchResults, setSearchResults] = useState<PortfolioListItem[] | null>(null);
  const [searchMode, setSearchMode] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Bulk select + delete (A1/A2)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<'single' | 'bulk' | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteRemovesListing, setDeleteRemovesListing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Upload/analysis state
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState('photo.jpg');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzeWaitSec, setAnalyzeWaitSec] = useState(0);
  const [submittedAssignment, setSubmittedAssignment] = useState<Assignment | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Handle pending analysis from Home upload
  useEffect(() => {
    if (pendingAnalysis) {
      setResult(pendingAnalysis.result);
      setImageUrl(pendingAnalysis.imageUrl);
      setFilename(pendingAnalysis.filename);
      setViewMode('result');
      // Clear pending analysis after processing so subsequent visits show gallery
      onClearPendingAnalysis?.();
    }
  }, [pendingAnalysis, onClearPendingAnalysis]);

  const closePhotoDetail = useCallback(() => {
    const returnHome = detailReturnHomeRef.current;
    detailReturnHomeRef.current = false;
    setDetailEntry(null);
    if (returnHome) onGoHome?.();
  }, [onGoHome]);

  const handlePhotoDetailBack = useCallback(() => {
    if (window.history.state?.engramPhotoDetail) {
      window.history.back();
    } else {
      closePhotoDetail();
    }
  }, [closePhotoDetail]);

  useEffect(() => {
    if (!detailEntry) return;
    window.history.pushState({ engramPhotoDetail: true }, '');
    const onPop = () => {
      const returnHome = detailReturnHomeRef.current;
      detailReturnHomeRef.current = false;
      setDetailEntry(null);
      if (returnHome) onGoHome?.();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [detailEntry, onGoHome]);

  useEffect(() => {
    if (!focusPhotoId || loading) return;
    const entry = entries.find((e) => e.id === focusPhotoId);
    if (entry?.imageUrl) {
      detailReturnHomeRef.current = true;
      setDetailEntry(entry);
      setViewMode('gallery');
      onFocusPhotoHandled?.();
    }
  }, [focusPhotoId, loading, entries, onFocusPhotoHandled]);

  const runLibrarySearch = useCallback(async () => {
    const q = librarySearch.trim();
    if (!q) {
      setSearchResults(null);
      setSearchMode(null);
      return;
    }
    setSearchLoading(true);
    setError(null);
    try {
      const res = await searchPortfolioLibrary(q, 12);
      setSearchResults(res.matches);
      setSearchMode(res.mode ?? 'search');
    } catch (e) {
      setSearchResults([]);
      setSearchMode(null);
      setError(friendlyErrorMessage(e));
    } finally {
      setSearchLoading(false);
    }
  }, [librarySearch]);

  const clearLibrarySearch = useCallback(() => {
    setLibrarySearch('');
    setSearchResults(null);
    setSearchMode(null);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const loadGallery = useCallback(async () => {
    if (auth.loading) return;
    setLoading(true);
    setError(null);
    try {
      const [portfolio, aesthetic, trendData, allPhotos] = await Promise.all([
        fetchPortfolio({ sortBy, sortOrder, userTag: userTagFilter ?? undefined }),
        fetchAestheticProfile(),
        fetchPortfolioTrends(12).catch(() => null),
        // Fetch all photos once to collect user tags for filter dropdown (unfiltered)
        userTagFilter ? fetchPortfolio({ sortBy: 'date', sortOrder: 'desc' }) : Promise.resolve(null),
      ]);
      setEntries(portfolio.entries);
      setProfile(aesthetic);
      setTrends(trendData);

      // Collect unique user tags from all photos for filter dropdown
      const photosForTags = allPhotos?.entries ?? portfolio.entries;
      const tagSet = new Set<string>();
      for (const entry of photosForTags) {
        for (const tag of entry.userTags ?? []) {
          tagSet.add(tag);
        }
      }
      const sorted = Array.from(tagSet).sort();
      if (!sorted.includes(LISTED_FOR_SALE_TAG)) {
        sorted.unshift(LISTED_FOR_SALE_TAG);
      }
      setAllUserTags(sorted);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder, userTagFilter, auth.loading, auth.userId]);

  const handleConfirmDelete = useCallback(async () => {
    setDeleting(true);
    setError(null);
    const removedIds = new Set<string>();
    try {
      if (deleteConfirm === 'single' && deleteTargetId) {
        await deletePortfolioEntry(deleteTargetId, { removeListing: deleteRemovesListing });
        removedIds.add(deleteTargetId);
        if (expandedId === deleteTargetId) setExpandedId(null);
      } else if (deleteConfirm === 'bulk' && selectedIds.size > 0) {
        const result = await deletePortfolioEntries([...selectedIds], {
          removeListing: deleteRemovesListing,
        });
        for (const id of result.deleted) removedIds.add(id);
        if (result.skipped.length > 0) {
          setError(
            `Deleted ${result.deletedCount}. Skipped ${result.skipped.length}: ${result.skipped[0]?.reason ?? ''}`,
          );
        }
        exitSelectMode();
      }
      await loadGallery();
      if (removedIds.size > 0) {
        setSearchResults((prev) =>
          prev !== null ? prev.filter((e) => !removedIds.has(e.id)) : null,
        );
        onPortfolioChanged?.();
      }
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
      setDeleteTargetId(null);
      setDeleteRemovesListing(false);
    }
  }, [
    deleteConfirm,
    deleteTargetId,
    deleteRemovesListing,
    selectedIds,
    expandedId,
    exitSelectMode,
    loadGallery,
    onPortfolioChanged,
  ]);

  useEffect(() => {
    if (!deleteConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        setDeleteConfirm(null);
        setDeleteTargetId(null);
        setDeleteRemovesListing(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteConfirm, deleting]);

  useEffect(() => {
    if (auth.loading) return;
    void loadGallery();
  }, [loadGallery, auth.loading, auth.userId]);

  useEffect(() => {
    if (viewMode !== 'analyzing') {
      setAnalyzeWaitSec(0);
      return;
    }
    const tick = window.setInterval(() => setAnalyzeWaitSec((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, [viewMode]);

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setViewMode('gallery');
  }, [imageUrl]);

  const handleImageSelected = async (file: File, previewUrl: string) => {
    setViewMode('analyzing');
    setResult(null);
    setImageUrl(previewUrl);
    setFilename(file.name);
    setAnalysisError(null);
    if (activeAssignment) {
      setSubmittedAssignment(activeAssignment);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const analysisResult = await analyzePhoto({
        imageFile: file,
        assignmentId: activeAssignment?.id,
        signal: controller.signal,
      });
      setResult(analysisResult);
      setViewMode('result');
      toast({
        variant: 'success',
        icon: <BookmarkCheck className="w-[18px] h-[18px]" />,
        title: 'Saved to your portfolio',
        message: "I'll remember this frame.",
      });
      onAssignmentComplete?.();
    } catch (err) {
      console.error('Analysis failed:', err);
      URL.revokeObjectURL(previewUrl);
      setImageUrl(null);
      if (err instanceof Error && err.name === 'AbortError') {
        setAnalysisError('Analysis cancelled.');
      } else {
        setAnalysisError(friendlyErrorMessage(err));
      }
      setViewMode('gallery');
    } finally {
      abortRef.current = null;
    }
  };

  const handleReset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setResult(null);
    setImageUrl(null);
    setFilename('photo.jpg');
    setSubmittedAssignment(null);
    setViewMode('gallery');
    // Clear pending analysis from Home if any
    onClearPendingAnalysis?.();
    // Refresh gallery to show new photo
    void loadGallery();
    onPortfolioChanged?.();
  };

  // Upload/Analysis view
  if (viewMode === 'upload' || viewMode === 'analyzing') {
    return (
      <div className="animate-fadeIn relative">
        <FilmGrain className="rounded-2xl" />
        <div className="relative z-10 flex flex-col items-center space-y-8 py-4 md:py-8">
          {activeAssignment && <ActivePracticeBanner assignment={activeAssignment} />}
          <div className="text-center max-w-xl">
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-white mb-2">
              {viewMode === 'analyzing' ? 'Let me take a close look' : 'Upload a photo'}
            </h2>
            {viewMode === 'upload' && (
              <p className="text-muted text-sm">
                Drag and drop or click to browse. JPG, PNG, or WEBP.
              </p>
            )}
          </div>
          <PhotoUploader
            onImageSelected={handleImageSelected}
            isAnalyzing={viewMode === 'analyzing'}
            waitSec={analyzeWaitSec}
            onCancel={cancelAnalysis}
          />
          {viewMode === 'upload' && (
            <SubViewBack label="My Work" onClick={() => setViewMode('gallery')} />
          )}
        </div>
      </div>
    );
  }

  // Results view
  if (viewMode === 'result' && result && imageUrl) {
    return (
      <div className="animate-fadeIn relative space-y-4">
        <SubViewBack label="My Work" onClick={handleReset} />
        {submittedAssignment && (
          <p className="text-sm text-brand-400 bg-brand-500/10 border border-brand-500/30 rounded-lg px-3 py-2">
            Submitted for: {formatSkillLabel(submittedAssignment.targetSkill)}
          </p>
        )}
        <div className="relative">
          <FilmGrain className="rounded-2xl" />
          <StudioAnalysisResults
            analysis={mapAnalysisResult(result)}
            imageSrc={imageUrl}
            originalFilename={filename}
            onReset={handleReset}
            memoryUpdate={result.memoryUpdate}
          />
        </div>
        <MemoryReceipt
          receipt={result.memoryReceipt}
          prominent={judgeMode}
          defaultExpanded={judgeMode}
        />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="animate-fadeIn space-y-6 max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-surface-2 rounded animate-pulse" aria-hidden />
        <MemoryGridSkeleton />
        <p className="text-sm text-muted text-center">One moment…</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card padding="lg" className="max-w-lg mx-auto text-center border-rose-500/40">
        <p className="text-rose-400 text-sm mb-4">{error}</p>
        <p className="text-muted text-xs mb-4">{apiUnreachableMessage()}</p>
        <Button icon={<RefreshCw className="w-4 h-4" />} onClick={() => void loadGallery()}>
          Retry
        </Button>
      </Card>
    );
  }

  // Gallery view (default)
  const deleteDialog =
    deleteConfirm &&
    createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-canvas/90 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        onClick={() => {
          if (!deleting) {
            setDeleteConfirm(null);
            setDeleteTargetId(null);
            setDeleteRemovesListing(false);
          }
        }}
      >
        <div
          className="max-w-sm w-full rounded-2xl border border-warm bg-surface-1 p-6 space-y-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="delete-dialog-title" className="font-serif text-lg text-white">
            Delete from library?
          </h3>
          <p className="text-sm text-muted leading-relaxed">
            {/* "Pending organize suggestions" only exist when the HITL
                triage flow is live (FEATURES.triage) — with the flag off
                the sentence would point at a hidden Organize view. */}
            {deleteConfirm === 'bulk'
              ? deleteRemovesListing
                ? `Remove ${selectedIds.size} photo${selectedIds.size === 1 ? '' : 's'} permanently. Print Sales listings on selected photos will be removed too.`
                : `Remove ${selectedIds.size} photo${selectedIds.size === 1 ? '' : 's'} permanently.${FEATURES.triage ? ' Pending organize suggestions will be cancelled.' : ''}`
              : deleteRemovesListing
                ? 'This photo is listed on Print Sales. Deleting removes the listing and its critique from your library.'
                : `This removes the photo and its critique from your library.${FEATURES.triage ? ' Pending organize suggestions for this photo will be cancelled.' : ''}`}
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => {
                setDeleteConfirm(null);
                setDeleteTargetId(null);
                setDeleteRemovesListing(false);
              }}
            >
              Cancel
            </Button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : deleteRemovesListing ? 'Remove listing & delete' : 'Delete'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="animate-fadeIn space-y-8">
      {deleteDialog}
      {analysisError && (
        <InlineAlertBanner
          message={analysisError}
          onDismiss={() => setAnalysisError(null)}
        />
      )}

      {/* Back to Home link */}
      {onGoHome && (
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Home
        </button>
      )}

      {/* Library search (semantic embeddings + Atlas keyword) */}
      <form
        className="flex flex-col sm:flex-row gap-2 max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          void runLibrarySearch();
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="search"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Search your library (e.g. car, tiger, backlit portrait)"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-warm bg-surface-1 text-stone-200 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Search portfolio by meaning or keywords"
          />
        </div>
        <Button type="submit" disabled={searchLoading || !librarySearch.trim()}>
          {searchLoading ? 'Searching…' : 'Search'}
        </Button>
        {searchResults !== null && (
          <Button variant="secondary" onClick={clearLibrarySearch}>
            Clear
          </Button>
        )}
      </form>
      {searchResults !== null && (
        <p className="text-xs text-muted -mt-4">
          {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
          {searchMode ? ` · ${searchModeLabel(searchMode)}` : ''}
        </p>
      )}

      {/* Header with upload CTA */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-white mb-1">My Work</h2>
          <p className="text-muted text-sm">
            {searchResults !== null
              ? `Showing search results`
              : entries.length > 0
                ? `${entries.length} photo${entries.length === 1 ? '' : 's'} in your library`
                : 'Your critiqued photos appear here'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* User tag filter dropdown */}
          {allUserTags.length > 0 && (
            <div className="relative">
              <select
                value={userTagFilter ?? ''}
                onChange={(e) => setUserTagFilter(e.target.value || null)}
                className="appearance-none pl-8 pr-8 py-2 rounded-lg border border-warm bg-surface-1 text-stone-300 text-sm hover:bg-surface-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All photos</option>
                {allUserTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag === LISTED_FOR_SALE_TAG ? listedForSaleLabel() : tag.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400 pointer-events-none" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            </div>
          )}
          {/* Active filter pill */}
          {userTagFilter && (
            <button
              type="button"
              onClick={() => setUserTagFilter(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-400 text-xs font-medium hover:bg-brand-500/30"
            >
              {userTagFilter === LISTED_FOR_SALE_TAG
                ? listedForSaleLabel()
                : userTagFilter.replace(/_/g, ' ')}
              <X className="w-3 h-3" />
            </button>
          )}
          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-') as [SortField, SortOrder];
                setSortBy(field);
                setSortOrder(order);
              }}
              className="appearance-none pl-8 pr-8 py-2 rounded-lg border border-warm bg-surface-1 text-stone-300 text-sm hover:bg-surface-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="score-desc">Highest score</option>
              <option value="score-asc">Lowest score</option>
              <option value="composition-desc">Best composition</option>
              <option value="lighting-desc">Best lighting</option>
              <option value="creativity-desc">Most creative</option>
            </select>
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </div>
          <IconButton
            icon={<RefreshCw className="w-4 h-4" />}
            label="Refresh gallery"
            variant="ghost"
            size="sm"
            onClick={() => void loadGallery()}
          />
          {(searchResults !== null ? searchResults : entries).length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (selectMode) exitSelectMode();
                else setSelectMode(true);
              }}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                selectMode
                  ? 'border-brand-500/50 text-brand-400 bg-brand-500/10'
                  : 'border-warm text-stone-300 hover:bg-surface-2'
              }`}
            >
              {selectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
          {selectMode && selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => {
                const pool = searchResults ?? entries;
                const removesListing = [...selectedIds].some((id) => {
                  const entry = pool.find((e) => e.id === id);
                  return entry != null && isListedForSale(entry.userTags);
                });
                setDeleteRemovesListing(removesListing);
                setDeleteConfirm('bulk');
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/50 text-rose-400 text-sm hover:bg-rose-500/10"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.size})
            </button>
          )}
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setViewMode('upload')}
            className="rounded-full shadow-lg shadow-brand-500/20"
          >
            Upload
          </Button>
        </div>
      </div>

      {/* Active assignment banner */}
      {activeAssignment && (
        <Card variant="active" padding="sm" className="flex items-center justify-between gap-4 bg-brand-500/10">
          <div>
            <Eyebrow tone="brand" className="mb-1">Active Challenge</Eyebrow>
            <p className="text-sm text-white">{activeAssignment.brief}</p>
          </div>
          <Button size="sm" onClick={() => setViewMode('upload')}>
            Upload for this
          </Button>
        </Card>
      )}

      {/* Compact stats summary (collapsible) */}
      {profile && profile.photoCount > 0 && (
        <details className="group rounded-xl bg-surface-1 border border-warm">
          <summary className="flex items-center justify-between gap-4 p-4 cursor-pointer select-none hover:bg-surface-2/50 transition-colors list-none">
            <div className="flex items-center gap-3 min-w-0">
              <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-white font-medium">{profile.photoCount} photos</span>
                <span className="text-warm">·</span>
                <span className="text-stone-300">
                  Avg{' '}
                  <span className="text-amber-400 font-semibold">
                    {(() => {
                      const scores = Object.values(profile.averageScores).filter((v): v is number => v != null);
                      return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
                    })()}
                  </span>
                </span>
                {profile.stylisticConsistencyScore != null && (
                  <>
                    <span className="text-warm">·</span>
                    <span className="text-stone-300">
                      <span className="text-brand-400 font-semibold">
                        {Math.round(profile.stylisticConsistencyScore * 100)}%
                      </span>{' '}
                      consistent
                    </span>
                  </>
                )}
                {trends && !trends.insufficientData && trends.dimensions.find(d => d.key === 'overall')?.delta != null && (
                  <>
                    <span className="text-warm">·</span>
                    <span className="text-brand-400 text-xs flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      +{trends.dimensions.find(d => d.key === 'overall')?.delta?.toFixed(1)} progress
                    </span>
                  </>
                )}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted group-open:rotate-180 transition-transform shrink-0" />
          </summary>

          <div className="px-4 pb-4 pt-2 border-t border-warm/60 space-y-4">
            {/* Tags */}
            {profile.dominantTags.length > 0 && (
              <div>
                <Eyebrow className="mb-2">Your style</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {profile.dominantTags.slice(0, 6).map((tag) => (
                    <TagPrimitive key={tag} variant="outline">{tag.replace(/_/g, ' ')}</TagPrimitive>
                  ))}
                </div>
              </div>
            )}

            {/* Score legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] pb-2 border-b border-warm/40 mb-3">
              <span className="text-muted">Score guide:</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-stone-400">1-4 Needs work</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-stone-400">5-6 Developing</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-brand-400" />
                <span className="text-stone-400">7-8 Strong</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-brand-300" />
                <span className="text-stone-400">9-10 Exceptional</span>
              </span>
            </div>

            {/* Score breakdown with context */}
            <div className="grid grid-cols-5 gap-2 text-center">
              {SCORE_LABELS.map(({ key, label }) => {
                const val = profile.averageScores[key];
                const ctx = val != null ? getScoreContext(val) : null;
                return (
                  <div key={key} className={`score-badge space-y-1 rounded-lg p-2 ${ctx?.bgColor ?? ''}`}>
                    <p className="text-[9px] text-muted uppercase truncate">{label}</p>
                    <p className={`text-lg font-bold ${ctx?.color ?? 'text-muted'}`}>
                      {val?.toFixed(1) ?? '—'}
                    </p>
                    {ctx && (
                      <p className={`text-[10px] font-medium ${ctx.color}`}>{ctx.label}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Trends */}
            {trends && !trends.insufficientData && trends.dimensions.length > 0 && (
              <div>
                <Eyebrow className="mb-3">Recent progress</Eyebrow>
                <div className="space-y-3">
                  {trends.dimensions
                    .filter((d) => (TREND_DISPLAY_KEYS as readonly string[]).includes(d.key))
                    .map((d, i) => (
                      <div key={d.key} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <DimensionBar label={d.label} value={d.latest ?? 0} index={i} />
                        </div>
                        {d.delta != null && (
                          <span
                            className={`text-[10px] shrink-0 tabular-nums ${
                              d.delta >= 0 ? 'text-brand-400' : 'text-rose-400'
                            }`}
                          >
                            {d.delta >= 0 ? '+' : ''}
                            {d.delta.toFixed(1)}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Focus Area with actionable tips */}
            <FocusAreas
              scores={profile.averageScores}
              onStartPractice={onGoToPractice}
            />
          </div>
        </details>
      )}

      {/* Photo gallery or empty state */}
      {(searchResults !== null ? searchResults : entries).length === 0 ? (
        <EmptyState
          icon={
            searchResults !== null ? (
              <Search className="w-6 h-6" />
            ) : (
              <Images className="w-6 h-6" />
            )
          }
          title={
            searchResults !== null
              ? 'No photos matched that search'
              : 'No frames in your Library yet'
          }
          description={
            searchResults !== null
              ? 'Try a different word or phrase — I search by meaning, not just keywords.'
              : "Upload your first photo and I'll critique it on five dimensions — then remember it."
          }
          action={
            searchResults !== null ? (
              <Button variant="secondary" onClick={clearLibrarySearch}>
                Clear search
              </Button>
            ) : (
              <Button icon={<Upload className="w-4 h-4" />} onClick={() => setViewMode('upload')}>
                Upload photo
              </Button>
            )
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(searchResults !== null ? searchResults : entries).map((entry) => {
            const expanded = expandedId === entry.id;
            const selected = selectedIds.has(entry.id);
            let when = '';
            try {
              when = formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true });
            } catch {
              when = '';
            }
            return (
              <article
                key={entry.id}
                className={`rounded-2xl bg-surface-1 border overflow-hidden flex flex-col transition-all duration-[250ms] hover:-translate-y-1 hover:shadow-[0_12px_32px_oklch(0_0_0/0.3)] ${
                  selected ? 'border-brand-500/60 ring-1 ring-brand-500/40' : 'border-warm'
                }`}
                style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
              >
                <div className="relative flex flex-col flex-1">
                  {selectMode && (
                    <button
                      type="button"
                      onClick={() => toggleSelected(entry.id)}
                      className="absolute top-3 left-3 z-10 p-1.5 rounded-md bg-surface-1/90 border border-warm text-brand-400"
                      aria-label={selected ? 'Deselect photo' : 'Select photo'}
                    >
                      {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  )}
                <button
                  type="button"
                  className="text-left w-full cursor-zoom-in"
                  aria-label={`Open photo detail and ask the mentor about it, score ${entry.overallAverage} out of 10`}
                  onClick={() => {
                    if (selectMode) {
                      toggleSelected(entry.id);
                      return;
                    }
                    if (entry.imageUrl) {
                      detailReturnHomeRef.current = false;
                      setDetailEntry(entry);
                    }
                  }}
                >
                  <div className="p-3 bg-photo-black border-b border-warm/40">
                    <div className="aspect-[4/3] bg-photo-black relative rounded-md overflow-hidden ring-1 ring-warm/60 shadow-inner">
                      {isListedForSale(entry.userTags) && (
                        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-stone-900 border border-brand-500/50 text-brand-400 text-[10px] font-bold uppercase tracking-wide shadow-md whitespace-nowrap">
                          Listed
                        </span>
                      )}
                      {entry.glassBoxSummary.length > 0 && (
                        <span
                          className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-900 border border-brand-500/40 text-brand-300 text-[10px] font-semibold whitespace-nowrap"
                          title="Critique grounded in your library — Glass Box reasoning and cited photography principles are stored with this photo"
                        >
                          <Database className="w-3 h-3" aria-hidden />
                          Grounded
                        </span>
                      )}
                      {entry.imageUrl ? (
                        <LazyPortfolioImage
                          src={entry.imageUrl}
                          alt={entry.sceneDescription?.slice(0, 120) || 'Portfolio photo'}
                          imgClassName="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-stone-600">
                          <ImageIcon className="w-10 h-10" aria-hidden />
                        </div>
                      )}
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-on-brand text-xs font-bold shadow-md tabular-nums">
                        {entry.overallAverage}/10
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="text-left flex flex-col flex-1"
                  aria-label={`View photo details, score ${entry.overallAverage} out of 10${
                    entry.sceneDescription
                      ? `: ${entry.sceneDescription.slice(0, 60)}`
                      : ''
                  }`}
                  aria-expanded={expanded}
                  onClick={() => {
                    if (selectMode) {
                      toggleSelected(entry.id);
                      return;
                    }
                    setExpandedId(expanded ? null : entry.id);
                  }}
                >
                  <div className="p-4 flex-1">
                    {entry.sceneDescription && (
                      <p
                        className={`text-sm text-stone-300 leading-snug ${
                          expanded ? '' : 'line-clamp-2'
                        }`}
                      >
                        {entry.sceneDescription}
                      </p>
                    )}
                    <p className="text-[10px] text-muted mt-2 uppercase">{when}</p>
                    {entry.glassBoxSummary.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-warm/80">
                        <p className="text-[10px] font-bold uppercase text-brand-400/90 tracking-wide mb-1.5">
                          Glass Box
                        </p>
                        <ul className="space-y-1 text-xs text-muted leading-relaxed" role="list">
                          {(expanded ? entry.glassBoxSummary : entry.glassBoxSummary.slice(0, 1)).map(
                            (line, i) => (
                              <li key={i} className={expanded ? '' : 'line-clamp-2'}>
                                {line}
                              </li>
                            ),
                          )}
                        </ul>
                        {!expanded && entry.glassBoxSummary.length > 0 && (
                          <span className="text-[10px] text-brand-400 mt-1 inline-block">
                            Show critique reasoning
                          </span>
                        )}
                      </div>
                    )}
                    {/* User-applied tags (amber) */}
                    {(entry.userTags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.userTags
                          .filter((tag) => tag !== LISTED_FOR_SALE_TAG)
                          .slice(0, expanded ? 8 : 3)
                          .map((tag) => (
                          <span
                            key={`user-${tag}`}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30 font-medium"
                          >
                            {tag.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* AI-generated tags (gray) */}
                    {entry.aestheticTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entry.aestheticTags.slice(0, expanded ? 12 : 4).map((tag) => (
                          <span
                            key={`ai-${tag}`}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-canvas-elevated text-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {expanded && (
                      <SimilarPhotosRow
                        entryId={entry.id}
                        onSelectEntry={(id) => {
                          setExpandedId(id);
                          clearLibrarySearch();
                        }}
                      />
                    )}
                    {'matchedObservations' in entry &&
                      Array.isArray(
                        (entry as PortfolioListItem & { matchedObservations?: string[] })
                          .matchedObservations,
                      ) &&
                      (
                        entry as PortfolioListItem & { matchedObservations?: string[] }
                      ).matchedObservations!.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-warm/60">
                          <p className="text-[10px] font-bold uppercase text-muted tracking-wide mb-1">
                            Matched critique
                          </p>
                          <p className="text-xs text-stone-400 leading-relaxed line-clamp-2">
                            {(
                              entry as PortfolioListItem & { matchedObservations?: string[] }
                            ).matchedObservations![0]}
                          </p>
                        </div>
                      )}
                  </div>
                </button>
                {expanded && !selectMode && (
                  <div className="px-4 pb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTargetId(entry.id);
                        setDeleteRemovesListing(isListedForSale(entry.userTags));
                        setDeleteConfirm('single');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isListedForSale(entry.userTags)
                        ? 'Remove listing & delete'
                        : 'Delete from library'}
                    </button>
                  </div>
                )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {detailEntry && detailEntry.imageUrl && (
        <PhotoDetailView
          photo={detailEntry}
          persona={mode}
          judgeMode={judgeMode}
          backLabel={detailReturnHomeRef.current ? 'Back to Home' : 'Back to library'}
          onClose={handlePhotoDetailBack}
        />
      )}
    </div>
  );
};
