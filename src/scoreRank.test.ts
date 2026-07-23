import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRegisteredScoreSegments,
  equivalentScore,
  hasScoreTable,
  normalizeTrack,
  rankToScore,
  registerScoreSegments,
  scoreToRank,
} from './scoreRank';

describe('score-rank table (位次法)', () => {
  it('normalizes tracks to physics / history buckets', () => {
    expect(normalizeTrack('物理类')).toBe('物理类');
    expect(normalizeTrack('物化生')).toBe('物理类');
    expect(normalizeTrack('物化地')).toBe('物理类');
    expect(normalizeTrack('历史类')).toBe('历史类');
  });

  it('converts score to rank monotonically via the table', () => {
    const high = scoreToRank('浙江', 2026, '物理类', 650)!;
    const mid = scoreToRank('浙江', 2026, '物理类', 615)!;
    const low = scoreToRank('浙江', 2026, '物理类', 600)!;

    expect(high).toBeLessThan(mid); // 分数越高位次越靠前（数值越小）
    expect(mid).toBeLessThan(low);
    expect(mid).toBe(21000); // 表内锚点
  });

  it('inverts rank back to score (round-trip is stable)', () => {
    expect(rankToScore('浙江', 2026, '物理类', 21000)).toBe(615);
    const roundTrip = rankToScore('浙江', 2026, '物理类', scoreToRank('浙江', 2026, '物理类', 630)!)!;
    expect(Math.abs(roundTrip - 630)).toBeLessThanOrEqual(2);
  });

  it('computes equivalent (同位分) score from a historical rank', () => {
    // 录取位次约 3600，按今年一分一段表折合约 670 分。
    const eq = equivalentScore({ province: '浙江', year: 2026, track: '物理类' }, 3600)!;
    expect(eq).toBeGreaterThanOrEqual(665);
    expect(eq).toBeLessThanOrEqual(672);
  });

  it('reports table availability and returns null for unknown tables', () => {
    expect(hasScoreTable('浙江', 2026, '物理类')).toBe(true);
    expect(hasScoreTable('北京', 2026, '物理类')).toBe(false);
    expect(scoreToRank('北京', 2026, '物理类', 600)).toBeNull();
    expect(rankToScore('北京', 2026, '物理类', 20000)).toBeNull();
  });

  describe('runtime-registered tables (真实数据接入)', () => {
    afterEach(() => clearRegisteredScoreSegments());

    it('uses registered tables for provinces without built-in samples', () => {
      registerScoreSegments('北京', 2026, '物理类', [
        { score: 700, rank: 500 },
        { score: 600, rank: 15000 },
        { score: 500, rank: 40000 },
      ]);

      expect(hasScoreTable('北京', 2026, '物理类')).toBe(true);
      expect(scoreToRank('北京', 2026, '物理类', 650)).toBe(7750);
    });

    it('prefers registered tables over built-in samples for the same key', () => {
      const before = scoreToRank('浙江', 2026, '物理类', 615);
      registerScoreSegments('浙江', 2026, '物理类', [
        { score: 700, rank: 100 },
        { score: 615, rank: 99999 },
        { score: 500, rank: 200000 },
      ]);

      expect(scoreToRank('浙江', 2026, '物理类', 615)).toBe(99999);
      clearRegisteredScoreSegments();
      expect(scoreToRank('浙江', 2026, '物理类', 615)).toBe(before);
    });
  });
});
