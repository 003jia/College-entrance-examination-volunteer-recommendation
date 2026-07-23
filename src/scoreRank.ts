import type { CandidateInput } from './types';

export interface ScoreSegment {
  /** 分数 */
  score: number;
  /** 该分数对应的全省累计位次（同分取最低位次） */
  rank: number;
}

export type NormalizedTrack = '物理类' | '历史类';

// 一分一段表（演示样例数据，非真实公布数据）。按 `省份:年份:科类` 索引；
// 真实落地时用各省教育考试院公布的一分一段表替换本表即可，下游逻辑无需改动。
const RAW_TABLES: Record<string, Array<[number, number]>> = {
  '浙江:2026:物理类': [
    [750, 60], [710, 600], [690, 1800], [670, 3500], [650, 8000],
    [630, 15000], [615, 21000], [600, 30000], [585, 41000], [570, 54000],
    [555, 68000], [540, 83000], [520, 104000], [500, 126000], [480, 150000], [450, 185000],
  ],
  '浙江:2026:历史类': [
    [750, 20], [700, 250], [680, 800], [660, 1800], [640, 3600],
    [620, 6200], [605, 9000], [590, 13000], [575, 18000], [560, 24000],
    [545, 31000], [530, 39000], [510, 52000], [490, 66000], [470, 82000], [450, 100000],
  ],
};

const TABLES: Record<string, ScoreSegment[]> = Object.fromEntries(
  Object.entries(RAW_TABLES).map(([key, rows]) => [
    key,
    rows.map(([score, rank]) => ({ score, rank })).sort((a, b) => b.score - a.score),
  ]),
);

// 运行时注册的真实一分一段表（如服务器启动时从数据库加载），优先于内置样例表。
const registeredTables: Record<string, ScoreSegment[]> = {};

export function registerScoreSegments(
  province: string,
  year: number,
  track: string,
  segments: ScoreSegment[],
): void {
  const key = `${province}:${year}:${normalizeTrack(track)}`;
  registeredTables[key] = segments.slice().sort((a, b) => b.score - a.score);
}

export function clearRegisteredScoreSegments(): void {
  for (const key of Object.keys(registeredTables)) delete registeredTables[key];
}

/** 内置样例表（用于 seed 数据库，建立“数据库 → 注册 → 查询”的完整管线）。 */
export function builtinScoreTables(): Array<{
  province: string;
  year: number;
  track: NormalizedTrack;
  segments: ScoreSegment[];
}> {
  return Object.entries(TABLES).map(([key, segments]) => {
    const [province, year, track] = key.split(':');
    return { province, year: Number(year), track: track as NormalizedTrack, segments };
  });
}

export function normalizeTrack(track: string): NormalizedTrack {
  return track.includes('历史') ? '历史类' : '物理类';
}

function getTable(province: string, year: number, track: string): ScoreSegment[] | null {
  const norm = normalizeTrack(track);
  const exactKey = `${province}:${year}:${norm}`;
  const exact = registeredTables[exactKey] ?? TABLES[exactKey];
  if (exact) return exact;
  // 退化：同省同科类取任意可用年份的表（真实数据缺当年表时的兜底）。
  const matchesProvinceTrack = (key: string) =>
    key.startsWith(`${province}:`) && key.endsWith(`:${norm}`);
  const registeredFallback = Object.keys(registeredTables).find(matchesProvinceTrack);
  if (registeredFallback) return registeredTables[registeredFallback];
  const builtinFallback = Object.keys(TABLES).find(matchesProvinceTrack);
  return builtinFallback ? TABLES[builtinFallback] : null;
}

export function hasScoreTable(province: string, year: number, track: string): boolean {
  return getTable(province, year, track) !== null;
}

/** 分数 → 全省位次（表内线性插值，超界则取端点）。无对应表返回 null。 */
export function scoreToRank(province: string, year: number, track: string, score: number): number | null {
  const table = getTable(province, year, track);
  if (!table) return null;
  if (score >= table[0].score) return table[0].rank;
  const last = table[table.length - 1];
  if (score <= last.score) return last.rank;
  for (let i = 0; i < table.length - 1; i += 1) {
    const hi = table[i];
    const lo = table[i + 1];
    if (score <= hi.score && score >= lo.score) {
      const t = (score - hi.score) / (lo.score - hi.score);
      return Math.round(hi.rank + t * (lo.rank - hi.rank));
    }
  }
  return last.rank;
}

/** 全省位次 → 分数（表内线性插值，超界则取端点）。无对应表返回 null。 */
export function rankToScore(province: string, year: number, track: string, rank: number): number | null {
  const table = getTable(province, year, track);
  if (!table) return null;
  if (rank <= table[0].rank) return table[0].score;
  const last = table[table.length - 1];
  if (rank >= last.rank) return last.score;
  for (let i = 0; i < table.length - 1; i += 1) {
    const hi = table[i];
    const lo = table[i + 1];
    if (rank >= hi.rank && rank <= lo.rank) {
      const t = (rank - hi.rank) / (lo.rank - hi.rank);
      return Math.round(hi.score + t * (lo.score - hi.score));
    }
  }
  return last.score;
}

/**
 * 同位分 / 等效分：把某个（往年）录取位次折算成考生所在年份的等效分数。
 * 例：某校去年最低录取位次 21000，按今年一分一段表折算约 615 分。
 */
export function equivalentScore(
  input: Pick<CandidateInput, 'province' | 'year' | 'track'>,
  rank: number,
): number | null {
  return rankToScore(input.province, input.year, input.track, rank);
}
