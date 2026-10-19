import { describe, expect, it } from 'vitest';
import { MatchEngine } from './matchEngine';
import type { MatchConfig } from '../types/cricket';

const cfg = (seed: number, overs = 2, battingFirst: 'A' | 'B' = 'A'): MatchConfig => ({
  teamAId: 'chennai-strikers', teamBId: 'mumbai-falcons', format: 'quick', overs, stadiumId: 'marina', night: false, mode: 'auto',
  controlTeam: 'A', difficulty: 'normal', speed: 1, tossWinner: 'A', battingFirst, seed,
});
export function simulate(c: MatchConfig) {
  const e = new MatchEngine(c); e.start();
  let steps = 0;
  while (e.phase !== 'finished' && steps < 400000) { e.stepFixed(1 / 30); steps++; }
  return { e, steps };
}
describe('match engine (headless)', () => {
  it('plays full matches to a valid result with consistent scores', () => {
    let runs = 0, balls = 0, wk = 0, fours = 0, sixes = 0, dots = 0, wides = 0;
    for (let s = 1; s <= 12; s++) {
      const { e } = simulate(cfg(s, 6, s % 2 ? 'A' : 'B'));
      expect(e.phase).toBe('finished');
      const m = e.match; expect(m.finished).toBe(true); expect(m.result).not.toBeNull();
      for (const inn of m.innings) {
        const sum = inn.balls.reduce((a, b) => a + b.runs, 0);
        expect(inn.runs).toBe(sum); expect(inn.wickets).toBeLessThanOrEqual(10);
        expect(inn.legalBalls).toBe(inn.balls.filter((b) => b.legal).length);
        expect(inn.legalBalls).toBeLessThanOrEqual(36);
        const batSum = Object.values(inn.bat).reduce((a, b) => a + b.runs, 0);
        expect(batSum + inn.extras.wides + inn.extras.noballs + inn.extras.byes + inn.extras.legbyes).toBe(inn.runs);
        runs += inn.runs; balls += inn.legalBalls; wk += inn.wickets;
        for (const b of inn.balls) { if (b.boundary === 4) fours++; if (b.boundary === 6) sixes++; if (b.runs === 0 && b.legal) dots++; if (b.extra === 'wide') wides++; }
      }
    }
    const rpo = (runs * 6) / balls;
    console.log({ rpo: rpo.toFixed(2), wicketsPerMatch: (wk / 12).toFixed(1), fours, sixes, dotPct: ((dots / balls) * 100).toFixed(0), wides, balls });
    expect(rpo).toBeGreaterThan(3); expect(rpo).toBeLessThan(15);
    expect(fours + sixes).toBeLessThan(balls * 0.4);
    expect(dots).toBeGreaterThan(balls * 0.1);
  }, 120000);
  it('is deterministic for the same seed', () => {
    const a = simulate(cfg(99)).e.match, b = simulate(cfg(99)).e.match;
    expect(a.innings[0].runs).toBe(b.innings[0].runs); expect(a.result?.text).toBe(b.result?.text);
  });
  it('positions never contain NaN and players stay near the field', () => {
    const e = new MatchEngine(cfg(5)); e.start();
    for (let i = 0; i < 6000 && e.phase !== 'finished'; i++) {
      e.stepFixed(1 / 30);
      for (const p of e.entities.values()) { expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true); expect(Math.abs(p.x)).toBeLessThan(90); expect(Math.abs(p.z)).toBeLessThan(90); }
      const b = e.ballPos; expect(Number.isFinite(b.x + b.y + b.z)).toBe(true); expect(b.y).toBeGreaterThan(-0.01);
    }
  }, 60000);
});
