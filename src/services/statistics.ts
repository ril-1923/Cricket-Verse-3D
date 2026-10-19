import type { BallRecord, MatchRecord } from '../types/cricket';
import { findPlayer, getTeam } from '../data/teams';
import { economy, strikeRate } from '../utils/calculations';

export interface PlayerAgg { id: string; name: string; teamId: string; matches: number; runs: number; balls: number; fours: number; sixes: number; outs: number; wickets: number; ballsBowled: number; runsConceded: number; best: number }
export function aggregatePlayers(history: MatchRecord[]): Map<string, PlayerAgg> {
  const m = new Map<string, PlayerAgg>();
  const get = (id: string) => {
    let a = m.get(id); if (!a) { const p = findPlayer(id); a = { id, name: p?.name ?? id, teamId: p?.teamId ?? '', matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, best: 0 }; m.set(id, a); } return a;
  };
  for (const rec of history) {
    const seen = new Set<string>();
    for (const inn of rec.innings) {
      for (const b of Object.values(inn.bat)) { const a = get(b.playerId); a.runs += b.runs; a.balls += b.balls; a.fours += b.fours; a.sixes += b.sixes; if (b.out) a.outs++; a.best = Math.max(a.best, b.runs); seen.add(b.playerId); }
      for (const b of Object.values(inn.bowl)) { const a = get(b.playerId); a.wickets += b.wickets; a.ballsBowled += b.balls; a.runsConceded += b.runs; seen.add(b.playerId); }
    }
    seen.forEach((id) => { get(id).matches++; });
  }
  return m;
}
export const batAvg = (a: PlayerAgg) => (a.outs ? a.runs / a.outs : a.runs);
export const srOf = (a: PlayerAgg) => strikeRate(a.runs, a.balls);
export const ecoOf = (a: PlayerAgg) => economy(a.runsConceded, a.ballsBowled);

export function perOver(rec: MatchRecord, inningsIdx: number) {
  const inn = rec.innings[inningsIdx]; if (!inn) return [];
  const rows: { over: number; runs: number; wickets: number }[] = [];
  for (const b of inn.balls) {
    while (rows.length <= b.over) rows.push({ over: rows.length + 1, runs: 0, wickets: 0 });
    rows[b.over].runs += b.runs; if (b.wicket) rows[b.over].wickets++;
  }
  return rows;
}
export function ballsOf(recs: MatchRecord[], teamId?: string): BallRecord[] {
  const out: BallRecord[] = [];
  for (const r of recs) for (const i of r.innings) if (!teamId || i.battingTeamId === teamId) out.push(...i.balls);
  return out;
}
export function distribution(balls: BallRecord[]) {
  const legal = balls.filter((b) => b.legal);
  const c = { dot: 0, one: 0, two: 0, three: 0, four: 0, six: 0, extras: balls.filter((b) => b.extra).length, wicket: balls.filter((b) => b.wicket).length };
  for (const b of legal) { if (b.runs === 0) c.dot++; else if (b.boundary === 4) c.four++; else if (b.boundary === 6) c.six++; else if (b.runs === 1) c.one++; else if (b.runs === 2) c.two++; else c.three++; }
  const n = legal.length || 1;
  return { ...c, total: legal.length, dotPct: (c.dot / n) * 100, boundaryPct: ((c.four + c.six) / n) * 100 };
}
export function teamRecord(history: MatchRecord[], teamId: string) {
  let p = 0, w = 0, l = 0, t = 0;
  for (const r of history) { if (r.teamAId !== teamId && r.teamBId !== teamId) continue; p++; if (r.result.tied) t++; else if (r.result.winnerTeamId === teamId) w++; else l++; }
  return { played: p, won: w, lost: l, tied: t, pct: p ? (w / p) * 100 : 0, name: getTeam(teamId).name };
}
