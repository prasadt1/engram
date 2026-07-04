import type { AnalysisScores } from './index';

export interface PortfolioListItem {
  id: string;
  userId: string;
  shootId: string;
  imageUrl: string;
  createdAt: string;
  scores: AnalysisScores;
  overallAverage: number;
  aestheticTags: string[];
  userTags: string[];
  sceneDescription?: string;
  colourNotes?: string | null;
  glassBoxSummary: string[];
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
