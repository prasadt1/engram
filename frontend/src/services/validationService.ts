/**
 * Validation Service
 * Zod schema validation for analysis results
 *
 * Phase 1.3: Ported from gemma4, validates Practice Companion data
 */

import { z } from 'zod';

// Zod schemas matching spec §7.2

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const SpatialAnnotationSchema = z.object({
  bbox: BoundingBoxSchema,
  severity: z.string(),
  note: z.string(),
});

export const SubjectRelationshipsSchema = z.object({
  primary_subject_position: z.string(),
  secondary_subjects: z.array(z.object({
    position: z.string(),
    relationship_to_primary: z.string(),
  })),
  depth_axis: z.string(),
  leading_lines_present: z.boolean(),
});

export const LightingMapSchema = z.object({
  key_light_direction: z.string(),
  fill_light_strength: z.enum(['absent', 'low', 'moderate', 'high']),
  rim_light_present: z.boolean(),
  color_temperature: z.enum(['warm', 'neutral', 'cool', 'mixed']),
  shadow_character: z.enum(['hard', 'soft', 'mixed']),
});

export const SpatialMetadataSchema = z.object({
  annotations: z.array(SpatialAnnotationSchema),
  subject_relationships: SubjectRelationshipsSchema,
  lighting_map: LightingMapSchema,
});

export const ScoresSchema = z.object({
  composition: z.number().min(0).max(10),
  lighting: z.number().min(0).max(10),
  technique: z.number().min(0).max(10),
  creativity: z.number().min(0).max(10),
  subject_impact: z.number().min(0).max(10),
});

export const PriorityFixSchema = z.object({
  severity: z.enum(['critical', 'moderate', 'minor']),
  issue: z.string(),
});

export const GlassBoxSchema = z.object({
  observations: z.array(z.string()),
  reasoning_steps: z.array(z.string()),
  priority_fixes: z.array(PriorityFixSchema),
  grounding_principles: z.array(z.string()).optional(),
});

export const AnalysisResultSchema = z.object({
  portfolioEntryId: z.string(),
  scores: ScoresSchema,
  glassBox: GlassBoxSchema,
  spatialMetadata: SpatialMetadataSchema,
  aestheticTags: z.array(z.string()),
});

/**
 * Validate analysis result against schema
 */
export function validateAnalysisResult(data: unknown): {
  valid: boolean;
  errors?: z.ZodError;
  data?: z.infer<typeof AnalysisResultSchema>;
} {
  try {
    const validated = AnalysisResultSchema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error };
    }
    throw error;
  }
}

/**
 * Validate scores are within expected range
 */
export function validateScores(scores: Record<string, number>): boolean {
  return Object.values(scores).every(score => score >= 0 && score <= 10);
}
