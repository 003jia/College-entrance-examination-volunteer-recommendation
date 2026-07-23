import type { AdmissionRecord } from '../src/types';
import { admissionRecordSchema } from './schemas';
import type { ScoreSegmentEntry } from './db';

export interface RowIssue {
  /** CSV 文件中的行号（含表头，数据从第 2 行起）。 */
  line: number;
  message: string;
}

const YEAR_COLUMN = /^min(Score|Rank)_(\d{4})$/;

/**
 * 规范化招生数据 CSV → AdmissionRecord[]。
 * 历年分数/位次用列名 minScore_2023 / minRank_2023 … 透视表示，空值跳过该年。
 */
export function assembleAdmissionRecords(rows: Array<Record<string, string>>): {
  records: AdmissionRecord[];
  issues: RowIssue[];
} {
  const records: AdmissionRecord[] = [];
  const issues: RowIssue[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const minScores: Record<number, number> = {};
    const minRanks: Record<number, number> = {};
    for (const [column, raw] of Object.entries(row)) {
      const match = YEAR_COLUMN.exec(column);
      if (!match || raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        issues.push({ line, message: `${column} 不是数字: "${raw}"` });
        continue;
      }
      const year = Number(match[2]);
      if (match[1] === 'Score') minScores[year] = value;
      else minRanks[year] = value;
    }

    if (!Object.keys(minRanks).length) {
      issues.push({ line, message: '缺少历年位次（至少需要一列 minRank_YYYY）' });
      return;
    }

    const candidate = {
      id: row.id || stableRecordId(row),
      university: row.university,
      major: row.major,
      city: row.city,
      province: row.province,
      sourceProvince: row.sourceProvince,
      admissionType: row.admissionType || 'regular',
      tier: row.tier,
      category: row.category,
      publicSchool: parseBoolean(row.publicSchool, true),
      doubleFirstClass: parseBoolean(row.doubleFirstClass, false),
      tuition: Number(row.tuition),
      subjectRequirement: row.subjectRequirement,
      plan2026: Number(row.plan2026),
      planDelta: Number(row.planDelta || '0'),
      minScores,
      minRanks,
      restrictions: (row.restrictions ?? '')
        .split(/[;；]/)
        .map((item) => item.trim())
        .filter(Boolean),
      source: row.source,
      updatedAt: row.updatedAt,
    };

    const parsed = admissionRecordSchema.safeParse(candidate);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      issues.push({ line, message: `${first.path.join('.') || '(record)'}: ${first.message}` });
      return;
    }
    records.push(parsed.data as AdmissionRecord);
  });

  return { records, issues };
}

/** 一分一段表 CSV（province,year,track,score,rank）→ ScoreSegmentEntry[]。 */
export function assembleScoreSegments(rows: Array<Record<string, string>>): {
  segments: ScoreSegmentEntry[];
  issues: RowIssue[];
} {
  const segments: ScoreSegmentEntry[] = [];
  const issues: RowIssue[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const province = row.province?.trim();
    const track = row.track?.trim();
    const year = Number(row.year);
    const score = Number(row.score);
    const rank = Number(row.rank);

    if (!province || !track) {
      issues.push({ line, message: 'province / track 不能为空' });
      return;
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      issues.push({ line, message: `year 非法: "${row.year}"` });
      return;
    }
    if (!Number.isFinite(score) || score < 0 || score > 750) {
      issues.push({ line, message: `score 非法: "${row.score}"` });
      return;
    }
    if (!Number.isInteger(rank) || rank < 1) {
      issues.push({ line, message: `rank 非法: "${row.rank}"` });
      return;
    }
    segments.push({ province, year, track, score, rank });
  });

  return { segments, issues };
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw === '') return fallback;
  const value = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', '是', '公办'].includes(value)) return true;
  if (['0', 'false', 'no', '否', '民办'].includes(value)) return false;
  return fallback;
}

/** 行内容的稳定 id（djb2），同一条院校+专业重复导入会覆盖而非重复。 */
function stableRecordId(row: Record<string, string>): string {
  const key = `${row.university}|${row.major}|${row.sourceProvince}|${row.admissionType || 'regular'}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return `csv-${(hash >>> 0).toString(16)}`;
}
