import type {
  CandidateInput,
  Recommendation,
  ReportDraft,
  RiskBand,
} from './types';

export interface RecommendationApiResponse {
  validationMessages: string[];
  recommendations: Recommendation[];
  summary: ReportDraft['summary'];
  dataVersion: {
    name: string;
    updated_at: string;
    record_count: number;
  } | null;
}

export interface OptionsApiResponse {
  provinces: string[];
  tracks: string[];
  cities: string[];
  tiers: string[];
  majors: string[];
}

export interface AdminOverview {
  dataVersion: {
    id: string;
    name: string;
    source: string;
    updatedAt: string;
    recordCount: number;
  } | null;
  tables: {
    admissionRecords: number;
    scoreSegments: number;
  };
  ruleConfig: {
    strategy?: string;
    bands?: RiskBand[];
    note?: string;
  } | null;
  recentImports: Array<{
    type: string;
    status: string;
    message: string;
    created_at: string;
  }>;
}

export async function fetchOptions() {
  return requestJson<OptionsApiResponse>('/api/options');
}

export async function fetchRecommendations(input: CandidateInput) {
  return requestJson<RecommendationApiResponse>('/api/recommendations', {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function fetchReport(input: CandidateInput, candidateIds: string[]) {
  return requestJson<ReportDraft>('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ input, candidateIds }),
  });
}

export async function fetchAdminOverview() {
  return requestJson<AdminOverview>('/api/admin/overview');
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error ?? `API request failed with ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}
