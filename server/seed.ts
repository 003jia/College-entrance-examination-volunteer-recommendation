import { createDatabase, replaceAdmissionRecords, replaceScoreSegments } from './db';
import { admissionRecords } from '../src/data';
import { builtinScoreTables } from '../src/scoreRank';

export function seedDatabase(db = createDatabase()) {
  replaceAdmissionRecords(db, admissionRecords);
  const segments = builtinScoreTables().flatMap(({ province, year, track, segments: rows }) =>
    rows.map((row) => ({ province, year, track, score: row.score, rank: row.rank })),
  );
  replaceScoreSegments(db, segments);
  return {
    recordCount: admissionRecords.length,
    segmentCount: segments.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = seedDatabase();
  console.log(`Seeded ${result.recordCount} admission records and ${result.segmentCount} score segments.`);
}
