import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ImageIcon, Settings, ShoppingBag, X } from 'lucide-react';
import { ScanProgressBanner } from './ScanProgressBanner';
import { PrintListingCardsSkeleton } from './SkeletonBlocks';
import { TabEmptyState } from './TabEmptyState';
import { printScanStage } from '../lib/scanLoadingStages';
import { HitlReasoningCallout } from './HitlReasoningCallout';
import { friendlyErrorMessage } from '../lib/friendlyError';
import { dedupePrintProposals, filterAlreadyListedProposals, sortPrintProposalsByScore } from '../lib/dedupePrintProposals';
import { listingFromApproval } from '../lib/printListingPayload';
import { fetchPortfolio } from '../services/memoryClient';
import {
  decidePrintApproval,
  fetchPrintPending,
  fetchPrintRejected,
  fetchSavedPrintListings,
  runPrintSalesScan,
} from '../services/printSalesClient';
import type { UserMode } from '../types/practice';
import type { SavedPrintListing } from '../types/printSales';
import type { PendingApproval } from '../types/triage';
import type { PortfolioListItem } from '../types/memory';

interface Props {
  mode: UserMode;
  onGoToMentor?: () => void;
  onGoToWork?: () => void;
  onOpenSettings?: () => void;
}

type PrintFeedback =
  | { kind: 'scan'; created: number; superseded: number }
  | { kind: 'approved'; marketplace: string; price: number; title: string }
  | { kind: 'rejected' };

function PrintSalesFeedbackBanner({
  feedback,
  onGoToWork,
  onDismiss,
}: {
  feedback: PrintFeedback;
  onGoToWork?: () => void;
  onDismiss: () => void;
}) {
  if (feedback.kind === 'scan') {
    const { created, superseded } = feedback;
    return (
      <div className="rounded-xl border border-warm bg-surface-1 px-4 py-3 text-sm text-stone-300">
        {superseded > 0
          ? `Replaced ${superseded} old draft(s). ${created} new listing proposal(s) ready below.`
          : `${created} listing proposal(s) ready — approve each one individually.`}
      </div>
    );
  }

  if (feedback.kind === 'rejected') {
    return (
      <div className="rounded-xl border border-warm bg-surface-1 px-4 py-3 flex items-start justify-between gap-3">
        <p className="text-sm text-stone-300">
          Draft dismissed — nothing was saved to your library or listings.
        </p>
        <button type="button" onClick={onDismiss} className="text-stone-500 hover:text-white p-1" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-4 space-y-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-full bg-brand-500/20 shrink-0 mt-0.5">
          <Check className="w-4 h-4 text-brand-400" aria-hidden />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold text-white">Listing saved to your library</p>
          <p className="text-sm text-stone-300 leading-relaxed">
            <strong className="text-stone-200 font-medium">{feedback.title}</strong> is saved for{' '}
            {feedback.marketplace} at ${feedback.price.toFixed(2)} — not live on Etsy in this preview.
            Your photo is still in <strong className="text-stone-200 font-medium">My Work</strong> with a
            Listed badge.
          </p>
        </div>
        <button type="button" onClick={onDismiss} className="text-stone-500 hover:text-white p-1 shrink-0" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      {onGoToWork && (
        <button
          type="button"
          onClick={onGoToWork}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 text-on-brand text-sm font-semibold hover:bg-brand-400"
        >
          View in My Work
        </button>
      )}
    </div>
  );
}

export const PrintSalesTab: React.FC<Props> = ({ mode, onGoToMentor, onGoToWork, onOpenSettings }) => {
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [savedListings, setSavedListings] = useState<SavedPrintListing[]>([]);
  const [rejected, setRejected] = useState<PendingApproval[]>([]);
  const [previews, setPreviews] = useState<Map<string, PortfolioListItem>>(new Map());
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanWaitSec, setScanWaitSec] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PrintFeedback | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  const loadPreviews = useCallback(async (): Promise<Map<string, PortfolioListItem>> => {
    const map = new Map<string, PortfolioListItem>();
    try {
      const data = await fetchPortfolio({ limit: 100 });
      for (const e of data.entries) {
        map.set(e.id, e);
      }
      setPreviews(map);
    } catch {
      /* optional */
    }
    return map;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pending, saved, rejectedItems, previewMap] = await Promise.all([
        fetchPrintPending(),
        fetchSavedPrintListings(),
        fetchPrintRejected(),
        loadPreviews(),
      ]);
      const deduped = sortPrintProposalsByScore(
        filterAlreadyListedProposals(
          dedupePrintProposals(pending.items, previewMap),
          saved.items,
          previewMap,
        ),
        previewMap,
      );
      setItems(deduped);
      setSavedListings(saved.items);
      setRejected(rejectedItems.items);
      const nextPrices: Record<string, number> = {};
      for (const item of deduped) {
        nextPrices[item.id] = listingFromApproval(item).suggestedListPrice;
      }
      setPrices(nextPrices);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loadPreviews]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!scanning) {
      setScanWaitSec(0);
      return;
    }
    const tick = window.setInterval(() => setScanWaitSec((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, [scanning]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const result = await runPrintSalesScan('etsy');
      const created = result.proposalsCreated?.length ?? 0;
      const cleared = result.supersededPending ?? 0;
      setFeedback({ kind: 'scan', created, superseded: cleared });
      const [saved, previewMap] = await Promise.all([fetchSavedPrintListings(), loadPreviews()]);
      setSavedListings(saved.items);
      const deduped = sortPrintProposalsByScore(
        filterAlreadyListedProposals(
          dedupePrintProposals(result.pending?.items ?? [], previewMap),
          saved.items,
          previewMap,
        ),
        previewMap,
      );
      setItems(deduped);
      const nextPrices: Record<string, number> = {};
      for (const item of deduped) {
        nextPrices[item.id] = listingFromApproval(item).suggestedListPrice;
      }
      setPrices(nextPrices);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (item: PendingApproval) => {
    const draft = listingFromApproval(item);
    const edited = prices[item.id] ?? draft.suggestedListPrice;
    const priceChanged = Math.abs(edited - draft.suggestedListPrice) > 0.009;
    setActing(item.id);
    try {
      await decidePrintApproval(
        item.id,
        priceChanged ? 'modify' : 'approve',
        priceChanged ? { suggestedListPrice: edited, list_price: edited } : undefined,
      );
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      setFeedback({
        kind: 'approved',
        marketplace: draft.marketplace,
        price: edited,
        title: draft.title,
      });
      await refresh();
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: string) => {
    setActing(id);
    try {
      await decidePrintApproval(id, 'reject');
      setItems((prev) => prev.filter((p) => p.id !== id));
      setFeedback({ kind: 'rejected' });
      const rejectedItems = await fetchPrintRejected();
      setRejected(rejectedItems.items);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setActing(null);
    }
  };

  if (mode !== 'working_pro') {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-8 animate-fadeIn">
        <div>
          <h1 className="text-2xl font-extrabold text-white">List for Sale</h1>
          <p className="text-muted text-sm mt-2 leading-relaxed">
            Working pros get per-listing drafts with your approval before anything is saved. Hobbyists
            can still ask Ask Mentor which shots might sell as prints.
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-warm bg-surface-1 p-5 text-left space-y-3">
          <p className="text-[10px] font-bold uppercase text-amber-400/90 tracking-wide">
            Example listing draft
          </p>
          <p className="text-sm font-semibold text-white">Coastal light — limited print</p>
          <p className="text-xs text-muted line-clamp-2">
            Archival matte print, signed. Suggested $45 — you approve title, copy, and price on each
            card.
          </p>
          <p className="text-xs text-muted">
            Portfolio score 8.2/10 · Etsy-style draft (saved in your library only, not live API)
          </p>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-on-brand font-semibold text-sm hover:bg-brand-400"
          >
            <Settings className="w-4 h-4" />
            Switch to Working pro
          </button>
        )}
        {onGoToMentor && (
          <p className="text-sm text-muted">
            Or{' '}
            <button
              type="button"
              onClick={onGoToMentor}
              className="text-brand-400 hover:text-brand-300 underline"
            >
              ask Ask Mentor
            </button>{' '}
            which photos might sell.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-brand-400 mb-2">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wide">List for Sale</span>
        </div>
        <h1 className="font-serif text-2xl md:text-3xl text-white">Approve marketplace listings</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          I scan your portfolio, pick strong candidates, and draft title, description, and price for
          each listing. You approve every card individually — approved listings are saved to your
          library, not published to Etsy in this preview.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleScan()}
        disabled={scanning}
        className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-brand-500 text-on-brand font-semibold hover:bg-brand-400 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {!scanning && <ShoppingBag className="w-4 h-4" />}
        {scanning ? 'Drafting listings…' : 'Draft listing proposals'}
      </button>

      {scanning && (
        <ScanProgressBanner message={printScanStage(scanWaitSec)} waitSec={scanWaitSec} />
      )}

      {feedback && (
        <PrintSalesFeedbackBanner
          feedback={feedback}
          onGoToWork={
            feedback.kind === 'approved' && onGoToWork ? onGoToWork : undefined
          }
          onDismiss={() => setFeedback(null)}
        />
      )}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {savedListings.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Your approved listings
          </h2>
          <ul className="space-y-3">
            {savedListings.map((listing) => {
              const entry = previews.get(listing.portfolioEntryId);
              const imageUrl = listing.imageUrl ?? entry?.imageUrl;
              const orphaned = listing.orphaned ?? !imageUrl;
              return (
                <li
                  key={listing.id}
                  className="rounded-xl border border-warm bg-surface-1 overflow-hidden flex flex-col sm:flex-row gap-4 p-4"
                >
                  <div className="shrink-0 w-full sm:w-24 aspect-square rounded-lg overflow-hidden bg-black border border-warm">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full min-h-[80px] text-stone-600 px-2 text-center gap-1">
                        <ImageIcon className="w-8 h-8" />
                        {orphaned && (
                          <span className="text-[10px] text-stone-500 leading-tight">
                            Photo removed from library
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase font-bold text-brand-400">Saved</span>
                      <span className="text-[10px] uppercase text-muted">{listing.marketplace}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{listing.title}</h3>
                    <p className="text-xs text-muted mt-1 line-clamp-2">{listing.description}</p>
                    <p className="text-sm text-brand-400 mt-2 tabular-nums">
                      ${listing.listPrice.toFixed(2)} {listing.currency}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          {items.length > 0 ? 'Pending proposals' : 'Listing proposals'}
        </h2>

        {loading && <PrintListingCardsSkeleton />}

        {!loading && items.length === 0 && savedListings.length === 0 && !feedback && (
          <TabEmptyState
            icon={ShoppingBag}
            title="No listing drafts yet"
            description="I draft Etsy-style titles, descriptions, and prices from your portfolio — nothing is saved until you approve each card."
            steps={[
              'Upload strong portfolio photos in My Work',
              'Tap Draft listing proposals above',
              'Or ask Mentor which photos to list',
            ]}
            action={
              onGoToMentor ? { label: 'Ask Mentor', onClick: onGoToMentor } : undefined
            }
          />
        )}

        {!loading && items.length === 0 && savedListings.length > 0 && (
          <p className="text-sm text-muted">No pending drafts — scan again when you add new portfolio gems.</p>
        )}

        <ul className="space-y-5">
          {items.map((item) => {
            const draft = listingFromApproval(item);
            const entry = previews.get(draft.portfolioEntryId);
            const price = prices[item.id] ?? draft.suggestedListPrice;
            return (
              <li
                key={item.id}
                className="rounded-xl border border-warm bg-surface-1 overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row gap-4 p-4">
                  <div className="shrink-0 w-full sm:w-28 aspect-[3/4] sm:aspect-square rounded-lg overflow-hidden bg-black border border-warm">
                    {entry?.imageUrl ? (
                      <img
                        src={entry.imageUrl}
                        alt={entry.sceneDescription?.slice(0, 80) || draft.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-stone-600 min-h-[80px]">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
                      Proposal — not listed until you approve
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-stone-400">
                        {draft.marketplace}
                      </span>
                      {entry?.overallAverage != null && (
                        <span className="text-[10px] text-muted">
                          Portfolio {entry.overallAverage}/10
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white leading-snug">{draft.title}</h3>
                    <p className="text-xs text-muted line-clamp-3">{draft.description}</p>
                    <HitlReasoningCallout reasoning={item.agentReasoning} />
                    <label
                      htmlFor={`price-${item.id}`}
                      className="flex items-center gap-2 text-sm text-stone-300"
                    >
                      <span className="shrink-0 font-serif italic text-brand-400/90">
                        Price ({draft.currency})
                      </span>
                      <input
                        id={`price-${item.id}`}
                        type="number"
                        min={1}
                        step={0.5}
                        value={price}
                        disabled={acting === item.id}
                        onChange={(e) =>
                          setPrices((prev) => ({
                            ...prev,
                            [item.id]: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-24 rounded-lg bg-canvas-elevated border border-warm px-2 py-1 text-white text-sm"
                        aria-label={`Listing price in ${draft.currency}`}
                      />
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 p-3 pt-0 border-t border-warm/80">
                  <button
                    type="button"
                    disabled={acting === item.id || price < 1}
                    onClick={() => void handleApprove(item)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-brand-600/90 text-white text-sm font-medium hover:bg-brand-500 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" /> Approve listing
                  </button>
                  <button
                    type="button"
                    disabled={acting === item.id}
                    onClick={() => void handleReject(item.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-warm text-stone-300 text-sm hover:bg-surface-3 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {rejected.length > 0 && (
        <details
          className="rounded-xl border border-warm bg-surface-1/50"
          open={showRejected}
          onToggle={(e) => setShowRejected((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-4 py-3 text-sm text-stone-400 flex items-center justify-between gap-2 list-none">
            <span>Rejected drafts ({rejected.length})</span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform ${showRejected ? 'rotate-180' : ''}`}
            />
          </summary>
          <ul className="px-4 pb-4 space-y-2 border-t border-warm/60">
            {rejected.map((item) => {
              const draft = listingFromApproval(item);
              return (
                <li key={item.id} className="text-xs text-muted py-2 border-b border-warm/40 last:border-0">
                  <span className="text-stone-400 line-through">{draft.title}</span>
                  <span className="mx-2">·</span>
                  <span>Dismissed — not saved</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
};
