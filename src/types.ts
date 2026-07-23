export type RiskBand = '冲' | '稳' | '保' | '兜底';

export type RiskPreference = 'aggressive' | 'balanced' | 'conservative';

export type AdmissionType = 'regular' | 'early' | 'local';

export interface CandidateInput {
  province: string;
  year: number;
  track: string;
  score?: number;
  rank?: number;
  batchLine?: number;
  targetMajor: string;
  preferredCities: string[];
  preferredTiers: string[];
  riskPreference: RiskPreference;
  acceptsAdjustment: boolean;
  specialTypes: {
    sinoForeign: boolean;
    localPlan: boolean;
    earlyBatch: boolean;
  };
}

export interface AdmissionRecord {
  id: string;
  university: string;
  major: string;
  city: string;
  province: string;
  /** 该条最低录取位次所对应的生源省份（考生所在省），与院校所在地 province 不同。 */
  sourceProvince: string;
  /** 录取批次类型：普通批 / 提前批 / 地方专项，用于按考生意愿过滤。 */
  admissionType: AdmissionType;
  tier: string;
  category: string;
  publicSchool: boolean;
  doubleFirstClass: boolean;
  tuition: number;
  subjectRequirement: string;
  plan2026: number;
  planDelta: number;
  minScores: Record<number, number>;
  minRanks: Record<number, number>;
  restrictions: string[];
  source: string;
  updatedAt: string;
}

export type Volatility = 'low' | 'medium' | 'high';

export interface Recommendation extends AdmissionRecord {
  riskBand: RiskBand;
  matchScore: number;
  rankGap: number;
  averageMinRank: number;
  /** 近三年录取位次折合考生当年的等效分均值（同位分法）。 */
  equivalentScore?: number;
  /** 各年录取位次对应的等效分。 */
  equivalentScores?: Record<number, number>;
  /** 近三年录取位次波动程度，high 视为疑似大小年。 */
  volatility?: Volatility;
  reason: string;
  riskNote: string;
}

export type SortBy =
  | 'match'
  | 'risk'
  | 'tier'
  | 'city'
  | 'major'
  | 'tuition';

export interface RecommendationFilters {
  riskBands: RiskBand[];
  cities: string[];
  maxTuition?: number;
  publicOnly: boolean;
  doubleFirstClassOnly: boolean;
}

export interface RecommendationViewOptions {
  filters: RecommendationFilters;
  sortBy: SortBy;
}

export interface ReportDraft {
  inputSnapshot: CandidateInput;
  summary: {
    total: number;
    byBand: Record<RiskBand, number>;
    averageMatch: number;
  };
  candidates: Recommendation[];
  riskWarnings: string[];
  dataSources: string[];
  disclaimer: string;
}
