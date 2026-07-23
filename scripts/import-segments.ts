/**
 * 导入一分一段表 CSV（列：province,year,track,score,rank）。
 * 数据来源：各省教育考试院官网公布的一分一段表（Excel 转 CSV）。
 *
 * 用法：
 *   npm run import:segments -- --file data/浙江2026一分一段.csv
 *   npm run import:segments -- --file x.csv --dry-run
 *
 * 语义：仅替换文件中出现的（省份, 年份, 科类）组合，其余表保持不变。
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseCsv } from '../server/csv';
import { assembleScoreSegments } from '../server/importCsv';
import { createDatabase, replaceScoreSegments } from '../server/db';

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    db: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

if (!values.file) {
  console.error('缺少 --file <csv 路径>');
  process.exit(1);
}

const { rows } = parseCsv(readFileSync(values.file, 'utf-8'));
const { segments, issues } = assembleScoreSegments(rows);

if (issues.length) {
  console.error(`校验失败：${issues.length} 个问题（共 ${rows.length} 行）`);
  for (const issue of issues.slice(0, 20)) {
    console.error(`  第 ${issue.line} 行: ${issue.message}`);
  }
  process.exit(1);
}

const groups = new Set(segments.map((s) => `${s.province} ${s.year} ${s.track}`));
console.log(`解析成功：${segments.length} 行，覆盖 ${groups.size} 张表：`);
for (const group of groups) console.log(`  ${group}`);

if (values['dry-run']) {
  console.log('（dry-run，未写入数据库）');
  process.exit(0);
}

replaceScoreSegments(createDatabase(values.db), segments);
console.log('已写入数据库。重启 API 服务后生效（启动时自动加载并注册）。');
