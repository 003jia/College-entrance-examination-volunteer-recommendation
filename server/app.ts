import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import {
  NO_RANK_WARNING,
  buildReportDraft,
  generateRecommendations,
  validateCandidateInput,
} from '../src/recommendation';
import {
  getAdminOverview,
  getAdmissionRecords,
  getDataVersion,
  insertImportLog,
  replaceAdmissionRecords,
  type AppDatabase,
} from './db';
import {
  admissionRecordSchema,
  candidateInputSchema,
  importAdmissionsSchema,
  reportRequestSchema,
} from './schemas';

interface CreateAppOptions {
  db: AppDatabase;
}

// 筛选/排序由前端就地完成（单一事实来源），后端只接受候选输入并返回全量分档结果。
const recommendationRequestSchema = z.object({
  input: candidateInputSchema,
});

export function createApp({ db }: CreateAppOptions) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_request, response) => {
    const version = getDataVersion(db);
    response.json({
      ok: true,
      database: 'ready',
      version: version?.name ?? 'unseeded',
      updatedAt: version?.updated_at ?? null,
    });
  });

  app.get('/api/options', (_request, response) => {
    const records = getAdmissionRecords(db);
    response.json(buildOptions(records));
  });

  app.get('/api/admissions', (_request, response) => {
    response.json({ records: getAdmissionRecords(db) });
  });

  app.post('/api/recommendations', (request, response) => {
    const body = isPlainObject(request.body) ? request.body : {};
    const payload = recommendationRequestSchema.parse('input' in body ? body : { input: body });
    const validationMessages = validateCandidateInput(payload.input);
    const blockingMessages = validationMessages.filter((message) => message !== NO_RANK_WARNING);

    if (blockingMessages.length) {
      response.status(400).json({
        error: 'Invalid candidate input',
        validationMessages,
        recommendations: [],
      });
      return;
    }

    const records = getAdmissionRecords(db, { sourceProvince: payload.input.province });
    const recommendations = generateRecommendations(payload.input, records);
    const report = buildReportDraft(payload.input, recommendations);

    response.json({
      validationMessages,
      recommendations,
      summary: report.summary,
      dataVersion: getDataVersion(db),
    });
  });

  app.post('/api/reports', (request, response) => {
    const payload = reportRequestSchema.parse(request.body);
    const records = getAdmissionRecords(db, { sourceProvince: payload.input.province });
    const recommendations = generateRecommendations(payload.input, records);
    const selected = payload.candidateIds.length
      ? recommendations.filter((item) => payload.candidateIds.includes(item.id))
      : recommendations;
    response.json(buildReportDraft(payload.input, selected));
  });

  app.get('/api/admin/overview', (_request, response) => {
    response.json(getAdminOverview(db));
  });

  app.post('/api/admin/import/admissions', (request, response) => {
    if (!isAuthorizedAdmin(request)) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const payload = importAdmissionsSchema.parse(request.body);
    const records = payload.records.map((record, index) => {
      const parsed = admissionRecordSchema.safeParse(record);
      if (!parsed.success) {
        throw new ImportValidationError(`Invalid admission record at index ${index}`);
      }
      return parsed.data;
    });

    replaceAdmissionRecords(db, records, '手动导入数据');
    insertImportLog(db, 'admissions', 'success', `Manually imported ${records.length} records`);
    response.status(201).json({ imported: records.length });
  });

  app.use(errorHandler);
  return app;
}

class ImportValidationError extends Error {}

// 写接口鉴权：配置了 GAOKAO_ADMIN_TOKEN 时要求匹配请求头；未配置（本地开发）则放行。
function isAuthorizedAdmin(request: express.Request): boolean {
  const expected = process.env.GAOKAO_ADMIN_TOKEN;
  if (!expected) return true;
  return request.get('x-admin-token') === expected;
}

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ImportValidationError) {
    response.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: 'Invalid request payload', details: error.issues });
    return;
  }
  // 中间件错误（如 express.json 解析失败/超限）自带 4xx 状态码，应透传而非一律 500。
  const status = readErrorStatus(error);
  if (status >= 400 && status < 500) {
    response.status(status).json({ error: 'Invalid request payload' });
    return;
  }
  response.status(500).json({ error: 'Internal server error' });
};

function readErrorStatus(error: unknown): number {
  if (typeof error !== 'object' || error === null) return 500;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.statusCode === 'number') return candidate.statusCode;
  return 500;
}

const TIER_TAGS = ['985', '211', '双一流', '省重点', '普通本科'];

function buildOptions(records: ReturnType<typeof getAdmissionRecords>) {
  // 只保留规范化的层次标签，并按固定优先级排序，避免出现“985 / 双一流”这类重复粒度项。
  const tiers = TIER_TAGS.filter((tag) => records.some((record) => record.tier.includes(tag)));

  return {
    // 省份维度对应生源省份（可比对位次的省份），而非院校所在地。
    provinces: unique(records.map((record) => record.sourceProvince)),
    tracks: ['物理类', '历史类', '物化生', '物化地'],
    cities: unique(records.map((record) => record.city)),
    tiers,
    majors: unique(records.flatMap((record) => [record.category, record.major])),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
