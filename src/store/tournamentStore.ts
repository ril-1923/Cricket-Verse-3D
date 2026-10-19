import { create } from 'zustand';
import type { MatchConfig, MatchRecord } from '../types/cricket';
import { KEYS, load, save, remove } from '../services/persistence';
import { simulateInstantly } from '../services/simulate';
import { netRunRate } from '../utils/calculations';
import { useHistory } from './historyStore';

export interface TMatch {
  id: string; stage: 'league' | 'semi' | 'final'; a: string; b: string; done: boolean; winner?: string | null; text?: string;
  sum?: { aRuns: number; aBalls: number; bRuns: number; bBalls: number; aOut: boolean; bOut: boolean }; recordId?: string; viaSimulation?: boolean;
}
export interface Tournament { id: string; teamIds: string[]; overs: number; seed: number; matches: TMatch[]; champion?: string; created: number }
export interface Row { teamId: string; p: number; w: number; l: number; t: number; pts: number; rf: number; bf: number; ra: number; bb: number; nrr: number }

export function standings(t: Tournament): Row[] {
  const rows = new Map<string, Row>(t.teamIds.map((id) => [id, { teamId: id, p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, bf: 0, ra: 0, bb: 0, nrr: 0 }]));
  const quota = t.overs * 6;
  for (const m of t.matches) {
    if (m.stage !== 'league' || !m.done || !m.sum) continue;
    const A = rows.get(m.a)!, B = rows.get(m.b)!, s = m.sum;
    const ab = s.aOut ? quota : s.aBalls, bb = s.bOut ? quota : s.bBalls; // all-out sides are charged their full quota (standard NRR rule)
    A.p++; B.p++; A.rf += s.aRuns; A.bf += ab; A.ra += s.bRuns; A.bb += bb; B.rf += s.bRuns; B.bf += bb; B.ra += s.aRuns; B.bb += ab;
    if (m.winner === m.a) { A.w++; B.l++; A.pts += 2; } else if (m.winner === m.b) { B.w++; A.l++; B.pts += 2; } else { A.t++; B.t++; A.pts++; B.pts++; }
  }
  const out = [...rows.values()];
  for (const r of out) r.nrr = netRunRate(r.rf, r.bf, r.ra, r.bb);
  return out.sort((x, y) => y.pts - x.pts || y.nrr - x.nrr);
}
export const leagueDone = (t: Tournament) => t.matches.filter((m) => m.stage === 'league').every((m) => m.done);
export function qualification(t: Tournament): Record<string, 'qualified' | 'alive' | 'out'> {
  const rows = standings(t), out: Record<string, 'qualified' | 'alive' | 'out'> = {};
  const league = t.matches.filter((m) => m.stage === 'league');
  const left = (id: string) => league.filter((m) => !m.done && (m.a === id || m.b === id)).length;
  const done = leagueDone(t), top = Math.min(4, rows.length);
  rows.forEach((r, i) => {
    const maxPts = r.pts + left(r.teamId) * 2;
    const fourth = rows[top - 1]?.pts ?? 0;
    if (done) out[r.teamId] = i < top ? 'qualified' : 'out';
    else if (maxPts < fourth) out[r.teamId] = 'out';
    else if (rows.filter((x) => x.teamId !== r.teamId && x.pts + left(x.teamId) * 2 > r.pts).length < top - 1 && r.pts > 0 && rows.filter((x) => x.teamId !== r.teamId && x.pts + left(x.teamId) * 2 >= r.pts).length <= top - 1) out[r.teamId] = 'qualified';
    else out[r.teamId] = 'alive';
  });
  return out;
}
const valid = (v: unknown) => v === null || (!!v && typeof v === 'object' && Array.isArray((v as Tournament).matches) && Array.isArray((v as Tournament).teamIds));

interface T {
  t: Tournament | null;
  create: (teamIds: string[], overs: number) => void;
  reset: () => void;
  record: (matchId: string, rec: MatchRecord, simulated: boolean) => void;
  simulate: (matchId: string) => void;
  simulateAll: () => void;
  configFor: (matchId: string, base: Partial<MatchConfig>) => MatchConfig | null;
}
const persist = (t: Tournament | null) => { if (t) save(KEYS.tournament, t); else remove(KEYS.tournament); };

function advance(t: Tournament): Tournament {
  const rows = standings(t);
  const hasStage = (s: TMatch['stage']) => t.matches.some((m) => m.stage === s);
  if (leagueDone(t) && !hasStage('semi') && !t.champion) {
    const [a, b, c, d] = rows.map((r) => r.teamId);
    t.matches.push({ id: 'sf1', stage: 'semi', a, b: d, done: false }, { id: 'sf2', stage: 'semi', a: b, b: c, done: false });
  }
  const semis = t.matches.filter((m) => m.stage === 'semi');
  if (semis.length === 2 && semis.every((m) => m.done) && !hasStage('final')) t.matches.push({ id: 'final', stage: 'final', a: semis[0].winner!, b: semis[1].winner!, done: false });
  const fin = t.matches.find((m) => m.stage === 'final');
  if (fin?.done) t.champion = fin.winner ?? undefined;
  return t;
}

export const useTournament = create<T>((set, get) => ({
  t: load<Tournament | null>(KEYS.tournament, null, valid),
  create: (teamIds, overs) => {
    const matches: TMatch[] = [];
    for (let i = 0; i < teamIds.length; i++) for (let j = i + 1; j < teamIds.length; j++) matches.push({ id: `L${matches.length + 1}`, stage: 'league', a: teamIds[i], b: teamIds[j], done: false });
    const t: Tournament = { id: `t${Date.now().toString(36)}`, teamIds, overs, seed: Math.floor(Math.random() * 1e9), matches, created: Date.now() };
    persist(t); set({ t });
  },
  reset: () => { persist(null); set({ t: null }); },
  record: (matchId, rec, simulated) => {
    const cur = get().t; if (!cur) return;
    const t: Tournament = structuredClone(cur);
    const m = t.matches.find((x) => x.id === matchId); if (!m || m.done) return;
    const innA = rec.innings.find((i) => i.battingTeamId === m.a), innB = rec.innings.find((i) => i.battingTeamId === m.b);
    if (!innA || !innB) return;
    m.done = true; m.text = rec.result.text; m.recordId = rec.id; m.viaSimulation = simulated;
    m.sum = { aRuns: innA.runs, aBalls: innA.legalBalls, bRuns: innB.runs, bBalls: innB.legalBalls, aOut: innA.endReason === 'allout', bOut: innB.endReason === 'allout' };
    if (rec.result.tied || !rec.result.winnerTeamId) {
      if (m.stage === 'league') m.winner = null;
      else { const rows = standings(t); m.winner = rows.findIndex((r) => r.teamId === m.a) < rows.findIndex((r) => r.teamId === m.b) ? m.a : m.b; m.text += ' (better league position advances)'; }
    } else m.winner = rec.result.winnerTeamId;
    advance(t); persist(t); set({ t });
  },
  configFor: (matchId, base) => {
    const t = get().t; const m = t?.matches.find((x) => x.id === matchId); if (!t || !m) return null;
    const seed = (t.seed + matchId.split('').reduce((a, c) => a + c.charCodeAt(0) * 17, 0)) >>> 0;
    return { teamAId: m.a, teamBId: m.b, format: 'quick', overs: t.overs, stadiumId: 'marina', night: false, mode: 'auto', controlTeam: 'A', difficulty: 'normal', speed: 1, tossWinner: 'A', battingFirst: seed % 2 ? 'A' : 'B', seed, tournamentMatchId: matchId, ...base } as MatchConfig;
  },
  simulate: (matchId) => {
    const cfg = get().configFor(matchId, {}); if (!cfg) return;
    const rec = simulateInstantly(cfg); useHistory.getState().add(rec); get().record(matchId, rec, true);
  },
  simulateAll: () => {
    for (let guard = 0; guard < 60; guard++) {
      const next = get().t?.matches.find((m) => !m.done); if (!next) break; get().simulate(next.id);
    }
  },
}));
