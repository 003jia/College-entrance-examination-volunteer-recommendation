import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AdmissionRecord, AdmissionType } from '../src/types';

export type AppDatabase = DatabaseSync;

interface AdmissionRecordRow {
  id: string;
  university: string;
  major: string;
  city: string;
  province: string;
  source_province: string;
  admission_type: string;
  tier: string;
  category: string;
  public_school: number;
  double_first_class: number;
  tuition: number;
  subject_requirement: string;
  plan_2026: number;
  plan_delta: number;
  min_scores_json: string;
  min_ranks_json: string;
  restrictions_json: string;
  source: string;
  updated_at: string;
}

interface DataVersionRow {
  id: string;
  name: string;
  source: string;
  updated_at: string;
  record_count: number;
}

interface RuleConfigRow {
  key: string;
  value_json: string;
}

export function createDatabase(dbPath = defaultDbPath()): AppDatabase {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  initializeDatabase(db);
  return db;
}

export function defaultDbPath() {
  return process.env.GAOKAO_DB_PATH ?? join(process.cwd(), 'data', 'gaokao.sqlite');
}

export function initializeDatabase(db: AppDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admission_records (
      id TEXT PRIMARY KEY,
      university TEXT NOT NULL,
      major TEXT NOT NULL,
      city TEXT NOT NULL,
      province TEXT NOT NULL,
      source_province TEXT NOT NULL,
      admission_type TEXT NOT NULL,
      tier TEXT NOT NULL,
      category TEXT NOT NULL,
      public_school INTEGER NOT NULL,
      double_first_class INTEGER NOT NULL,
      tuition INTEGER NOT NULL,
      subject_requirement TEXT NOT NULL,
      plan_2026 INTEGER NOT NULL,
      plan_delta INTEGER NOT NULL,
      min_scores_json TEXT NOT NULL,
      min_ranks_json TEXT NOT NULL,
      restrictions_json TEXT NOT NULL,
      source TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS data_versions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      record_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rule_config (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS score_segments (
      province TEXT NOT NULL,
      year INTEGER NOT NULL,
      track TEXT NOT NULL,
      score INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      PRIMARY KEY (province, year, track, score)
    );
  `);
  runMigrations(db);
  // 索引依赖迁移补出的列，必须在迁移之后创建。
  db.exec('CREATE INDEX IF NOT EXISTS idx_admission_source_province ON admission_records (source_province)');
}

// 基于 PRAGMA user_version 的轻量迁移：老库升级不再依赖“删库重建”。
const MIGRATIONS: Array<(db: AppDatabase) => void> = [
  // v1: 为缺少 source_province / admission_type 的旧表补列（历史样例数据均为浙江生源）。
  (db) => {
    const columns = (db.prepare('PRAGMA table_info(admission_records)').all() as unknown as Array<{
      name: string;
    }>).map((column) => column.name);
    if (!columns.includes('source_province')) {
      db.exec("ALTER TABLE admission_records ADD COLUMN source_province TEXT NOT NULL DEFAULT '浙江'");
    }
    if (!columns.includes('admission_type')) {
      db.exec("ALTER TABLE admission_records ADD COLUMN admission_type TEXT NOT NULL DEFAULT 'regular'");
    }
  },
];

function runMigrations(db: AppDatabase) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as unknown as {
    user_version: number;
  };
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    MIGRATIONS[version](db);
    db.exec(`PRAGMA user_version = ${version + 1}`);
  }
}

export function replaceAdmissionRecords(
  db: AppDatabase,
  records: AdmissionRecord[],
  versionName = '2026.06 MVP 样例数据',
) {
  const insert = db.prepare(`
    INSERT INTO admission_records (
      id, university, major, city, province, source_province, admission_type, tier,
      category, public_school, double_first_class, tuition, subject_requirement,
      plan_2026, plan_delta, min_scores_json, min_ranks_json, restrictions_json,
      source, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM admission_records');
    for (const record of records) {
      insert.run(
        record.id,
        record.university,
        record.major,
        record.city,
        record.province,
        record.sourceProvince,
        record.admissionType,
        record.tier,
        record.category,
        record.publicSchool ? 1 : 0,
        record.doubleFirstClass ? 1 : 0,
        record.tuition,
        record.subjectRequirement,
        record.plan2026,
        record.planDelta,
        JSON.stringify(record.minScores),
        JSON.stringify(record.minRanks),
        JSON.stringify(record.restrictions),
        record.source,
        record.updatedAt,
      );
    }
    upsertDataVersion(db, {
      id: 'admissions-current',
      name: versionName,
      source: '本地 MVP seed',
      updated_at: new Date().toISOString(),
      record_count: records.length,
    });
    upsertRuleConfig(db, {
      strategy: 'rank-first',
      bands: ['冲', '稳', '保', '兜底'],
      note: '以用户位次与近三年最低录取位次均值差距为基础，结合计划变化、专业和城市偏好评分。',
    });
    insertImportLog(db, 'admissions', 'success', `Imported ${records.length} admission records`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getAdmissionRecords(
  db: AppDatabase,
  filter?: { sourceProvince?: string },
): AdmissionRecord[] {
  // 推荐请求按生源省份在 SQL 层过滤，避免真实数据（每省每年数万行）全表进内存。
  const rows = (filter?.sourceProvince
    ? db
        .prepare('SELECT * FROM admission_records WHERE source_province = ? ORDER BY university, major')
        .all(filter.sourceProvince)
    : db.prepare('SELECT * FROM admission_records ORDER BY university, major').all()) as unknown as AdmissionRecordRow[];
  return rows.map(rowToAdmissionRecord);
}

export function upsertAdmissionRecords(
  db: AppDatabase,
  records: AdmissionRecord[],
  versionName: string,
) {
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO admission_records (
      id, university, major, city, province, source_province, admission_type, tier,
      category, public_school, double_first_class, tuition, subject_requirement,
      plan_2026, plan_delta, min_scores_json, min_ranks_json, restrictions_json,
      source, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    for (const record of records) {
      upsert.run(
        record.id,
        record.university,
        record.major,
        record.city,
        record.province,
        record.sourceProvince,
        record.admissionType,
        record.tier,
        record.category,
        record.publicSchool ? 1 : 0,
        record.doubleFirstClass ? 1 : 0,
        record.tuition,
        record.subjectRequirement,
        record.plan2026,
        record.planDelta,
        JSON.stringify(record.minScores),
        JSON.stringify(record.minRanks),
        JSON.stringify(record.restrictions),
        record.source,
        record.updatedAt,
      );
    }
    const total = (db.prepare('SELECT COUNT(*) AS count FROM admission_records').get() as unknown as {
      count: number;
    }).count;
    upsertDataVersion(db, {
      id: 'admissions-current',
      name: versionName,
      source: 'CSV 增量导入',
      updated_at: new Date().toISOString(),
      record_count: total,
    });
    insertImportLog(db, 'admissions', 'success', `Merged ${records.length} admission records (total ${total})`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export interface ScoreSegmentEntry {
  province: string;
  year: number;
  track: string;
  score: number;
  rank: number;
}

/** 按 (省份, 年份, 科类) 分组替换一分一段表：仅清空导入文件涉及的组合，再插入。 */
export function replaceScoreSegments(db: AppDatabase, segments: ScoreSegmentEntry[]) {
  const deleteGroup = db.prepare(
    'DELETE FROM score_segments WHERE province = ? AND year = ? AND track = ?',
  );
  const insert = db.prepare(
    'INSERT OR REPLACE INTO score_segments (province, year, track, score, rank) VALUES (?, ?, ?, ?, ?)',
  );
  const groups = new Set(segments.map((s) => `${s.province}:${s.year}:${s.track}`));

  db.exec('BEGIN');
  try {
    for (const group of groups) {
      const [province, year, track] = group.split(':');
      deleteGroup.run(province, Number(year), track);
    }
    for (const segment of segments) {
      insert.run(segment.province, segment.year, segment.track, segment.score, segment.rank);
    }
    insertImportLog(
      db,
      'score-segments',
      'success',
      `Imported ${segments.length} score segments across ${groups.size} table(s)`,
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getAllScoreSegments(db: AppDatabase): ScoreSegmentEntry[] {
  return db
    .prepare('SELECT province, year, track, score, rank FROM score_segments ORDER BY province, year, track, score DESC')
    .all() as unknown as ScoreSegmentEntry[];
}

export function getAdmissionRecordsByIds(db: AppDatabase, ids: string[]): AdmissionRecord[] {
  if (!ids.length) return getAdmissionRecords(db);
  const placeholders = ids.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT * FROM admission_records WHERE id IN (${placeholders})`)
    .all(...ids) as unknown as AdmissionRecordRow[];
  const order = new Map(ids.map((id, index) => [id, index]));
  return rows.map(rowToAdmissionRecord).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function getDataVersion(db: AppDatabase) {
  return db
    .prepare('SELECT * FROM data_versions WHERE id = ?')
    .get('admissions-current') as unknown as DataVersionRow | undefined;
}

export function getRuleConfig(db: AppDatabase) {
  const row = db
    .prepare('SELECT * FROM rule_config WHERE key = ?')
    .get('recommendation') as unknown as RuleConfigRow | undefined;
  return row ? JSON.parse(row.value_json) as Record<string, unknown> : null;
}

export function getAdminOverview(db: AppDatabase) {
  const admissionCount = db
    .prepare('SELECT COUNT(*) AS count FROM admission_records')
    .get() as unknown as { count: number };
  const segmentCount = db
    .prepare('SELECT COUNT(*) AS count FROM score_segments')
    .get() as unknown as { count: number };
  const version = getDataVersion(db);
  const ruleConfig = getRuleConfig(db);
  const recentImports = db
    .prepare('SELECT type, status, message, created_at FROM import_logs ORDER BY id DESC LIMIT 5')
    .all() as unknown as Array<Record<string, string>>;

  return {
    dataVersion: version
      ? {
          id: version.id,
          name: version.name,
          source: version.source,
          updatedAt: version.updated_at,
          recordCount: version.record_count,
        }
      : null,
    tables: {
      admissionRecords: admissionCount.count,
      scoreSegments: segmentCount.count,
    },
    ruleConfig,
    recentImports,
  };
}

export function insertImportLog(db: AppDatabase, type: string, status: string, message: string) {
  db.prepare(`
    INSERT INTO import_logs (type, status, message, created_at)
    VALUES (?, ?, ?, ?)
  `).run(type, status, message, new Date().toISOString());
}

function upsertDataVersion(db: AppDatabase, row: DataVersionRow) {
  db.prepare(`
    INSERT INTO data_versions (id, name, source, updated_at, record_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      source = excluded.source,
      updated_at = excluded.updated_at,
      record_count = excluded.record_count
  `).run(row.id, row.name, row.source, row.updated_at, row.record_count);
}

function upsertRuleConfig(db: AppDatabase, value: Record<string, unknown>) {
  db.prepare(`
    INSERT INTO rule_config (key, value_json)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
  `).run('recommendation', JSON.stringify(value));
}

function rowToAdmissionRecord(row: AdmissionRecordRow): AdmissionRecord {
  return {
    id: row.id,
    university: row.university,
    major: row.major,
    city: row.city,
    province: row.province,
    sourceProvince: row.source_province,
    admissionType: row.admission_type as AdmissionType,
    tier: row.tier,
    category: row.category,
    publicSchool: Boolean(row.public_school),
    doubleFirstClass: Boolean(row.double_first_class),
    tuition: row.tuition,
    subjectRequirement: row.subject_requirement,
    plan2026: row.plan_2026,
    planDelta: row.plan_delta,
    minScores: JSON.parse(row.min_scores_json) as Record<number, number>,
    minRanks: JSON.parse(row.min_ranks_json) as Record<number, number>,
    restrictions: JSON.parse(row.restrictions_json) as string[],
    source: row.source,
    updatedAt: row.updated_at,
  };
}
