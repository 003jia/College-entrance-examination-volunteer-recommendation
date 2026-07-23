/**
 * 导入招生录取数据 CSV（模板见 data/templates/admissions-template.csv）。
 *
 * 用法：
 *   npm run import:admissions -- --file data/浙江2025.csv --version "浙江 2023-2025 投档线"
 *   npm run import:admissions -- --file x.csv --dry-run        # 只校验不写库
 *   npm run import:admissions -- --file x.csv --merge          # 按 id 增量合并（默认整库替换）
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseCsv } from '../server/csv';
import { assembleAdmissionRecords } from '../server/importCsv';
import { createDatabase, replaceAdmissionRecords, upsertAdmissionRecords } from '../server/db';

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    version: { type: 'string' },
    db: { type: 'string' },
    merge: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

if (!values.file) {
  console.error('缺少 --file <csv 路径>');
  process.exit(1);
}

const { rows } = parseCsv(readFileSync(values.file, 'utf-8'));
const { records, issues } = assembleAdmissionRecords(rows);

if (issues.length) {
  console.error(`校验失败：${issues.length} 个问题（共 ${rows.length} 行）`);
  for (const issue of issues.slice(0, 20)) {
    console.error(`  第 ${issue.line} 行: ${issue.message}`);
  }
  if (issues.length > 20) console.error(`  …其余 ${issues.length - 20} 个省略`);
  process.exit(1);
}

const byProvince = new Map<string, number>();
for (const record of records) {
  byProvince.set(record.sourceProvince, (byProvince.get(record.sourceProvince) ?? 0) + 1);
}
console.log(`解析成功：${records.length} 条记录`);
for (const [province, count] of byProvince) console.log(`  ${province}: ${count} 条`);

if (values['dry-run']) {
  console.log('（dry-run，未写入数据库）');
  process.exit(0);
}

const db = createDatabase(values.db);
const versionName = values.version ?? `CSV 导入 ${new Date().toISOString().slice(0, 10)}`;
if (values.merge) {
  upsertAdmissionRecords(db, records, versionName);
  console.log(`已增量合并 ${records.length} 条（版本：${versionName}）`);
} else {
  replaceAdmissionRecords(db, records, versionName);
  console.log(`已整库替换为 ${records.length} 条（版本：${versionName}）`);
}
