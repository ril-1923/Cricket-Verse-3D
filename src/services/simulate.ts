import type { MatchConfig, MatchRecord } from '../types/cricket';
import { MatchEngine } from '../game/matchEngine';

/** Instantly simulates a full match with the same engine (no 3D). Returned record is flagged live:false. */
export function simulateInstantly(cfg: MatchConfig): MatchRecord {
  const e = new MatchEngine({ ...cfg, mode: 'auto' }); e.start();
  let n = 0;
  while (e.phase !== 'finished' && n++ < 600000) e.stepFixed(1 / 30);
  if (!e.record) {
    // extremely unlikely safety net: finalise from rules state
    const m = e.match;
    return { id: `m${Date.now().toString(36)}${cfg.seed}`, date: Date.now(), config: cfg, teamAId: cfg.teamAId, teamBId: cfg.teamBId, innings: m.innings, result: m.result ?? { winnerTeamId: null, tied: true, margin: 'tie', text: 'Match tied' }, live: false, tournamentMatchId: cfg.tournamentMatchId };
  }
  return { ...e.record, live: false };
}
