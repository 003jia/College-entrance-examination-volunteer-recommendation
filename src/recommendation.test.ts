import { describe, expect, it } from 'vitest';
import {
  applyRecommendationView,
  buildReportDraft,
  generateRecommendations,
  validateCandidateInput,
} from './recommendation';
import type { AdmissionRecord, CandidateInput } from './types';

const baseInput: CandidateInput = {
  province: '浙江',
  year: 2026,
  track: '物理类',
  score: 615,
  rank: 21000,
  batchLine: 492,
  targetMajor: '计算机',
  preferredCities: ['杭州', '南京'],
  preferredTiers: ['双一流', '省重点'],
  riskPreference: 'balanced',
  acceptsAdjustment: true,
  specialTypes: {
    sinoForeign: false,
    localPlan: false,
    earlyBatch: false,
  },
};

const fixtureRecords: AdmissionRecord[] = [
  {
    id: 'zju-cs',
    university: '浙江大学',
    major: '工科试验班（信息）',
    city: '杭州',
    province: '浙江',
    sourceProvince: '浙江',
    admissionType: 'regular',
    tier: '985 / 双一流',
    category: '计算机类',
    publicSchool: true,
    doubleFirstClass: true,
    tuition: 6900,
    subjectRequirement: '物理 + 化学',
    plan2026: 24,
    planDelta: -2,
    minScores: { 2023: 665, 2024: 668, 2025: 670 },
    minRanks: { 2023: 4300, 2024: 3900, 2025: 3600 },
    restrictions: ['竞争极高'],
    source: '高校招生官网样例',
    updatedAt: '2026-06-01',
  },
  {
    id: 'nju-ai',
    university: '南京理工大学',
    major: '人工智能',
    city: '南京',
    province: '江苏',
    sourceProvince: '浙江',
    admissionType: 'regular',
    tier: '211 / 双一流',
    category: '计算机类',
    publicSchool: true,
    doubleFirstClass: true,
    tuition: 6380,
    subjectRequirement: '物理 + 化学',
    plan2026: 48,
    planDelta: 6,
    minScores: { 2023: 627, 2024: 625, 2025: 629 },
    minRanks: { 2023: 18200, 2024: 19000, 2025: 17600 },
    restrictions: [],
    source: '教育考试院样例',
    updatedAt: '2026-06-02',
  },
  {
    id: 'hznu-cs',
    university: '杭州师范大学',
    major: '计算机科学与技术',
    city: '杭州',
    province: '浙江',
    sourceProvince: '浙江',
    admissionType: 'regular',
    tier: '省重点',
    category: '计算机类',
    publicSchool: true,
    doubleFirstClass: false,
    tuition: 6000,
    subjectRequirement: '物理 + 化学',
    plan2026: 92,
    planDelta: 12,
    minScores: { 2023: 602, 2024: 607, 2025: 608 },
    minRanks: { 2023: 25400, 2024: 23800, 2025: 23200 },
    restrictions: [],
    source: '教育考试院样例',
    updatedAt: '2026-06-02',
  },
  {
    id: 'zjut-data',
    university: '浙江工业大学',
    major: '数据科学与大数据技术',
    city: '杭州',
    province: '浙江',
    sourceProvince: '浙江',
    admissionType: 'regular',
    tier: '省重点',
    category: '计算机类',
    publicSchool: true,
    doubleFirstClass: false,
    tuition: 6000,
    subjectRequirement: '物理 + 化学',
    plan2026: 86,
    planDelta: 10,
    minScores: { 2023: 611, 2024: 614, 2025: 616 },
    minRanks: { 2023: 22100, 2024: 21400, 2025: 20500 },
    restrictions: [],
    source: '教育考试院样例',
    updatedAt: '2026-06-04',
  },
  {
    id: 'nbu-software',
    university: '宁波大学',
    major: '软件工程',
    city: '宁波',
    province: '浙江',
    sourceProvince: '浙江',
    admissionType: 'regular',
    tier: '双一流',
    category: '计算机类',
    publicSchool: true,
    doubleFirstClass: true,
    tuition: 6900,
    subjectRequirement: '物理 + 化学',
    plan2026: 64,
    planDelta: 8,
    minScores: { 2023: 596, 2024: 598, 2025: 600 },
    minRanks: { 2023: 31200, 2024: 30000, 2025: 29200 },
    restrictions: [],
    source: '高校招生官网样例',
    updatedAt: '2026-06-03',
  },
  {
    id: 'jxut-network',
    university: '嘉兴大学',
    major: '网络工程',
    city: '嘉兴',
    province: '浙江',
    sourceProvince: '浙江',
    admissionType: 'regular',
    tier: '普通本科',
    category: '计算机类',
    publicSchool: true,
    doubleFirstClass: false,
    tuition: 5500,
    subjectRequirement: '物理 + 化学',
    plan2026: 116,
    planDelta: 16,
    minScores: { 2023: 562, 2024: 568, 2025: 570 },
    minRanks: { 2023: 76000, 2024: 72000, 2025: 69000 },
    restrictions: [],
    source: '教育考试院样例',
    updatedAt: '2026-06-02',
  },
  {
    id: 'zj-early',
    university: '某提前批院校',
    major: '信息安全',
    city: '杭州',
    province: '浙江',
    sourceProvince: '浙江',
    admissionType: 'early',
    tier: '211 / 双一流',
    category: '计算机类',
    publicSchool: true,
    doubleFirstClass: true,
    tuition: 6600,
    subjectRequirement: '物理 + 化学',
    plan2026: 30,
    planDelta: 2,
    minScores: { 2023: 628, 2024: 630, 2025: 632 },
    minRanks: { 2023: 16000, 2024: 15500, 2025: 15000 },
    restrictions: ['提前批样例'],
    source: '高校招生官网样例',
    updatedAt: '2026-06-03',
  },
  {
    id: 'zj-local',
    university: '某地方专项院校',
    major: '计算机科学与技术',
    city: '丽水',
    province: '浙江',
    sourceProvince: '浙江',
    admissionType: 'local',
    tier: '普通本科',
    category: '计算机类',
    publicSchool: true,
    doubleFirstClass: false,
    tuition: 5200,
    subjectRequirement: '物理 + 化学',
    plan2026: 40,
    planDelta: 5,
    minScores: { 2023: 575, 2024: 578, 2025: 580 },
    minRanks: { 2023: 61000, 2024: 59000, 2025: 58000 },
    restrictions: ['地方专项样例'],
    source: '教育考试院样例',
    updatedAt: '2026-06-02',
  },
];

describe('recommendation rules', () => {
  it('returns every eligible record sorted into risk bands with explanations', () => {
    const results = generateRecommendations(baseInput, fixtureRecords);

    // 默认不勾选提前批/地方专项 → 仅普通批的 6 条进入结果。
    expect(results).toHaveLength(6);
    expect(results.map((item) => item.riskBand)).toEqual(['冲', '冲', '稳', '保', '兜底', '兜底']);
    expect(new Set(results.map((item) => item.riskBand))).toEqual(
      new Set(['冲', '稳', '保', '兜底']),
    );
    expect(results[0].reason).toContain('全省位次');
    // 同一档位内按匹配度从高到低排序。
    expect(results[0].matchScore).toBeGreaterThanOrEqual(results[1].matchScore);
    // 位次法：每条推荐都带历年录取位次折合今年的等效分。
    expect(results.every((item) => typeof item.equivalentScore === 'number' && item.equivalentScore > 0)).toBe(true);
  });

  it('excludes records that do not match the candidate first-choice subject', () => {
    const history = generateRecommendations({ ...baseInput, track: '历史类' }, fixtureRecords);
    expect(history).toHaveLength(0);
  });

  it('excludes records from other source provinces', () => {
    const jiangsu = generateRecommendations({ ...baseInput, province: '江苏' }, fixtureRecords);
    expect(jiangsu).toHaveLength(0);
  });

  it('only includes early-batch records when the candidate opts in', () => {
    const off = generateRecommendations(baseInput, fixtureRecords);
    expect(off.some((item) => item.id === 'zj-early')).toBe(false);

    const on = generateRecommendations(
      { ...baseInput, specialTypes: { ...baseInput.specialTypes, earlyBatch: true } },
      fixtureRecords,
    );
    expect(on.some((item) => item.id === 'zj-early')).toBe(true);
  });

  it('flags 大小年 volatility when historical ranks swing widely', () => {
    const volatileRecord: AdmissionRecord = {
      ...fixtureRecords[0],
      id: 'volatile',
      minRanks: { 2023: 30000, 2024: 18000, 2025: 28000 },
    };
    const [rec] = generateRecommendations(baseInput, [volatileRecord]);

    expect(rec.volatility).toBe('high');
    expect(rec.riskNote).toContain('大小年');
  });

  it('warns when score is present but rank is missing', () => {
    const errors = validateCandidateInput({ ...baseInput, rank: undefined });

    expect(errors).toContain('建议补充全省位次，系统将优先使用位次进行推荐。');
  });

  it('filters and sorts recommendations for the result workspace', () => {
    const results = generateRecommendations(baseInput, fixtureRecords);
    const view = applyRecommendationView(results, {
      filters: {
        riskBands: ['稳', '保'],
        cities: ['杭州'],
        maxTuition: 6500,
        publicOnly: true,
        doubleFirstClassOnly: false,
      },
      sortBy: 'match',
    });

    expect(view).toHaveLength(2);
    expect(view.map((item) => item.university).sort()).toEqual(['杭州师范大学', '浙江工业大学']);
  });

  it('builds a report draft with summary and disclaimer', () => {
    const results = generateRecommendations(baseInput, fixtureRecords);
    const report = buildReportDraft(baseInput, results.slice(0, 3));

    expect(report.summary.total).toBe(3);
    expect(report.disclaimer).toContain('不构成录取承诺');
    expect(report.inputSnapshot.province).toBe('浙江');
  });
});
