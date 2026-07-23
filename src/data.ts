import { rankToScore } from './scoreRank';
import type { AdmissionRecord, AdmissionType, CandidateInput } from './types';

export const defaultCandidateInput: CandidateInput = {
  province: '浙江',
  year: 2026,
  track: '物理类',
  score: 615,
  rank: 21000,
  batchLine: 492,
  targetMajor: '计算机',
  preferredCities: ['杭州', '南京', '宁波'],
  preferredTiers: ['双一流', '省重点'],
  riskPreference: 'balanced',
  acceptsAdjustment: true,
  specialTypes: {
    sinoForeign: false,
    localPlan: false,
    earlyBatch: false,
  },
};

// 精选样例：保留几条手工校准、含提前批/地方专项/中外合作示例的记录。
const featuredRecords: AdmissionRecord[] = [
  {
    id: 'zju-information',
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
    restrictions: ['竞争极高，建议仅作为冲刺选项'],
    source: '高校招生官网样例',
    updatedAt: '2026-06-01',
  },
  {
    id: 'njust-ai',
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
    id: 'xdu-network',
    university: '西安电子科技大学',
    major: '网络空间安全',
    city: '西安',
    province: '陕西',
    sourceProvince: '浙江',
    admissionType: 'early',
    tier: '211 / 双一流',
    category: '计算机类',
    publicSchool: true,
    doubleFirstClass: true,
    tuition: 6600,
    subjectRequirement: '物理 + 化学',
    plan2026: 42,
    planDelta: 4,
    minScores: { 2023: 626, 2024: 628, 2025: 630 },
    minRanks: { 2023: 18100, 2024: 17400, 2025: 16800 },
    restrictions: ['提前批样例，部分课程英语教材较多'],
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
    admissionType: 'local',
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
    restrictions: ['地方专项样例，需符合报考资格'],
    source: '教育考试院样例',
    updatedAt: '2026-06-02',
  },
  {
    id: 'zju-sf-sino',
    university: '浙江大学城市学院',
    major: '计算机科学与技术（中外合作）',
    city: '杭州',
    province: '浙江',
    sourceProvince: '浙江',
    admissionType: 'regular',
    tier: '普通本科',
    category: '计算机类',
    publicSchool: true,
    doubleFirstClass: false,
    tuition: 63000,
    subjectRequirement: '物理 + 化学',
    plan2026: 60,
    planDelta: 0,
    minScores: { 2023: 585, 2024: 588, 2025: 590 },
    minRanks: { 2023: 42000, 2024: 39800, 2025: 38600 },
    restrictions: ['中外合作，学费较高'],
    source: '高校招生官网样例',
    updatedAt: '2026-06-05',
  },
];

// ------- 演示样例数据生成器（确定性，非真实录取数据）-------

type UniType = 'comprehensive' | 'tech' | 'normal' | 'finance' | 'medical' | 'general';

interface UniSeed {
  name: string;
  city: string;
  province: string;
  tier: string;
  dfc: boolean;
  type: UniType;
}

const UNIVERSITIES: UniSeed[] = [
  // 985
  { name: '上海交通大学', city: '上海', province: '上海', tier: '985 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '复旦大学', city: '上海', province: '上海', tier: '985 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '南京大学', city: '南京', province: '江苏', tier: '985 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '中国科学技术大学', city: '合肥', province: '安徽', tier: '985 / 双一流', dfc: true, type: 'tech' },
  { name: '华中科技大学', city: '武汉', province: '湖北', tier: '985 / 双一流', dfc: true, type: 'tech' },
  { name: '武汉大学', city: '武汉', province: '湖北', tier: '985 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '西安交通大学', city: '西安', province: '陕西', tier: '985 / 双一流', dfc: true, type: 'tech' },
  { name: '哈尔滨工业大学', city: '哈尔滨', province: '黑龙江', tier: '985 / 双一流', dfc: true, type: 'tech' },
  { name: '同济大学', city: '上海', province: '上海', tier: '985 / 双一流', dfc: true, type: 'tech' },
  { name: '厦门大学', city: '厦门', province: '福建', tier: '985 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '山东大学', city: '济南', province: '山东', tier: '985 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '四川大学', city: '成都', province: '四川', tier: '985 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '中山大学', city: '广州', province: '广东', tier: '985 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '天津大学', city: '天津', province: '天津', tier: '985 / 双一流', dfc: true, type: 'tech' },
  // 211 / 双一流
  { name: '上海大学', city: '上海', province: '上海', tier: '211 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '苏州大学', city: '苏州', province: '江苏', tier: '211 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '西安电子科技大学', city: '西安', province: '陕西', tier: '211 / 双一流', dfc: true, type: 'tech' },
  { name: '北京邮电大学', city: '北京', province: '北京', tier: '211 / 双一流', dfc: true, type: 'tech' },
  { name: '华东理工大学', city: '上海', province: '上海', tier: '211 / 双一流', dfc: true, type: 'tech' },
  { name: '南京航空航天大学', city: '南京', province: '江苏', tier: '211 / 双一流', dfc: true, type: 'tech' },
  { name: '江南大学', city: '无锡', province: '江苏', tier: '211 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '合肥工业大学', city: '合肥', province: '安徽', tier: '211 / 双一流', dfc: true, type: 'tech' },
  { name: '暨南大学', city: '广州', province: '广东', tier: '211 / 双一流', dfc: true, type: 'comprehensive' },
  { name: '上海财经大学', city: '上海', province: '上海', tier: '211 / 双一流', dfc: true, type: 'finance' },
  { name: '中央财经大学', city: '北京', province: '北京', tier: '211 / 双一流', dfc: true, type: 'finance' },
  // 双一流 / 省重点 / 普通本科（以浙江省内为主，方便本省考生）
  { name: '杭州电子科技大学', city: '杭州', province: '浙江', tier: '省重点', dfc: false, type: 'tech' },
  { name: '浙江师范大学', city: '金华', province: '浙江', tier: '省重点', dfc: false, type: 'normal' },
  { name: '浙江理工大学', city: '杭州', province: '浙江', tier: '省重点', dfc: false, type: 'tech' },
  { name: '浙江工商大学', city: '杭州', province: '浙江', tier: '省重点', dfc: false, type: 'finance' },
  { name: '温州大学', city: '温州', province: '浙江', tier: '省重点', dfc: false, type: 'comprehensive' },
  { name: '浙江财经大学', city: '杭州', province: '浙江', tier: '省重点', dfc: false, type: 'finance' },
  { name: '温州医科大学', city: '温州', province: '浙江', tier: '省重点', dfc: false, type: 'medical' },
  { name: '绍兴文理学院', city: '绍兴', province: '浙江', tier: '普通本科', dfc: false, type: 'normal' },
  { name: '台州学院', city: '台州', province: '浙江', tier: '普通本科', dfc: false, type: 'general' },
  { name: '丽水学院', city: '丽水', province: '浙江', tier: '普通本科', dfc: false, type: 'general' },
  { name: '湖州师范学院', city: '湖州', province: '浙江', tier: '普通本科', dfc: false, type: 'normal' },
  { name: '浙江中医药大学', city: '杭州', province: '浙江', tier: '普通本科', dfc: false, type: 'medical' },
];

interface MajorSeed {
  first: '物理' | '历史' | '不限';
  pop: number; // 热度系数：<1 更热门（位次更靠前/更难），>1 相对冷门
  majors: string[];
  elective?: string;
}

const MAJOR_POOL: Record<string, MajorSeed> = {
  计算机类: { first: '物理', pop: 0.8, majors: ['计算机科学与技术', '人工智能', '软件工程', '数据科学与大数据技术', '网络空间安全'] },
  电子信息类: { first: '物理', pop: 0.88, majors: ['电子信息工程', '通信工程', '微电子科学与工程'] },
  自动化类: { first: '物理', pop: 0.96, majors: ['自动化', '机器人工程'] },
  机械类: { first: '物理', pop: 1.06, majors: ['机械工程', '车辆工程', '能源与动力工程'] },
  材料类: { first: '物理', pop: 1.12, majors: ['材料科学与工程', '高分子材料与工程'] },
  数学类: { first: '物理', pop: 0.92, majors: ['数学与应用数学', '信息与计算科学', '统计学'] },
  经济学类: { first: '不限', pop: 0.85, majors: ['经济学', '国际经济与贸易'] },
  金融学类: { first: '不限', pop: 0.82, majors: ['金融学', '金融工程', '投资学'] },
  工商管理类: { first: '不限', pop: 1.0, majors: ['工商管理', '市场营销', '会计学', '人力资源管理'] },
  法学: { first: '不限', pop: 0.95, majors: ['法学'] },
  汉语言文学: { first: '历史', pop: 1.0, majors: ['汉语言文学', '新闻学', '汉语国际教育'] },
  外国语言文学: { first: '不限', pop: 1.05, majors: ['英语', '翻译', '日语', '商务英语'] },
  历史学: { first: '历史', pop: 1.18, majors: ['历史学', '文物与博物馆学'] },
  心理学: { first: '不限', pop: 1.0, majors: ['心理学', '应用心理学'] },
  临床医学: { first: '物理', pop: 0.8, elective: '化学', majors: ['临床医学', '口腔医学', '麻醉学'] },
  药学: { first: '物理', pop: 1.06, elective: '化学', majors: ['药学', '药物制剂'] },
  教育学: { first: '不限', pop: 1.08, majors: ['教育学', '学前教育', '小学教育'] },
};

const TYPE_CATEGORIES: Record<UniType, string[]> = {
  comprehensive: ['计算机类', '经济学类', '数学类', '法学', '汉语言文学', '外国语言文学', '心理学'],
  tech: ['计算机类', '电子信息类', '自动化类', '机械类', '材料类', '数学类'],
  normal: ['汉语言文学', '数学类', '外国语言文学', '心理学', '教育学', '历史学'],
  finance: ['经济学类', '金融学类', '工商管理类', '法学', '外国语言文学'],
  medical: ['临床医学', '药学'],
  general: ['工商管理类', '汉语言文学', '计算机类', '外国语言文学'],
};

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(rng: () => number, arr: T[], n: number): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function baseRankFor(tier: string): [number, number] {
  if (tier.includes('985')) return [1500, 9000];
  if (tier.includes('211')) return [8000, 26000];
  if (tier.includes('双一流')) return [16000, 38000];
  if (tier.includes('省重点')) return [26000, 55000];
  return [48000, 110000];
}

function scoreForRank(rank: number, first: '物理' | '历史' | '不限'): number {
  // 与等效分换算同源：从样例一分一段表反查，保证 minScores 与 minRanks 自洽。
  const track = first === '历史' ? '历史类' : '物理类';
  return (
    rankToScore('浙江', 2026, track, rank) ??
    Math.max(450, Math.min(700, Math.round(913 - 33 * Math.log(rank))))
  );
}

function planFor(rng: () => number, tier: string): number {
  if (tier.includes('985')) return randInt(rng, 15, 60);
  if (tier.includes('211')) return randInt(rng, 30, 90);
  if (tier.includes('双一流')) return randInt(rng, 40, 110);
  if (tier.includes('省重点')) return randInt(rng, 50, 150);
  return randInt(rng, 60, 180);
}

function subjectRequirementFor(rng: () => number, pool: MajorSeed): string {
  if (pool.first === '物理') {
    if (pool.elective) return `物理 + ${pool.elective}`;
    return rng() < 0.4 ? '物理 + 化学' : '物理';
  }
  if (pool.first === '历史') return '历史';
  return '不限';
}

function generateRecords(): AdmissionRecord[] {
  const rng = createRng(20260608);
  const updatedDates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
  const out: AdmissionRecord[] = [];
  let idx = 0;

  for (const uni of UNIVERSITIES) {
    const cats = TYPE_CATEGORIES[uni.type];
    const chosen = pickN(rng, cats, randInt(rng, 2, Math.min(4, cats.length)));

    for (const category of chosen) {
      const pool = MAJOR_POOL[category];
      let major = pick(rng, pool.majors);

      const [lo, hi] = baseRankFor(uni.tier);
      const r2025 = Math.max(800, Math.round((lo + rng() * (hi - lo)) * pool.pop));
      const r2024 = Math.max(800, Math.round(r2025 * (1 + (rng() - 0.5) * 0.12)));
      const r2023 = Math.max(800, Math.round(r2024 * (1 + (rng() - 0.5) * 0.12)));

      let tuition = uni.type === 'medical' ? randInt(rng, 5500, 7500) : randInt(rng, 4800, 6900);
      if (rng() < 0.06) {
        major = `${major}（中外合作）`;
        tuition = randInt(rng, 24000, 38000);
      }

      let admissionType: AdmissionType = 'regular';
      const roll = rng();
      if (roll < 0.08) admissionType = 'early';
      else if (roll < 0.14) admissionType = 'local';

      const restrictions: string[] = [];
      if (uni.type === 'medical') restrictions.push('部分专业色盲色弱受限');
      else if (category === '外国语言文学' && rng() < 0.5) restrictions.push('英语单科要求较高');
      else if (rng() < 0.08) restrictions.push('报考较热，注意大小年波动');

      out.push({
        id: `gen-${String(idx).padStart(3, '0')}`,
        university: uni.name,
        major,
        city: uni.city,
        province: uni.province,
        sourceProvince: '浙江',
        admissionType,
        tier: uni.tier,
        category,
        publicSchool: true,
        doubleFirstClass: uni.dfc,
        tuition,
        subjectRequirement: subjectRequirementFor(rng, pool),
        plan2026: planFor(rng, uni.tier),
        planDelta: randInt(rng, -8, 18),
        minScores: {
          2023: scoreForRank(r2023, pool.first),
          2024: scoreForRank(r2024, pool.first),
          2025: scoreForRank(r2025, pool.first),
        },
        minRanks: { 2023: r2023, 2024: r2024, 2025: r2025 },
        restrictions,
        source: '演示样例数据',
        updatedAt: pick(rng, updatedDates),
      });
      idx += 1;
    }
  }

  return out;
}

export const admissionRecords: AdmissionRecord[] = [...featuredRecords, ...generateRecords()];
