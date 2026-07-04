import type { PendingApproval } from '../types/triage';

export interface ListingDraft {
  portfolioEntryId: string;
  marketplace: string;
  title: string;
  description: string;
  suggestedListPrice: number;
  currency: string;
  tags: string[];
}

export function listingFromApproval(item: PendingApproval): ListingDraft {
  const payload = item.proposedAction.payload;
  const price =
    typeof payload.suggestedListPrice === 'number'
      ? payload.suggestedListPrice
      : typeof payload.list_price === 'number'
        ? payload.list_price
        : 45;
  return {
    portfolioEntryId: item.proposedAction.targetId,
    marketplace: String(payload.marketplace ?? 'etsy'),
    title: String(payload.title ?? 'Fine art print'),
    description: String(payload.description ?? ''),
    suggestedListPrice: price,
    currency: String(payload.currency ?? 'USD'),
    tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : [],
  };
}
