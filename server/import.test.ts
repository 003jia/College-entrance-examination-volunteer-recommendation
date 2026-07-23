import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { assembleAdmissionRecords, assembleScoreSegments } from './importCsv';
import {
  getAdmissionRecords,
  getAllScoreSegments,
  initializeDatabase,
  replaceScoreSegments,
  upsertAdmissionRecords,
} from './db';

describe('csv parser', () => {
  it('parses quoted fields, embedded commas, CRLF and BOM', () => {
    const text = '﻿a,b,c\r\n"x,1","he said ""hi""",3\r\nplain,2,';
    const { headers, rows } = parseCsv(text);

    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ a: 'x,1', b: 'he said "hi"', c: '3' });
    expect(rows[1]).toEqual({ a: 'plain', b: '2', c: '' });
  });

  it('skips blank lines', () => {
    const { rows } = parseCsv('a,b\n1,2\n\n3,4\n');
    expect(rows).toHaveLength(2);
  });
});

describe('admissions csv assembly', () => {
  it('assembles records from the shipped template', () => {
    const text = readFileSync(join(process.cwd(), 'data/templates/admissions-template.csv'), 'utf-8');
    const { records, issues } = assembleAdmissionRecords(parseCsv(text).rows);

    expect(issues).toEqual([]);
    expect(records).toHaveLength(2);
    expect(records[0].university).toBe('浙江大学');
    expect(records[0].minRanks).toEqual({ 2023: 4300, 2024: 3900, 2025: 3600 });
    // 第二条缺部分年份分数，但位次齐全；限制按分号拆分。
    expect(records[1].minScores).toEqual({ 2025: 620 });
    expect(records[1].minRanks).toEqual({ 2023: 18500, 2024: 17800, 2025: 17000 });
    expect(records[1].restrictions).toEqual(['英语单科不低于110', '色盲色弱不限']);
    // 未填 id 时生成稳定 id（同一行重复导入会覆盖而非重复）。
    expect(records[0].id).toMatch(/^csv-/);
  });

  it('reports row-level issues with line numbers', () => {
    const text = [
      'university,major,city,province,sourceProvince,tier,category,tuition,subjectRequirement,plan2026,source,updatedAt,minRank_2025',
      '某大学,某专业,某市,某省,某省,普通本科,某类,5000,不限,50,考试院,2026-06-25,12000',
      '缺位次大学,某专业,某市,某省,某省,普通本科,某类,5000,不限,50,考试院,2026-06-25,',
    ].join('\n');
    const { records, issues } = assembleAdmissionRecords(parseCsv(text).rows);

    expect(records).toHaveLength(1);
    expect(issues).toHaveLength(1);
    expect(issues[0].line).toBe(3);
    expect(issues[0].message).toContain('位次');
  });
});

describe('score segments csv assembly', () => {
  it('assembles and validates segment rows', () => {
    const text = 'province,year,track,score,rank\n浙江,2026,物理类,600,30000\n浙江,abcd,物理类,600,1';
    const { segments, issues } = assembleScoreSegments(parseCsv(text).rows);

    expect(segments).toEqual([{ province: '浙江', year: 2026, track: '物理类', score: 600, rank: 30000 }]);
    expect(issues).toHaveLength(1);
    expect(issues[0].line).toBe(3);
  });
});

describe('database migration & import', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'gaokao-db-test-'));
    dbPath = join(tempDir, 'test.sqlite');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('migrates a legacy table (without new columns) instead of requiring a rebuild', () => {
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE admission_records (
        id TEXT PRIMARY KEY, university TEXT NOT NULL, major TEXT NOT NULL,
        city TEXT NOT NULL, province TEXT NOT NULL, tier TEXT NOT NULL,
        category TEXT NOT NULL, public_school INTEGER NOT NULL,
        double_first_class INTEGER NOT NULL, tuition INTEGER NOT NULL,
        subject_requirement TEXT NOT NULL, plan_2026 INTEGER NOT NULL,
        plan_delta INTEGER NOT NULL, min_scores_json TEXT NOT NULL,
        min_ranks_json TEXT NOT NULL, restrictions_json TEXT NOT NULL,
        source TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO admission_records VALUES (
        'legacy-1', '旧库大学', '旧专业', '杭州', '浙江', '省重点', '计算机类',
        1, 0, 6000, '物理', 50, 0, '{"2025":600}', '{"2025":24000}', '[]',
        '旧版本', '2025-06-01'
      );
    `);

    initializeDatabase(db);

    const records = getAdmissionRecords(db);
    expect(records).toHaveLength(1);
    expect(records[0].sourceProvince).toBe('浙江');
    expect(records[0].admissionType).toBe('regular');
    // 迁移应是幂等的。
    expect(() => initializeDatabase(db)).not.toThrow();
  });

  it('merges admission records by id without deleting existing rows', () => {
    const db = new DatabaseSync(dbPath);
    initializeDatabase(db);
    const base = {
      university: '甲大学', major: '专业A', city: '杭州', province: '浙江',
      sourceProvince: '浙江', admissionType: 'regular' as const, tier: '省重点',
      category: '计算机类', publicSchool: true, doubleFirstClass: false,
      tuition: 6000, subjectRequirement: '物理', plan2026: 50, planDelta: 0,
      minScores: { 2025: 600 }, minRanks: { 2025: 24000 }, restrictions: [],
      source: '测试', updatedAt: '2026-06-25',
    };

    upsertAdmissionRecords(db, [{ ...base, id: 'a' }], 'v1');
    upsertAdmissionRecords(db, [{ ...base, id: 'b' }, { ...base, id: 'a', tuition: 6500 }], 'v2');

    const records = getAdmissionRecords(db);
    expect(records).toHaveLength(2);
    expect(records.find((r) => r.id === 'a')?.tuition).toBe(6500);
  });

  it('replaces score segments only for the (province, year, track) groups present', () => {
    const db = new DatabaseSync(dbPath);
    initializeDatabase(db);

    replaceScoreSegments(db, [
      { province: '浙江', year: 2026, track: '物理类', score: 600, rank: 30000 },
      { province: '浙江', year: 2026, track: '历史类', score: 600, rank: 11000 },
    ]);
    replaceScoreSegments(db, [
      { province: '浙江', year: 2026, track: '物理类', score: 650, rank: 8000 },
    ]);

    const all = getAllScoreSegments(db);
    expect(all.filter((s) => s.track === '物理类')).toHaveLength(1);
    expect(all.filter((s) => s.track === '历史类')).toHaveLength(1);
  });
});
