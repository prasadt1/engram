import type { AnalysisResult, GroundingCitation } from '../types';
import type { StudioAnalysis, StudioBoundingBox, EvidenceItem } from '../types/studio';
import { deriveDimensionCritique } from './deriveDimensionCritique';

function humanizePrincipleId(id: string): string {
  const known: Record<string, string> = {
    'composition.md': 'Composition',
    'lighting.md': 'Lighting',
    'technique.md': 'Technique',
    'creativity.md': 'Creativity',
    'subject_impact.md': 'Subject impact',
  };
  if (known[id]) return known[id];
  const base = id.replace(/\.md$/i, '').replace(/[-_]/g, ' ').trim();
  if (!base) return id;
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** API may send citation IDs only (strings) or full { id, title, excerpt } objects. */
function normalizeGroundingCitations(
  raw: GroundingCitation[] | string[] | undefined,
  principles: string[],
): StudioAnalysis['groundingCitations'] {
  const toCitation = (c: GroundingCitation | string) => {
    if (typeof c === 'string') {
      return { id: c, title: humanizePrincipleId(c), excerpt: '' };
    }
    const id = c.id ?? '';
    return {
      id,
      title: c.title?.trim() || humanizePrincipleId(id),
      excerpt: c.excerpt ?? '',
    };
  };

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(toCitation);
  }
  if (principles.length > 0) {
    return principles.map((id) => toCitation(id));
  }
  return [];
}

const GENRE_FALLBACK_PRINCIPLES: Record<string, string[]> = {
  landscape: ['composition.md', 'lighting.md', 'creativity.md'],
  portrait: ['composition.md', 'lighting.md', 'subject_impact.md'],
  street: ['composition.md', 'creativity.md', 'technique.md'],
  general: ['composition.md', 'lighting.md', 'technique.md'],
};

function readGroundingFromGlassBox(glassBox: AnalysisResult['glassBox']): {
  citations: GroundingCitation[] | string[] | undefined;
  principles: string[];
} {
  const raw = glassBox as unknown as Record<string, unknown>;
  const citations =
    glassBox.grounding_citations ??
    (raw.groundingCitations as GroundingCitation[] | string[] | undefined);
  const principles =
    glassBox.grounding_principles ??
    (raw.groundingPrinciples as string[] | undefined) ??
    [];
  return { citations, principles };
}

/** Map spec-shaped API result → gemma4-style studio view model */
export function mapAnalysisResult(result: AnalysisResult): StudioAnalysis {
  const { scores, glassBox, spatialMetadata, aestheticTags } = result;
  const { citations: rawCitations, principles: rawPrinciples } = readGroundingFromGlassBox(glassBox);
  const genreKey = (result.genre ?? 'general').toLowerCase();
  const fallbackPrinciples = GENRE_FALLBACK_PRINCIPLES[genreKey] ?? GENRE_FALLBACK_PRINCIPLES.general;
  let groundingCitations = normalizeGroundingCitations(rawCitations, rawPrinciples);
  if (groundingCitations.length === 0) {
    groundingCitations = normalizeGroundingCitations(undefined, fallbackPrinciples);
  }
  const groundingPrinciples =
    rawPrinciples.length > 0 ? rawPrinciples : groundingCitations.map((c) => c.id);

  const avg =
    (scores.composition +
      scores.lighting +
      scores.technique +
      scores.creativity +
      scores.subject_impact) /
    5;

  const boundingBoxes: StudioBoundingBox[] = spatialMetadata.annotations.map((a, i) => ({
    type: i === 0 ? 'composition' : 'exposure',
    severity: (a.severity === 'critical' || a.severity === 'moderate' || a.severity === 'minor'
      ? a.severity
      : 'moderate') as StudioBoundingBox['severity'],
    x: a.bbox.x,
    y: a.bbox.y,
    width: a.bbox.w,
    height: a.bbox.h,
    description: a.note,
    suggestion:
      glassBox.priority_fixes[i]?.issue ??
      glassBox.priority_fixes[0]?.issue ??
      'See Glass Box reasoning for guidance.',
  }));

  // EXIF/CV/coach signals only — principles live in groundingPrinciples (Glass Box panel).
  // Prefer REAL camera EXIF (app/exif_reader.py) when the upload carried it;
  // fall back to the vision model's settingsEstimate otherwise, but flag those
  // rows as estimated so the UI never presents a guess as camera-sourced fact.
  const evidence: EvidenceItem[] = [];
  const exif = result.exif;
  const hasRealExif = !!(
    exif &&
    (exif.aperture || exif.shutterSpeed || exif.iso || exif.focalLength || exif.make || exif.model)
  );
  if (hasRealExif && exif) {
    const exposure = [exif.aperture, exif.shutterSpeed, exif.iso].filter(Boolean).join(' · ');
    if (exposure) {
      evidence.push({ field: 'exposure', source: 'EXIF', value: exposure });
    }
    if (exif.focalLength) {
      evidence.push({ field: 'lens', source: 'EXIF', value: exif.focalLength });
    }
    const camera = [exif.make, exif.model].filter(Boolean).join(' ');
    if (camera) {
      evidence.push({ field: 'camera', source: 'EXIF', value: camera });
    }
  } else {
    const est = result.settingsEstimate;
    if (est?.aperture && est.aperture !== 'unknown') {
      evidence.push({
        field: 'exposure',
        source: 'EXIF',
        value: `${est.aperture} · ${est.shutterSpeed} · ISO ${est.iso}`,
        estimated: true,
      });
    }
    if (est?.focalLength && est.focalLength !== 'unknown') {
      evidence.push({
        field: 'lens',
        source: 'EXIF',
        value: est.focalLength,
        estimated: true,
      });
    }
  }

  const baseCritique = result.critique ?? {
      composition: `Composition scored ${scores.composition}/10. ${glassBox.observations[0] ?? ''}`,
      lighting: `Lighting scored ${scores.lighting}/10.`,
      technique: `Technique scored ${scores.technique}/10.`,
      overall: `Overall ${avg.toFixed(1)}/10. ${glassBox.observations.slice(0, 2).join(' ')}`,
    };

  const critique = {
    composition: baseCritique.composition,
    lighting: baseCritique.lighting,
    technique: baseCritique.technique,
    overall: baseCritique.overall,
    creativity: deriveDimensionCritique(
      'Creativity',
      scores.creativity,
      glassBox,
      result.strengths,
      result.improvements,
      baseCritique.overall,
    ),
    subjectImpact: deriveDimensionCritique(
      'Subject',
      scores.subject_impact,
      glassBox,
      result.strengths,
      result.improvements,
      baseCritique.overall,
    ),
  };

  return {
    sceneDescription: result.sceneDescription,
    colourNotes: result.colourNotes ?? null,
    genre: result.genre,
    scores: {
      composition: scores.composition,
      lighting: scores.lighting,
      technique: scores.technique,
      creativity: scores.creativity,
      subjectImpact: scores.subject_impact,
    },
    critique,
    strengths: result.strengths ?? glassBox.observations.slice(0, 3),
    improvements:
      result.improvements ??
      glassBox.priority_fixes.map((f) => f.issue),
    learningPath: result.learningPath ?? [
      'Practice deliberate framing using rule of thirds',
      'Control background separation on your next shoot',
      'Review lighting direction before each session',
    ],
    settingsEstimate: result.settingsEstimate ?? {
      focalLength: 'unknown',
      aperture: 'unknown',
      shutterSpeed: 'unknown',
      iso: 'unknown',
    },
    rationale: {
      observations: glassBox.observations,
      reasoningSteps: glassBox.reasoning_steps,
      priorityFixes: glassBox.priority_fixes.map((f) => `[${f.severity}] ${f.issue}`),
    },
    groundingPrinciples,
    groundingCitations,
    boundingBoxes,
    evidence,
    aestheticTags,
    subjectRelationships: spatialMetadata.subject_relationships,
    lightingMap: {
      key_light_direction: spatialMetadata.lighting_map.key_light_direction,
      fill_light_strength: spatialMetadata.lighting_map.fill_light_strength,
      rim_light_present: spatialMetadata.lighting_map.rim_light_present,
      color_temperature: spatialMetadata.lighting_map.color_temperature,
      shadow_character: spatialMetadata.lighting_map.shadow_character,
    },
  };
}

/** Build principle citations from portfolio list fields (gallery / photo detail). */
export function principlesFromPortfolio(
  groundingCitations: GroundingCitation[] | string[] | undefined,
  groundingPrinciples: string[] | undefined,
  genre?: string,
): StudioAnalysis['groundingCitations'] {
  const genreKey = (genre ?? 'general').toLowerCase();
  const fallback = GENRE_FALLBACK_PRINCIPLES[genreKey] ?? GENRE_FALLBACK_PRINCIPLES.general;
  let citations = normalizeGroundingCitations(groundingCitations, groundingPrinciples ?? []);
  if (citations.length === 0) {
    citations = normalizeGroundingCitations(undefined, fallback);
  }
  return citations;
}
