import { describe, expect, it } from 'vitest';
import { MatchEngine } from './matchEngine';
import type { MatchConfig } from '../types/cricket';
import { useTournament, standings } from '../store/tournamentStore';

const base = (o: Partial<MatchConfig>): MatchConfig => ({
  teamAId: 'chennai-strikers', teamBId: 'mumbai-falcons', format: 'quick', overs: 2, stadiumId: 'marina', night: false, mode: 'auto',
  controlTeam: 'A', difficulty: 'normal', speed: 1, tossWinner: 'A', battingFirst: 'A', seed: 21, ...o,
});
describe('interactive modes', () => {
  it('interactive batting: user shots change outcomes; match completes', () => {
    const e = new MatchEngine(base({ mode: 'bat', controlTeam: 'A' })); e.start();
    let shots = 0, contacts = 0;
    for (let i = 0; i < 300000 && e.phase !== 'finished'; i++) {
      e.stepFixed(1 / 60);
      if (e.sim && e.canPlayShot && e.sim.ball.z < 2 && e.sim.ball.vz < 0 && e.sim.ball.z > -4) { if (e.playShot('drive', 20, 0.9)) shots++; }
      if (e.sim?.phase === 'play' && e.userBatting) e.run();
    }
    expect(e.phase).toBe('finished'); expect(shots).toBeGreaterThan(0);
    contacts = e.match.innings[0].balls.filter((b) => b.contact === 'clean' || b.contact === 'edge').length;
    expect(contacts).toBeGreaterThan(0);
    for (const inn of e.match.innings) expect(inn.runs).toBe(inn.balls.reduce((a, b) => a + b.runs, 0));
  }, 120000);
  it('interactive bowling: waits for the user, then bowls the chosen delivery', () => {
    const e = new MatchEngine(base({ mode: 'bowl', controlTeam: 'B', battingFirst: 'A' })); e.start();
    let bowled = 0;
    for (let i = 0; i < 400000 && e.phase !== 'finished'; i++) {
      e.stepFixed(1 / 60);
      if (e.awaitingBowl) { e.setUserSpec({ style: 'medium', pace: 27, lineOff: 0.4, length: 4.5 }); e.startRunup(); bowled++; }
      if (e.sim?.phase === 'runup' && e.sim.s.bowler.e.z < 10.5) e.releaseBall();
    }
    expect(e.phase).toBe('finished'); expect(bowled).toBeGreaterThan(5);
    const mediums = e.match.innings[0].balls.filter((b) => b.spec.style === 'medium').length;
    expect(mediums).toBe(e.match.innings[0].balls.length);
  }, 120000);
  it('pause stops progress, resume continues, restart resets state', () => {
    const e = new MatchEngine(base({})); e.start(); for (let i = 0; i < 600; i++) e.update(1 / 60);
    e.pause(); const t = e.clock.simTime, runs = e.inn.runs; for (let i = 0; i < 300; i++) e.update(1 / 60);
    expect(e.clock.simTime).toBe(t); expect(e.inn.runs).toBe(runs);
    e.resume(); for (let i = 0; i < 300; i++) e.update(1 / 60); expect(e.clock.simTime).toBeGreaterThan(t);
    e.reset(); expect(e.match.current).toBe(0); expect(e.inn.runs).toBe(0); expect(e.inn.legalBalls).toBe(0); expect(e.phase).toBe('ready');
  });
  it('speed multiplier changes clock rate, not scores', () => {
    const a = new MatchEngine(base({ speed: 1 })), b = new MatchEngine(base({ speed: 2 })); a.start(); b.start();
    for (let i = 0; i < 300; i++) { a.update(1 / 60); b.update(1 / 60); }
    expect(b.clock.simTime).toBeCloseTo(a.clock.simTime * 2, 0);
  });
  it('practice mode keeps running past an innings', () => {
    const e = new MatchEngine(base({ mode: 'practice', practiceKind: 'batting', controlTeam: 'A', overs: 50 })); e.start();
    for (let i = 0; i < 60000; i++) { e.stepFixed(1 / 60); if (e.canPlayShot) e.playShot('defend', 0, 0.5); }
    expect(e.practice.balls).toBeGreaterThan(5); expect(e.phase).not.toBe('finished');
  }, 60000);
});
describe('tournament', () => {
  it('derives standings, playoffs and champion from simulated matches', () => {
    const T = useTournament.getState(); T.create(['chennai-strikers', 'mumbai-falcons', 'bengaluru-blazers', 'delhi-warriors'], 2); useTournament.getState().simulateAll();
    const t = useTournament.getState().t!;
    expect(t.matches.filter((m) => m.stage === 'league')).toHaveLength(6); expect(t.matches.every((m) => m.done)).toBe(true);
    expect(t.matches.some((m) => m.stage === 'final')).toBe(true); expect(t.champion).toBeTruthy();
    const rows = standings(t); expect(rows.reduce((a, r) => a + r.p, 0)).toBe(12);
    expect(rows.reduce((a, r) => a + r.pts, 0)).toBeGreaterThanOrEqual(12);
  }, 120000);
});
