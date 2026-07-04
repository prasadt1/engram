import { listingFromApproval } from './printListingPayload';
import type { PortfolioListItem } from '../types/memory';
import type { PendingApproval } from '../types/triage';
import type { SavedPrintListing } from '../types/printSales';

function listingKey(
  portfolioEntryId: string,
  previews: Map<string, PortfolioListItem>,
): string {
  const entry = previews.get(portfolioEntryId);
  return entry?.shootId || portfolioEntryId;
}

/** One pending card per shoot — library may contain duplicate critiques of the same upload. */
export function dedupePrintProposals(
  items: PendingApproval[],
  previews: Map<string, PortfolioListItem>,
): PendingApproval[] {
  const best = new Map<string, PendingApproval>();

  for (const item of items) {
    const entryId = listingFromApproval(item).portfolioEntryId;
    const entry = previews.get(entryId);
    if (!entry) continue;
    const key = listingKey(entryId, previews);
    const prev = best.get(key);
    if (!prev) {
      best.set(key, item);
      continue;
    }
    const prevEntry = previews.get(listingFromApproval(prev).portfolioEntryId);
    const score = entry.overallAverage ?? 0;
    const prevScore = prevEntry?.overallAverage ?? 0;
    if (score >= prevScore) {
      best.set(key, item);
    }
  }

  return Array.from(best.values());
}

/** Highest portfolio score first — matches scan ranking for demo readability. */
export function sortPrintProposalsByScore(
  items: PendingApproval[],
  previews: Map<string, PortfolioListItem>,
): PendingApproval[] {
  return [...items].sort((a, b) => {
    const scoreA = previews.get(listingFromApproval(a).portfolioEntryId)?.overallAverage ?? 0;
    const scoreB = previews.get(listingFromApproval(b).portfolioEntryId)?.overallAverage ?? 0;
    return scoreB - scoreA;
  });
}

/** Hide pending drafts for shoots that already have an approved listing. */
export function filterAlreadyListedProposals(
  items: PendingApproval[],
  saved: SavedPrintListing[],
  previews: Map<string, PortfolioListItem>,
): PendingApproval[] {
  const listedKeys = new Set(
    saved.map((listing) => {
      const entry = previews.get(listing.portfolioEntryId);
      return entry?.shootId || listing.shootId || listing.portfolioEntryId;
    }),
  );
  return items.filter((item) => {
    const entryId = listingFromApproval(item).portfolioEntryId;
    return !listedKeys.has(listingKey(entryId, previews));
  });
}
