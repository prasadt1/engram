/**
 * Score context — warm darkroom scale (amber + rose only, no SaaS rainbow).
 */

export type ScoreLevel = 'needs-work' | 'developing' | 'strong' | 'exceptional';

export interface ScoreContext {
  level: ScoreLevel;
  label: string;
  color: string;
  bgColor: string;
  description: string;
}

export function getScoreContext(score: number): ScoreContext {
  if (score >= 9) {
    return {
      level: 'exceptional',
      label: 'Exceptional',
      color: 'text-brand-300',
      bgColor: 'bg-brand-500/25',
      description: 'Top-tier work. This is portfolio-worthy.',
    };
  }
  if (score >= 7) {
    return {
      level: 'strong',
      label: 'Strong',
      color: 'text-brand-400',
      bgColor: 'bg-brand-500/15',
      description: 'Solid execution. Minor refinements possible.',
    };
  }
  if (score >= 5) {
    return {
      level: 'developing',
      label: 'Developing',
      color: 'text-amber-400/90',
      bgColor: 'bg-amber-500/10',
      description: 'Good foundation. Focused practice will help.',
    };
  }
  return {
    level: 'needs-work',
    label: 'Needs work',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/15',
    description: 'Key area to focus on. See suggestions below.',
  };
}

/** Dimension-specific improvement tips */
const DIMENSION_TIPS: Record<string, string[]> = {
  composition: [
    'Try the rule of thirds — place your subject off-center',
    'Look for leading lines that guide the eye',
    'Simplify the frame — remove distracting elements',
    'Experiment with different angles and perspectives',
  ],
  lighting: [
    'Notice where the light falls on your subject',
    'Soften harsh shadows with reflectors or repositioning',
    'Shoot during golden hour for warm, directional light',
    'Avoid mixing color temperatures in one frame',
  ],
  technique: [
    'Check focus on the nearest eye in portraits',
    'Use a faster shutter speed to freeze motion',
    'Bracket exposure in high-contrast scenes',
    'Stabilize the camera for sharper results',
  ],
  creativity: [
    'Change your vantage point — get low or high',
    'Look for unexpected framing in familiar scenes',
    'Wait for a decisive moment before pressing the shutter',
    'Study one photographer you admire and try their approach',
  ],
  subject_impact: [
    'Connect with your subject before you shoot',
    'Simplify the background so the subject reads clearly',
    'Capture expression or gesture that tells a story',
    'Get closer — fill the frame with what matters',
  ],
};

export function getDimensionTips(dimension: string): string[] {
  const key = dimension.toLowerCase().replace(/\s+/g, '_');
  return DIMENSION_TIPS[key] ?? DIMENSION_TIPS.composition;
}

/** Sentence-case display labels for the five Glass Box dimensions — shared
 * with any other skill-name surface (e.g. the Journey section) so there's
 * one place that knows "subject_impact" reads as "Subject impact". */
export const DIMENSION_LABELS: Record<string, string> = {
  composition: 'Composition',
  lighting: 'Lighting',
  technique: 'Technique',
  creativity: 'Creativity',
  subject_impact: 'Subject impact',
};

export function getTipsForDimension(dimension: string, _score?: number): string[] {
  return getDimensionTips(dimension);
}

/** Human-readable label for any skill/dimension name. Looks up the sentence
 * -case Glass Box label first (composition, lighting, ...); falls back to a
 * generic snake_case → Title Case split for skills outside the five
 * dimensions (e.g. "horizon_tilt" -> "Horizon tilt"). */
export function humanizeSkillName(name: string): string {
  return DIMENSION_LABELS[name] ?? `${name.charAt(0).toUpperCase()}${name.slice(1)}`.replace(/_/g, ' ');
}

export function getFocusArea(
  scores: Record<string, number | null | undefined>,
): { dimension: string; label: string; score: number; tips: string[] } | null {
  const entries = Object.entries(scores).filter(
    (entry): entry is [string, number] => entry[1] != null,
  );
  if (entries.length === 0) return null;
  const [dimension, score] = entries.reduce((lowest, current) =>
    current[1] < lowest[1] ? current : lowest,
  );
  return {
    dimension,
    label: DIMENSION_LABELS[dimension] ?? dimension.replace(/_/g, ' '),
    score,
    tips: getDimensionTips(dimension).slice(0, 3),
  };
}
