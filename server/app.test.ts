import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { createDatabase } from './db';
import { seedDatabase } from './seed';

let tempDir: string;
let dbPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'gaokao-api-test-'));
  dbPath = join(tempDir, 'test.sqlite');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

async function seededApp() {
  const db = createDatabase(dbPath);
  seedDatabase(db);
  return createApp({ db });
}

describe('backend api', () => {
  it('reports health and sqlite data version', async () => {
    const app = await seededApp();

    const response = await request(app).get('/api/health').expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      database: 'ready',
    });
    expect(response.body.version).toContain('2026');
  });

  it('returns options derived from seeded admission data', async () => {
    const app = await seededApp();

    const response = await request(app).get('/api/options').expect(200);

    expect(response.body.cities).toContain('杭州');
    expect(response.body.majors).toContain('计算机类');
    expect(response.body.tiers).toContain('双一流');
  });

  it('generates ranked recommendations with validation warnings', async () => {
    const app = await seededApp();

    const response = await request(app)
      .post('/api/recommendations')
      .send({
        province: '浙江',
        year: 2026,
        track: '物理类',
        score: 615,
        batchLine: 492,
        targetMajor: '计算机',
        preferredCities: ['杭州', '南京'],
        preferredTiers: ['双一流', '省重点'],
        riskPreference: 'balanced',
        acceptsAdjustment: true,
        specialTypes: { sinoForeign: false, localPlan: false, earlyBatch: false },
      })
      .expect(200);

    expect(response.body.validationMessages).toContain('建议补充全省位次，系统将优先使用位次进行推荐。');
    const recs = response.body.recommendations as Array<{
      riskBand: string;
      sourceProvince: string;
      category: string;
      major: string;
      admissionType: string;
    }>;
    // 样例数据扩充后，默认计算机类查询应返回多条候选、四档齐全、按档位排序。
    expect(recs.length).toBeGreaterThan(5);
    expect(response.body.summary.total).toBe(recs.length);
    expect(recs[0].riskBand).toBe('冲');
    expect(new Set(recs.map((item) => item.riskBand))).toEqual(new Set(['冲', '稳', '保', '兜底']));
    // 默认不勾选特殊类型：仅普通批、无中外合作；且只匹配目标专业“计算机”与生源省份浙江。
    expect(recs.every((item) => item.admissionType === 'regular')).toBe(true);
    expect(recs.every((item) => !item.major.includes('中外合作'))).toBe(true);
    expect(recs.every((item) => item.category.includes('计算机') || item.major.includes('计算机'))).toBe(true);
    expect(recs.every((item) => item.sourceProvince === '浙江')).toBe(true);
  });

  it('builds report drafts from selected candidate ids', async () => {
    const app = await seededApp();
    const input = {
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
      specialTypes: { sinoForeign: false, localPlan: false, earlyBatch: false },
    };

    const recommendations = await request(app).post('/api/recommendations').send(input).expect(200);
    const candidateIds = recommendations.body.recommendations
      .slice(0, 2)
      .map((item: { id: string }) => item.id);

    const response = await request(app)
      .post('/api/reports')
      .send({ input, candidateIds })
      .expect(200);

    expect(response.body.summary.total).toBe(2);
    expect(response.body.disclaimer).toContain('不构成录取承诺');
  });

  it('rejects malformed recommendation request bodies with 400 instead of 500', async () => {
    const app = await seededApp();

    const malformed = await request(app)
      .post('/api/recommendations')
      .set('Content-Type', 'application/json')
      .send('"oops"')
      .expect(400);
    expect(malformed.body.error).toBeDefined();

    const arrayBody = await request(app)
      .post('/api/recommendations')
      .send([1, 2, 3])
      .expect(400);
    expect(arrayBody.body.error).toBeDefined();
  });

  it('guards admin import with a token when GAOKAO_ADMIN_TOKEN is configured', async () => {
    const validRecord = {
      id: 'test-record',
      university: '测试大学',
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
      plan2026: 50,
      planDelta: 2,
      minScores: { 2025: 600 },
      minRanks: { 2025: 24000 },
      restrictions: [],
      source: '测试样例',
      updatedAt: '2026-06-08',
    };

    process.env.GAOKAO_ADMIN_TOKEN = 'secret-token';
    try {
      const app = await seededApp();

      await request(app)
        .post('/api/admin/import/admissions')
        .send({ records: [validRecord] })
        .expect(401);

      await request(app)
        .post('/api/admin/import/admissions')
        .set('x-admin-token', 'secret-token')
        .send({ records: [validRecord] })
        .expect(201);
    } finally {
      delete process.env.GAOKAO_ADMIN_TOKEN;
    }
  });

  it('returns admin overview and rejects invalid admission imports', async () => {
    const app = await seededApp();

    const overview = await request(app).get('/api/admin/overview').expect(200);
    expect(overview.body.tables.admissionRecords).toBeGreaterThanOrEqual(8);
    expect(overview.body.ruleConfig.strategy).toBe('rank-first');

    const invalidImport = await request(app)
      .post('/api/admin/import/admissions')
      .send({ records: [{ university: '缺字段大学' }] })
      .expect(400);
    expect(invalidImport.body.error).toContain('Invalid admission record');
  });
});
