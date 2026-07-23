import { equivalentScore, scoreToRank } from './scoreRank';
import type {
  AdmissionRecord,
  CandidateInput,
  Recommendation,
  RecommendationFilters,
  RecommendationViewOptions,
  ReportDraft,
  RiskBand,
  SortBy,
  Volatility,
} from './types';

type RankSource = 'user' | 'table' | 'estimate';

const riskOrder: RiskBand[] = ['冲', '稳', '保', '兜底'];

export const NO_RANK_WARNING = '建议补充全省位次，系统将优先使用位次进行推荐。';

const FIRST_CHOICE_SUBJECTS = ['物理', '历史'];
const SUBJECT_BY_CHAR: Record<string, string> = {
  物: '物理',
  史: '历史',
  历: '历史',
  化: '化学',
  生: '生物',
  地: '地理',
  政: '政治',
};

export function validateCandidateInput(input: CandidateInput): string[] {
  const errors: string[] = [];

  if (!input.province.trim()) errors.push('请选择生源省份。');
  if (!input.track.trim()) errors.push('请选择科类或选科组合。');
  if (!input.score && !input.rank) errors.push('请至少填写高考分数或全省位次。');
  if (input.score && !input.rank) {
    errors.push(NO_RANK_WARNING);
  }
  if (!input.targetMajor.trim()) errors.push('请填写目标专业或专业类。');

  return errors;
}

export function generateRecommendations(
  input: CandidateInput,
  records: AdmissionRecord[],
): Recommendation[] {
  return records
    .filter((record) => isRecordEligible(input, record))
    .map((record) => enrichRecord(input, record))
    .sort((a, b) => {
      const byBand = getRiskOrderValue(a.riskBand) - getRiskOrderValue(b.riskBand);
      return byBand !== 0 ? byBand : b.matchScore - a.matchScore;
    });
}

export function applyRecommendationView(
  recommendations: Recommendation[],
  options: RecommendationViewOptions,
): Recommendation[] {
  return recommendations
    .filter((item) => matchesFilters(item, options.filters))
    .sort((a, b) => compareRecommendations(a, b, options.sortBy));
}

export function buildReportDraft(
  input: CandidateInput,
  candidates: Recommendation[],
): ReportDraft {
  const byBand = riskOrder.reduce(
    (acc, band) => ({ ...acc, [band]: candidates.filter((item) => item.riskBand === band).length }),
    { 冲: 0, 稳: 0, 保: 0, 兜底: 0 } as Record<RiskBand, number>,
  );
  const averageMatch =
    candidates.length === 0
      ? 0
      : Math.round(candidates.reduce((sum, item) => sum + item.matchScore, 0) / candidates.length);

  return {
    inputSnapshot: input,
    summary: {
      total: candidates.length,
      byBand,
      averageMatch,
    },
    candidates,
    riskWarnings: [
      '推荐结果以位次和样例招生数据为核心生成，仅用于本地 MVP 演示。',
      '院校招生计划、选科要求、章程限制可能变化，正式填报前必须核对官方来源。',
      '冲刺项风险较高，建议保留足够的保底与兜底志愿梯度。',
    ],
    dataSources: Array.from(new Set(candidates.map((item) => `${item.source}（${item.updatedAt}）`))),
    disclaimer:
      '本报告为高考志愿辅助决策参考，不构成录取承诺，不替代各省教育考试院、教育部阳光高考平台及高校官方信息。',
  };
}

export function getRiskOrderValue(riskBand: RiskBand): number {
  return riskOrder.indexOf(riskBand);
}

/** 从科类/选科组合推导考生的首选科目与（若提供完整组合）再选科目。 */
export function deriveCandidateSubjects(track: string): { first: string; subjects: string[] } {
  const trimmed = track.trim();
  const first = trimmed.includes('历史') ? '历史' : '物理';
  // “物理类 / 历史类”仅说明首选科目；“物化生 / 物化地”才是完整三科组合。
  if (!trimmed || trimmed.endsWith('类')) {
    return { first, subjects: [first] };
  }
  const parsed = Array.from(trimmed)
    .map((char) => SUBJECT_BY_CHAR[char])
    .filter((subject): subject is string => Boolean(subject));
  return { first, subjects: Array.from(new Set([first, ...parsed])) };
}

export function parseSubjectRequirement(requirement: string): string[] {
  return requirement
    .split(/[+/、，,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecordEligible(input: CandidateInput, record: AdmissionRecord): boolean {
  // 录取位次有省份属性，跨省比较没有意义，先按生源省份过滤。
  if (input.province.trim() && record.sourceProvince !== input.province) return false;

  if (!matchesAdmissionType(input, record)) return false;
  if (!matchesSubjectRequirement(input.track, record.subjectRequirement)) return false;

  const major = input.targetMajor.trim();
  const targetMajorMatched =
    !major || record.major.includes(major) || record.category.includes(major) || major.includes(record.category);
  if (!targetMajorMatched) return false;

  const acceptsSinoForeign = input.specialTypes.sinoForeign || !record.major.includes('中外合作');
  return acceptsSinoForeign;
}

function matchesAdmissionType(input: CandidateInput, record: AdmissionRecord): boolean {
  if (record.admissionType === 'early') return input.specialTypes.earlyBatch;
  if (record.admissionType === 'local') return input.specialTypes.localPlan;
  return true;
}

function matchesSubjectRequirement(track: string, requirement: string): boolean {
  const required = parseSubjectRequirement(requirement);
  if (!required.length) return true;

  const { first, subjects } = deriveCandidateSubjects(track);

  // 首选科目（物理/历史）是硬性门槛，不符合直接不可报。
  const requiredFirst = required.find((subject) => FIRST_CHOICE_SUBJECTS.includes(subject));
  if (requiredFirst && requiredFirst !== first) return false;

  // 再选科目仅在考生提供了完整选科组合时强校验，否则给予通过（避免误杀“物理类”这类只填首选的考生）。
  if (subjects.length > 1) {
    const electives = required.filter((subject) => !FIRST_CHOICE_SUBJECTS.includes(subject));
    if (!electives.every((subject) => subjects.includes(subject))) return false;
  }
  return true;
}

function enrichRecord(input: CandidateInput, record: AdmissionRecord): Recommendation {
  const minRankValues = Object.values(record.minRanks);
  const averageMinRank = average(minRankValues);
  const { rank: effectiveRank, source: rankSource } = resolveEffectiveRank(input);
  const rankGap = Math.round(effectiveRank - averageMinRank);
  const riskBand = classifyRiskBand(effectiveRank, averageMinRank, input);
  const volatility = assessVolatility(minRankValues, averageMinRank);
  const equivalentScores = computeEquivalentScores(input, record.minRanks);
  const averageEquivalent = averageEquivalentScore(equivalentScores);
  const matchScore = scoreRecord(input, record, riskBand, rankGap, averageMinRank, rankSource, volatility);
  const years = Object.keys(record.minRanks).sort().join(' / ');
  const rankText =
    rankSource === 'user'
      ? `用户全省位次 ${input.rank!.toLocaleString('zh-CN')}`
      : rankSource === 'table'
        ? `用户未填位次，按一分一段表估算约 ${effectiveRank.toLocaleString('zh-CN')} 名`
        : `用户未填位次，按分数粗估约 ${effectiveRank.toLocaleString('zh-CN')} 名（精度有限，建议补充位次）`;
  const equivalentText =
    averageEquivalent != null ? `；历年录取位次折合今年约 ${averageEquivalent} 分（等效分）` : '';

  return {
    ...record,
    riskBand,
    matchScore,
    rankGap,
    averageMinRank,
    equivalentScore: averageEquivalent,
    equivalentScores: Object.keys(equivalentScores).length ? equivalentScores : undefined,
    volatility,
    reason: `${rankText}，近三年（${years}）最低录取位次均值约 ${Math.round(
      averageMinRank,
    ).toLocaleString('zh-CN')}${equivalentText}；招生计划${record.planDelta >= 0 ? '增加' : '减少'} ${
      Math.abs(record.planDelta)
    } 人，专业方向与“${input.targetMajor || record.category}”匹配。`,
    riskNote: buildRiskNote(riskBand, record, input, volatility),
  };
}

function resolveEffectiveRank(input: CandidateInput): { rank: number; source: RankSource } {
  if (input.rank) return { rank: input.rank, source: 'user' };
  if (input.score != null) {
    const fromTable = scoreToRank(input.province, input.year, input.track, input.score);
    if (fromTable != null) return { rank: fromTable, source: 'table' };
  }
  return { rank: estimateRankFromScore(input.score, input.batchLine), source: 'estimate' };
}

function computeEquivalentScores(
  input: CandidateInput,
  minRanks: Record<number, number>,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [year, rank] of Object.entries(minRanks)) {
    const eq = equivalentScore(input, rank);
    if (eq != null) out[Number(year)] = eq;
  }
  return out;
}

function averageEquivalentScore(scores: Record<number, number>): number | undefined {
  const values = Object.values(scores);
  return values.length ? Math.round(average(values)) : undefined;
}

function assessVolatility(ranks: number[], mean: number): Volatility {
  if (ranks.length < 2 || mean <= 0) return 'low';
  const spread = (Math.max(...ranks) - Math.min(...ranks)) / mean;
  if (spread > 0.25) return 'high';
  if (spread > 0.12) return 'medium';
  return 'low';
}

function classifyRiskBand(
  userRank: number,
  averageMinRank: number,
  input: CandidateInput,
): RiskBand {
  if (averageMinRank <= 0) return '稳';

  // 以“位次相对差”为主轴，使阈值在不同分数段都成立（正值=考生位次高于录取线、更难=冲）。
  const preferenceShift =
    input.riskPreference === 'aggressive' ? -0.06 : input.riskPreference === 'conservative' ? 0.06 : 0;
  const adjustmentShift = input.acceptsAdjustment ? 0 : 0.03;
  const ratio = (userRank - averageMinRank) / averageMinRank + preferenceShift + adjustmentShift;

  if (ratio > 0.1) return '冲';
  if (ratio > -0.1) return '稳';
  if (ratio > -0.3) return '保';
  return '兜底';
}

function scoreRecord(
  input: CandidateInput,
  record: AdmissionRecord,
  riskBand: RiskBand,
  rankGap: number,
  averageMinRank: number,
  rankSource: RankSource,
  volatility: Volatility,
): number {
  const bandBase: Record<RiskBand, number> = { 冲: 58, 稳: 82, 保: 88, 兜底: 74 };
  const cityBoost = input.preferredCities.includes(record.city) ? 8 : 0;
  const tierBoost = input.preferredTiers.some((tier) => record.tier.includes(tier)) ? 6 : 0;
  const planBoost = Math.max(-5, Math.min(8, record.planDelta));
  const majorBoost =
    record.major.includes(input.targetMajor) || record.category.includes(input.targetMajor) ? 8 : 3;
  const rankPenalty =
    riskBand === '冲' && averageMinRank > 0
      ? Math.min(18, Math.round((Math.max(rankGap, 0) / averageMinRank) * 16))
      : 0;
  const restrictionPenalty = record.restrictions.length > 0 ? 3 : 0;
  // 不服从调剂时，冲刺项的退档风险更高，相应下调匹配度。
  const adjustmentPenalty = !input.acceptsAdjustment && riskBand === '冲' ? 6 : 0;
  // 位次来源越不可靠，置信度越低：用户填报 0、一分一段表 2、纯分数估算 6。
  const confidencePenalty = rankSource === 'user' ? 0 : rankSource === 'table' ? 2 : 6;
  // 大小年波动较大时略降匹配度。
  const volatilityPenalty = volatility === 'high' ? 3 : 0;

  return clamp(
    Math.round(
      bandBase[riskBand] +
        cityBoost +
        tierBoost +
        planBoost +
        majorBoost -
        rankPenalty -
        restrictionPenalty -
        adjustmentPenalty -
        confidencePenalty -
        volatilityPenalty,
    ),
    35,
    98,
  );
}

function buildRiskNote(
  riskBand: RiskBand,
  record: AdmissionRecord,
  input: CandidateInput,
  volatility: Volatility,
): string {
  const prefix: Record<RiskBand, string> = {
    冲: '有机会但风险较高，建议仅放在前段冲刺。',
    稳: '匹配度较高，仍需关注当年计划和热度变化。',
    保: '录取把握相对较高，适合作为中后段梯度。',
    兜底: '用于降低滑档风险，建议至少保留 1-2 个。',
  };
  const restrictionText = record.restrictions.length ? ` 特殊限制：${record.restrictions.join('、')}。` : '';
  const adjustmentText =
    riskBand === '冲' && !input.acceptsAdjustment ? ' 已选择不服从调剂，冲刺项退档风险更高。' : '';
  const volatilityText =
    volatility === 'high' ? ' 近三年录取位次波动较大（疑似大小年），建议谨慎评估。' : '';
  return `${prefix[riskBand]}${restrictionText}${adjustmentText}${volatilityText}`;
}

function matchesFilters(item: Recommendation, filters: RecommendationFilters): boolean {
  if (filters.riskBands.length && !filters.riskBands.includes(item.riskBand)) return false;
  if (filters.cities.length && !filters.cities.includes(item.city)) return false;
  if (filters.maxTuition && item.tuition > filters.maxTuition) return false;
  if (filters.publicOnly && !item.publicSchool) return false;
  if (filters.doubleFirstClassOnly && !item.doubleFirstClass) return false;
  return true;
}

function compareRecommendations(a: Recommendation, b: Recommendation, sortBy: SortBy): number {
  switch (sortBy) {
    case 'risk':
      return getRiskOrderValue(a.riskBand) - getRiskOrderValue(b.riskBand) || b.matchScore - a.matchScore;
    case 'tier':
      return tierWeight(b.tier) - tierWeight(a.tier);
    case 'city':
      return a.city.localeCompare(b.city, 'zh-CN');
    case 'major':
      return a.major.localeCompare(b.major, 'zh-CN');
    case 'tuition':
      return a.tuition - b.tuition;
    case 'match':
    default:
      return b.matchScore - a.matchScore;
  }
}

function tierWeight(tier: string): number {
  if (tier.includes('985')) return 4;
  if (tier.includes('211')) return 3;
  if (tier.includes('双一流')) return 2;
  if (tier.includes('省重点')) return 1;
  return 0;
}

function estimateRankFromScore(score?: number, batchLine?: number): number {
  if (!score) return 50000;
  const line = batchLine ?? 490;
  const aboveLine = Math.max(0, score - line);
  return clamp(Math.round(100000 - aboveLine * 650), 3000, 100000);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
