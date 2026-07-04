/**
 * Memory tab — portfolio + aesthetic profile from Coach API.
 */

import type {
  AestheticProfileSummary,
  PortfolioListResponse,
  PortfolioStats,
  PortfolioTrendsResponse,
} from '../types/memory';
import { apiFetch } from '../lib/apiFetch';

async function getJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type SortField = 'date' | 'score' | 'composition' | 'lighting' | 'technique' | 'creativity' | 'subject_impact';
export type SortOrder = 'asc' | 'desc';

export interface FetchPortfolioOptions {
  limit?: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  /** Filter by user-applied tag */
  userTag?: string;
}

export function fetchPortfolioStats(): Promise<PortfolioStats> {
  return getJson('/api/v1/portfolio/stats');
}

export function fetchPortfolio(options: FetchPortfolioOptions = {}): Promise<PortfolioListResponse> {
  const { limit = 48, sortBy = 'date', sortOrder = 'desc', userTag } = options;
  const params = new URLSearchParams({
    limit: String(limit),
    sort_by: sortBy,
    sort_order: sortOrder,
  });
  if (userTag) {
    params.set('user_tag', userTag);
  }
  return getJson(`/api/v1/portfolio?${params}`);
}

export function fetchAestheticProfile(): Promise<AestheticProfileSummary> {
  return getJson('/api/v1/aesthetic-profile');
}

export function fetchPortfolioTrends(limit = 12): Promise<PortfolioTrendsResponse> {
  return getJson(`/api/v1/portfolio/trends?limit=${limit}`);
}

export function fetchPortfolioByShoots(shootIds: string[]): Promise<PortfolioListResponse> {
  if (shootIds.length === 0) {
    return Promise.resolve({ entries: [], total: 0 });
  }
  const params = new URLSearchParams({ shoot_ids: shootIds.join(',') });
  return getJson(`/api/v1/portfolio/by-shoots?${params}`);
}

export function deletePortfolioEntry(
  entryId: string,
  options: { removeListing?: boolean } = {},
): Promise<{ deleted: boolean; id: string; unlisted?: boolean }> {
  const params = options.removeListing ? '?removeListing=true' : '';
  return apiFetch(`/api/v1/portfolio/${entryId}${params}`, { method: 'DELETE' }).then(async (res) => {
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Delete failed: ${res.status}`);
    }
    return res.json() as Promise<{ deleted: boolean; id: string; unlisted?: boolean }>;
  });
}

export function deletePortfolioEntries(
  entryIds: string[],
  options: { removeListing?: boolean } = {},
): Promise<{
  deleted: string[];
  skipped: { id: string; reason: string }[];
  deletedCount: number;
}> {
  return apiFetch('/api/v1/portfolio/delete-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryIds, removeListing: options.removeListing ?? false }),
  }).then(async (res) => {
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Batch delete failed: ${res.status}`);
    }
    return res.json() as Promise<{
      deleted: string[];
      skipped: { id: string; reason: string }[];
      deletedCount: number;
    }>;
  });
}
