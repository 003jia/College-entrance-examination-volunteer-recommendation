import { createApp } from './app';
import { createDatabase, getAdmissionRecords, getAllScoreSegments, type AppDatabase } from './db';
import { seedDatabase } from './seed';
import { registerScoreSegments } from '../src/scoreRank';

// 用专属变量而非通用 PORT：开发工具（如预览器）常注入 PORT，会让 API 与 Vite 抢端口。
const port = Number(process.env.GAOKAO_API_PORT ?? 8787);
const db = createDatabase();

if (getAdmissionRecords(db).length === 0) {
  seedDatabase(db);
}

loadScoreSegments(db);

const app = createApp({ db });

app.listen(port, '127.0.0.1', () => {
  console.log(`Gaokao API listening on http://127.0.0.1:${port}`);
});

/** 把数据库中的一分一段表注册进换算引擎（导入真实表后重启即生效）。 */
function loadScoreSegments(database: AppDatabase) {
  const grouped = new Map<string, Array<{ score: number; rank: number }>>();
  for (const row of getAllScoreSegments(database)) {
    const key = `${row.province}:${row.year}:${row.track}`;
    const list = grouped.get(key) ?? [];
    list.push({ score: row.score, rank: row.rank });
    grouped.set(key, list);
  }
  for (const [key, segments] of grouped) {
    const [province, year, track] = key.split(':');
    registerScoreSegments(province, Number(year), track, segments);
  }
  console.log(`Loaded ${grouped.size} score-segment table(s) from database.`);
}
