import type { AnalysisResult } from '../types';
import type { StudioAnalysis, StudioBoundingBox, EvidenceItem } from '../types/studio';
import { deriveDimensionCritique } from './deriveDimensionCritique';

/** Map spec-shaped API result → gemma4-style studio view model */
export function mapAnalysisResult(result: AnalysisResult): StudioAnalysis {
  const { scores, glassBox, spatialMetadata, aestheticTags } = result;

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
  const evidence: EvidenceItem[] = [];
  const est = result.settingsEstimate;
  if (est?.aperture && est.aperture !== 'unknown') {
    evidence.push({
      field: 'exposure',
      source: 'EXIF',
      value: `${est.aperture} · ${est.shutterSpeed} · ISO ${est.iso}`,
    });
  }
  if (est?.focalLength && est.focalLength !== 'unknown') {
    evidence.push({
      field: 'lens',
      source: 'EXIF',
      value: est.focalLength,
    });
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
    groundingPrinciples: glassBox.grounding_principles ?? [],
    groundingCitations: glassBox.grounding_citations ?? [],
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
