/**
 * Ported from photography-coach-gemma4/services/xmpService.ts
 * Iris XMP sidecar export; uses StudioAnalysis view model.
 */

import type { StudioAnalysis } from '../types/studio';

export function scoreToStarRating(scores: StudioAnalysis['scores']): number {
  const avg =
    (scores.composition +
      scores.lighting +
      scores.technique +
      scores.creativity +
      scores.subjectImpact) /
    5;
  if (avg >= 8) return 5;
  if (avg >= 6) return 4;
  if (avg >= 4) return 3;
  if (avg >= 2) return 2;
  return 1;
}

export function severityToColorLabel(analysis: StudioAnalysis): string {
  if (!analysis.boundingBoxes.length) return 'Green';
  if (analysis.boundingBoxes.some((b) => b.severity === 'critical')) return 'Red';
  if (analysis.boundingBoxes.some((b) => b.severity === 'moderate')) return 'Yellow';
  return 'Green';
}

function extractKeywords(analysis: StudioAnalysis): string[] {
  return analysis.rationale.observations.slice(0, 5).map((obs) => {
    const cleaned = obs.replace(/^(I observe|I notice|There is)/i, '').trim();
    const first = cleaned.split(/[.!?]/)[0];
    return (first && first.length < 100 ? first : cleaned).slice(0, 80);
  });
}

function generateDescription(analysis: StudioAnalysis): string {
  const rating = scoreToStarRating(analysis.scores);
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const scene = analysis.sceneDescription
    ? `What I see: ${analysis.sceneDescription}\n\n`
    : '';
  return `${stars} Iris Critique\n\n${scene}${analysis.critique.overall}\n\nScores: Composition ${analysis.scores.composition}/10, Lighting ${analysis.scores.lighting}/10`;
}

function generateXMP(analysis: StudioAnalysis, originalFilename: string): string {
  const rating = scoreToStarRating(analysis.scores);
  const colorLabel = severityToColorLabel(analysis);
  const keywords = extractKeywords(analysis);
  const description = generateDescription(analysis);
  const escapeXML = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const timestamp = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
      <xmp:Rating>${rating}</xmp:Rating>
      <xmp:Label>${colorLabel}</xmp:Label>
      <xmp:ModifyDate>${timestamp}</xmp:ModifyDate>
      <xmp:CreatorTool>Iris</xmp:CreatorTool>
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXML(description)}</rdf:li>
        </rdf:Alt>
      </dc:description>
      <dc:subject>
        <rdf:Bag>
${keywords.map((kw) => `          <rdf:li>${escapeXML(kw)}</rdf:li>`).join('\n')}
        </rdf:Bag>
      </dc:subject>
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXML(originalFilename)}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <photoshop:Headline>${escapeXML(analysis.critique.overall.split('.')[0] ?? 'AI Critique')}</photoshop:Headline>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
}

export function exportXMPSidecar(
  analysis: StudioAnalysis,
  originalFilename: string,
): { filename: string; content: string } {
  const base = originalFilename.replace(/\.[^.]+$/, '');
  return {
    filename: `${base}.xmp`,
    content: generateXMP(analysis, originalFilename),
  };
}
