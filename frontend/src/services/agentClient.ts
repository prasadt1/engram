/**
 * Studio analysis — Phase 2: Coach API (FastAPI) with mock fallback.
 */

import type { AnalysisResult } from '../types';
import { apiFetch } from '../lib/apiFetch';

export interface AnalyzePhotoRequest {
  imageFile: File;
  userId?: string;
  shootId?: string;
  assignmentId?: string;
  signal?: AbortSignal;
}

export type AnalyzePhotoResponse = AnalysisResult;

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

async function analyzePhotoMock(request: AnalyzePhotoRequest): Promise<AnalyzePhotoResponse> {
  console.log('analyzePhoto (mock):', request.imageFile.name);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 2000);
    request.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

  return {
    portfolioEntryId: `mock_${Date.now()}`,
    sceneDescription:
      'A portrait-oriented photograph of a person from the chest up, framed slightly off-center. ' +
      'The background is softly blurred greenery with dappled natural light. ' +
      'Soft daylight from camera-right models the face with gentle shadows.',
    colourNotes:
      'Warm skin tones against cool green background; overall natural, slightly golden white balance.',
    scores: {
      composition: 6.5,
      lighting: 7.2,
      technique: 5.8,
      creativity: 6.0,
      subject_impact: 7.5,
    },
    critique: {
      overall:
        'Strong natural light and subject separation, but composition could use more deliberate negative space on the left.',
      composition:
        'Subject sits slightly off-center; dynamic tension works, yet the frame lacks a clear leading line into the subject.',
      lighting:
        'Soft key from camera-right with low fill creates gentle modeling; watch highlight roll-off on the cheek.',
      technique:
        'Shallow depth of field is effective; ensure critical focus lands on the nearest eye.',
    },
    strengths: [
      'Effective shallow depth of field isolates the subject',
      'Natural direction of light adds dimension',
      'Warm color harmony supports portrait mood',
    ],
    improvements: [
      'Place subject on right third to balance left negative space',
      'Reduce competing background element upper-right',
      'Increase intentional eye-line connection with viewer',
    ],
    learningPath: [
      'Rule of thirds with portrait subjects',
      'Background scanning before shutter',
      'Fill light control for outdoor portraits',
    ],
    settingsEstimate: {
      focalLength: '85mm',
      aperture: 'f/2.8',
      shutterSpeed: '1/250s',
      iso: '400',
    },
    glassBox: {
      observations: [
        'Subject positioned slightly off-center, creating dynamic tension',
        'Natural lighting from camera right provides good separation',
        'Shallow depth of field effectively isolates the subject',
      ],
      reasoning_steps: [
        'Analyzed compositional elements using rule of thirds framework',
        'Evaluated lighting quality and direction relative to subject',
        'Assessed technical execution (focus, exposure, sharpness)',
      ],
      priority_fixes: [
        {
          severity: 'moderate',
          issue:
            'Reframe to place subject on right third for stronger lead-in from left negative space',
        },
      ],
      grounding_principles: ['composition.md', 'lighting.md', 'subject_impact.md'],
    },
    spatialMetadata: {
      annotations: [
        {
          bbox: { x: 28, y: 18, w: 38, h: 52 },
          severity: 'moderate',
          note: 'Primary subject — focus plane',
        },
      ],
      subject_relationships: {
        primary_subject_position: 'center_slight_right',
        secondary_subjects: [],
        depth_axis: 'foreground_midground',
        leading_lines_present: false,
      },
      lighting_map: {
        key_light_direction: 'upper_right',
        fill_light_strength: 'low',
        rim_light_present: false,
        color_temperature: 'warm',
        shadow_character: 'soft',
      },
    },
    aestheticTags: ['portrait', 'shallow_dof', 'natural_light'],
  };
}

export async function analyzePhoto(request: AnalyzePhotoRequest): Promise<AnalyzePhotoResponse> {
  if (USE_MOCK) {
    return analyzePhotoMock(request);
  }

  const form = new FormData();
  form.append('image', request.imageFile);
  if (request.userId) form.append('user_id', request.userId);
  if (request.shootId) form.append('shoot_id', request.shootId);
  if (request.assignmentId) form.append('assignment_id', request.assignmentId);

  const response = await apiFetch('/api/v1/analyze-photo', {
    method: 'POST',
    body: form,
    signal: request.signal,
    // Cloud Run Coach pipeline (Gemini + GCS + embeddings) often exceeds 45s.
    // Backend now bounds this explicitly, but the true worst case is a
    // sequential chain, not just one vision call:
    //   1. chat_vision runs once: 60s (+1 timeout-retry) = 120s worst case.
    //   2. parse_json_with_repair on the vision output: if malformed, _repair
    //      calls chat_fast once: 30s (+1 retry) = 60s worst case.
    //   3. If pydantic validation then fails, chat_text does a shape-repair
    //      pass: 40s (+1 retry) = 80s worst case.
    //   4. parse_json_with_repair runs again on the shape-repair output: if
    //      that JSON is also malformed, _repair can call chat_fast a SECOND
    //      time: 30s (+1 retry) = 60s worst case.
    // 120 + 60 + 80 + 60 = 320s true worst case. 350s gives ~30s of margin
    // for network/processing overhead on top of that.
    timeoutMs: 350_000,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Analysis failed (${response.status})`);
  }

  return response.json() as Promise<AnalyzePhotoResponse>;
}
