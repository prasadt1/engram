/** Plain-language skill application rate (replaces "ISAR Δ" in UI). */
export function formatSkillApplicationDelta(delta: number): string {
  const pct = Math.round(delta * 100);
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct}% intentional use of your practice target`;
}
