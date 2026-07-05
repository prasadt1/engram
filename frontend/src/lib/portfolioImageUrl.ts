/**
 * Normalize portfolio image URLs for <img src>.
 * Relative /media/... paths are served same-origin (Vite proxies to API in dev).
 */
export function portfolioImageUrl(url: string | undefined | null): string {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) return trimmed;
  return `/${trimmed.replace(/^\/+/, '')}`;
}
