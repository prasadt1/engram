/**
 * Studio display model — adapted from photography-coach-gemma4 types.v2
 * Mapped from AnalysisResult (spec §7.2) for UI components.
 */

export type BoxSeverity = 'critical' | 'moderate' | 'minor';

export interface StudioBoundingBox {
  type: 'composition' | 'lighting' | 'focus' | 'exposure' | 'color';
  severity: BoxSeverity;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
  suggestion: string;
}

export interface EvidenceItem {
  field: string;
  source: 'EXIF' | 'CV' | 'Coach';
  value: string;
  confidence?: number;
}

export interface StudioScores {
  composition: number;
  lighting: number;
  technique: number;
  creativity: number;
  subjectImpact: number;
}

export interface StudioCritique {
  composition: string;
  lighting: string;
  technique: string;
  creativity: string;
  subjectImpact: string;
  overall: string;
}

export interface StudioAnalysis {
  sceneDescription?: string;
  colourNotes?: string | null;
  /** Primary subject genre classification (Coach agent), e.g. "landscape" */
  genre?: string;
  scores: StudioScores;
  critique: StudioCritique;
  strengths: string[];
  improvements: string[];
  learningPath: string[];
  settingsEstimate: {
    focalLength: string;
    aperture: string;
    shutterSpeed: string;
    iso: string;
  };
  rationale: {
    observations: string[];
    reasoningSteps: string[];
    priorityFixes: string[];
  };
  groundingPrinciples: string[];
  groundingCitations: Array<{ id: string; title: string; excerpt: string }>;
  boundingBoxes: StudioBoundingBox[];
  evidence: EvidenceItem[];
  aestheticTags: string[];
  subjectRelationships: {
    primary_subject_position: string;
    secondary_subjects: Array<{ position: string; relationship_to_primary: string }>;
    depth_axis: string;
    leading_lines_present: boolean;
  };
  lightingMap: {
    key_light_direction: string;
    fill_light_strength: string;
    rim_light_present: boolean;
    color_temperature: string;
    shadow_character: string;
  };
}
