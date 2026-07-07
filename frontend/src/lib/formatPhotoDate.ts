/**
 * Compact capture-date label for library cards / memory threads.
 * "Jun 18" within the current year; "Jun 18, 2024" otherwise.
 * Returns '' for unparseable input so callers can fall back cleanly.
 */
export function formatPhotoDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
