/** Match Glass Box text to score dimensions for bidirectional highlighting. */

export const DIMENSION_KEYWORDS: Record<string, string[]> = {
  Composition: [
    'composition',
    'rule of thirds',
    'framing',
    'balance',
    'leading line',
    'symmetry',
    'crop',
  ],
  Lighting: [
    'light',
    'lighting',
    'exposure',
    'shadow',
    'highlight',
    'backlit',
    'contrast',
    'golden hour',
  ],
  Technique: [
    'technique',
    'focus',
    'sharp',
    'noise',
    'iso',
    'aperture',
    'shutter',
    'blur',
    'bokeh',
  ],
  Creativity: ['creative', 'creativity', 'story', 'mood', 'concept', 'original'],
  Subject: ['subject', 'impact', 'expression', 'eyes', 'portrait', 'face', 'emotion'],
};

export function textMatchesDimension(text: string, dimension: string | null): boolean {
  if (!dimension) return false;
  const keywords = DIMENSION_KEYWORDS[dimension];
  if (!keywords?.length) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/** Best-matching dimension for a Glass Box line, if any. */
export function dimensionForText(text: string): string | null {
  for (const dim of Object.keys(DIMENSION_KEYWORDS)) {
    if (textMatchesDimension(text, dim)) return dim;
  }
  return null;
}
