import type { StudioAnalysis } from '../types/studio';

export type ScoreDimension =
  | 'Composition'
  | 'Lighting'
  | 'Technique'
  | 'Creativity'
  | 'Subject';

export interface PercentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DimensionHighlight {
  dimension: ScoreDimension;
  label: string;
  /** Primary spotlight region (% of image) */
  region: PercentRect;
  /** Optional extra rects (e.g. competing elements for composition) */
  secondaryRegions?: PercentRect[];
  /** Show rule-of-thirds guides */
  showThirdsGrid?: boolean;
  /** Lit-side hint for lighting */
  lightingDirection?: string;
  accentClass: string;
  borderClass: string;
  glowClass: string;
}

const POSITION_MAP: Record<string, PercentRect> = {
  center: { x: 30, y: 22, width: 40, height: 56 },
  center_slight_right: { x: 38, y: 20, width: 36, height: 58 },
  center_slight_left: { x: 26, y: 20, width: 36, height: 58 },
  left: { x: 8, y: 18, width: 38, height: 64 },
  right: { x: 54, y: 18, width: 38, height: 64 },
  upper_left: { x: 10, y: 8, width: 36, height: 42 },
  upper_right: { x: 54, y: 8, width: 36, height: 42 },
  lower_left: { x: 10, y: 50, width: 36, height: 42 },
  lower_right: { x: 54, y: 50, width: 36, height: 42 },
};

function subjectRegion(analysis: StudioAnalysis): PercentRect {
  const primary = analysis.boundingBoxes[0];
  if (primary) {
    return { x: primary.x, y: primary.y, width: primary.width, height: primary.height };
  }
  const pos = analysis.subjectRelationships?.primary_subject_position ?? 'center';
  return POSITION_MAP[pos] ?? POSITION_MAP.center;
}

function compositionRegion(analysis: StudioAnalysis): DimensionHighlight {
  const subject = subjectRegion(analysis);
  const secondary = analysis.boundingBoxes.slice(1, 3).map((b) => ({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
  }));
  return {
    dimension: 'Composition',
    label: 'Framing & balance',
    region: subject,
    secondaryRegions: secondary.length > 0 ? secondary : undefined,
    showThirdsGrid: true,
    accentClass: 'text-brand-400',
    borderClass: 'border-brand-400',
    glowClass: 'shadow-[0_0_0_9999px_rgba(15,23,42,0.62)]',
  };
}

function lightingRegion(analysis: StudioAnalysis): DimensionHighlight {
  const dir = analysis.lightingMap?.key_light_direction ?? 'upper_right';
  const rects: Record<string, PercentRect> = {
    upper_right: { x: 48, y: 0, width: 52, height: 55 },
    upper_left: { x: 0, y: 0, width: 52, height: 55 },
    lower_right: { x: 48, y: 45, width: 52, height: 55 },
    lower_left: { x: 0, y: 45, width: 52, height: 55 },
    camera_right: { x: 50, y: 10, width: 50, height: 80 },
    camera_left: { x: 0, y: 10, width: 50, height: 80 },
    front: { x: 15, y: 12, width: 70, height: 76 },
  };
  const key = dir.replace(/\s+/g, '_').toLowerCase();
  return {
    dimension: 'Lighting',
    label: `Key light · ${dir.replace(/_/g, ' ')}`,
    region: rects[key] ?? rects.upper_right,
    lightingDirection: dir,
    accentClass: 'text-amber-400',
    borderClass: 'border-amber-400',
    glowClass: 'shadow-[0_0_0_9999px_rgba(15,23,42,0.58)]',
  };
}

function techniqueRegion(analysis: StudioAnalysis): DimensionHighlight {
  const focus =
    analysis.boundingBoxes.find((b) => b.type === 'focus') ??
    analysis.boundingBoxes[0];
  const region: PercentRect = focus
    ? { x: focus.x, y: focus.y, width: focus.width, height: focus.height }
    : { x: 25, y: 28, width: 50, height: 44 };
  return {
    dimension: 'Technique',
    label: 'Focus & execution',
    region,
    accentClass: 'text-brand-300',
    borderClass: 'border-brand-300',
    glowClass: 'shadow-[0_0_0_9999px_rgba(26,24,22,0.62)]',
  };
}

function creativityRegion(): DimensionHighlight {
  return {
    dimension: 'Creativity',
    label: 'Creative vision (full frame)',
    region: { x: 5, y: 5, width: 90, height: 90 },
    accentClass: 'text-brand-500',
    borderClass: 'border-brand-500',
    glowClass: 'shadow-[0_0_0_9999px_rgba(26,24,22,0.45)]',
  };
}

function subjectHighlight(analysis: StudioAnalysis): DimensionHighlight {
  return {
    dimension: 'Subject',
    label: 'Subject impact',
    region: subjectRegion(analysis),
    accentClass: 'text-brand-400',
    borderClass: 'border-brand-400',
    glowClass: 'shadow-[0_0_0_9999px_rgba(26,24,22,0.62)]',
  };
}

export function getDimensionHighlight(
  dimension: string,
  analysis: StudioAnalysis,
): DimensionHighlight | null {
  switch (dimension) {
    case 'Composition':
      return compositionRegion(analysis);
    case 'Lighting':
      return lightingRegion(analysis);
    case 'Technique':
      return techniqueRegion(analysis);
    case 'Creativity':
      return creativityRegion();
    case 'Subject':
      return subjectHighlight(analysis);
    default:
      return null;
  }
}
