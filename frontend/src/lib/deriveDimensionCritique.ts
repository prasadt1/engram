import type { GlassBox } from '../types';
import { textMatchesDimension } from './glassBoxHighlight';

type Dimension = 'Creativity' | 'Subject';

function firstMatching(lines: string[], dimension: Dimension): string | undefined {
  return lines.find((line) => textMatchesDimension(line, dimension));
}

/**
 * API critique only has composition/lighting/technique/overall.
 * Derive creativity & subject copy from Glass Box lines when dedicated fields are absent.
 */
export function deriveDimensionCritique(
  dimension: Dimension,
  score: number,
  glassBox: GlassBox,
  strengths?: string[],
  improvements?: string[],
  overallFallback?: string,
): string {
  const fromObs = firstMatching(glassBox.observations, dimension);
  if (fromObs) return fromObs;

  const fromSteps = firstMatching(glassBox.reasoning_steps, dimension);
  if (fromSteps) return fromSteps;

  if (score >= 7 && strengths?.length) {
    const strength = firstMatching(strengths, dimension);
    if (strength) return strength;
  }

  if (improvements?.length) {
    const improvement = firstMatching(improvements, dimension);
    if (improvement) return improvement;
  }

  const label = dimension === 'Creativity' ? 'creativity' : 'subject impact';
  const snippet = overallFallback?.split(/[.!?]/)[0]?.trim();
  if (snippet) {
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} scored ${score.toFixed(1)}/10 — ${snippet}.`;
  }
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} scored ${score.toFixed(1)}/10.`;
}
