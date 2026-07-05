import type { AnalysisScores, MemoryUpdate, GroundingCitation } from './index';

export interface PortfolioListItem {
  id: string;
  userId: string;
  shootId: string;
  imageUrl: string;
  /**
   * The raw storage key (e.g. "photos/abc.jpg") this entry's critique was
   * saved under — NOT the signed/proxied imageUrl, which can rotate. This is
   * what mentor chat's photo_id must match, since app/mentor.py passes it
   * straight through as memory_store.recall(scope=photo_id) and the memory
   * that critique wrote used this same key as its scope (app/coach.py).
   */
  storageKey?: string;
  createdAt: string;
  scores: AnalysisScores;
  overallAverage: number;
  aestheticTags: string[];
  userTags: string[];
  sceneDescription?: string;
  colourNotes?: string | null;
  genre?: string;
  glassBoxSummary: string[];
  groundingCitations?: GroundingCitation[] | string[];
  groundingPrinciples?: string[];
  /** Present on entries analyzed after the narration slice shipped. */
  memoryUpdate?: MemoryUpdate | null;
}

export interface PortfolioListResponse {
  entries: PortfolioListItem[];
  total: number;
}

export interface PortfolioStats {
  total: number;
  firstUpload: string | null;
  strongest: PortfolioListItem | null;
}

export interface AestheticProfileSummary {
  photoCount: number;
  dominantTags: string[];
  averageScores: Partial<AnalysisScores>;
  stylisticConsistencyScore: number | null;
  computedAt?: string;
}

export interface PortfolioTrendDimension {
  key: string;
  label: string;
  values: number[];
  latest: number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'flat';
}

export interface PortfolioTrendsResponse {
  photoCount: number;
  points: { createdAt: string; overall: number }[];
  dimensions: PortfolioTrendDimension[];
  insufficientData: boolean;
}
