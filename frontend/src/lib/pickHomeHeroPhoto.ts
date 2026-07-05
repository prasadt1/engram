import type { PortfolioListItem } from '../types/memory';

/**
 * Pick a home hero frame from the user's library.
 * Uses API-reported strongest (highest average score) when available.
 */
export function pickHomeHeroPhoto(
  strongest: PortfolioListItem | null,
  candidates: PortfolioListItem[],
): PortfolioListItem | null {
  if (strongest?.imageUrl && strongest.overallAverage > 0) {
    return strongest;
  }
  const pool = candidates.filter((e) => e.imageUrl && e.overallAverage > 0);
  if (pool.length === 0) return strongest;

  return [...pool].sort((a, b) => b.overallAverage - a.overallAverage)[0] ?? strongest;
}
