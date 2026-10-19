// Pure cricket rules engine. No rendering, no randomness, no clock. Every delivery result is applied exactly once.
import type { BallRecord, DeliveryResult, Innings, MatchMeta, MatchResult, MatchState } from '../types/cricket';
import { formatOvers } from '../utils/formatOvers';

export const BALLS_PER_OVER = 6;
export const maxOversPerBowler = (overs: number) => Math.max(1, Math.ceil(overs / 5));

const clone = <T,>(o: T): T => structuredClone(o);

export function createInnings(o: {
  battingTeamId: string; bowlingTeamId: string; battingOrder: string[]; maxOvers: number; target?: number | null;
}): Innings {
  if (o.battingOrder.length < 2) throw new Error('Need at least two batters');
  const [s, n] = o.battingOrder;
  const blank = (id: string) => ({ playerId: id, runs: 0, balls: 0, fours: 0, sixes: 0, out: false });
  return {
    battingTeamId: o.battingTeamId, bowlingTeamId: o.bowlingTeamId, maxOvers: o.maxOvers,
    maxWickets: o.battingOrder.length - 1, target: o.target ?? null,
    runs: 0, wickets: 0, legalBalls: 0, extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0 },
    battingOrder: [...o.battingOrder], nextBatterIdx: 2, strikerId: s, nonStrikerId: n,
    bowlerId: null, lastBowlerId: null, bat: { [s]: blank(s), [n]: blank(n) }, bowl: {},
    balls: [], appliedIds: [], freeHit: false, partnership: { runs: 0, balls: 0 },
    overRuns: 0, overHadBatRunOrWicket: false, completed: false, endReason: null, fallOfWickets: [],
  };
}

export function bowlerOvers(inn: Innings, id: string) { return Math.floor((inn.bowl[id]?.balls ?? 0) / BALLS_PER_OVER); }

/** True if this player may start the next over. */
export function canBowl(inn: Innings, id: string, maxPer = maxOversPerBowler(inn.maxOvers)) {
  if (inn.completed || id === inn.lastBowlerId) return false;
  const b = inn.bowl[id];
  return !b || b.balls < maxPer * BALLS_PER_OVER;
}

export function setBowler(inn: Innings, bowlerId: string): Innings {
  if (inn.completed) return inn;
  if (inn.legalBalls % BALLS_PER_OVER !== 0 && inn.bowlerId) return inn; // can't change mid-over
  if (bowlerId === inn.lastBowlerId) throw new Error('Same bowler cannot bowl consecutive overs');
  const n = clone(inn);
  n.bowlerId = bowlerId;
  n.bowl[bowlerId] ??= { playerId: bowlerId, balls: 0, runs: 0, wickets: 0, maidens: 0, dots: 0, wides: 0, noballs: 0 };
  return n;
}

export interface ApplyContext { text?: string; nameOf?: (id: string) => string; }

/** Applies one delivery to an innings. Idempotent per delivery id; no-op once innings is complete. */
export function applyDelivery(inn: Innings, r: DeliveryResult, ctx: ApplyContext = {}): Innings {
  if (inn.completed) return inn;
  if (inn.appliedIds.includes(r.id)) return inn;
  if (!inn.bowlerId) throw new Error('No bowler set for delivery');
  const n = clone(inn);
  const name = ctx.nameOf ?? ((id: string) => id);
  const bowlerId = n.bowlerId as string;
  const bowl = n.bowl[bowlerId];
  const striker = n.bat[n.strikerId];
  const strikerId = n.strikerId, nonStrikerId = n.nonStrikerId;
  n.appliedIds.push(r.id);

  const scored = Math.max(0, r.boundary ?? r.runsRan);
  const ran = r.boundary ? 0 : Math.max(0, r.runsRan);
  const legal = r.extra === null;
  let batRuns = 0, extraRuns = 0;
  let extraKind: BallRecord['extra'] = null;

  if (r.extra === 'wide') { extraRuns = 1 + scored; extraKind = 'wide'; n.extras.wides += extraRuns; }
  else if (r.extra === 'noball') {
    extraKind = 'noball'; n.extras.noballs += 1;
    if (r.batContact) { batRuns = scored; extraRuns = 1; }
    else { extraRuns = 1 + scored; if (scored) r.bodyHit ? (n.extras.legbyes += scored) : (n.extras.byes += scored); }
  } else if (r.batContact) batRuns = scored;
  else if (scored > 0) {
    extraRuns = scored; extraKind = r.bodyHit ? 'legbye' : 'bye';
    if (r.bodyHit) n.extras.legbyes += scored; else n.extras.byes += scored;
  }
  const total = batRuns + extraRuns;
  n.runs += total;

  // bowler figures: byes and leg-byes are not charged to the bowler
  const charged = batRuns + (r.extra === 'wide' ? extraRuns : r.extra === 'noball' ? 1 : 0);
  bowl.runs += charged; n.overRuns += charged;
  if (r.extra === 'wide') bowl.wides += extraRuns; if (r.extra === 'noball') bowl.noballs += 1;
  if (legal) { bowl.balls++; n.legalBalls++; if (total === 0) bowl.dots++; }
  if (batRuns > 0) n.overHadBatRunOrWicket = true;

  // batter figures
  if (r.extra !== 'wide') striker.balls++;
  striker.runs += batRuns;
  if (r.batContact && r.boundary === 4) striker.fours++;
  if (r.batContact && r.boundary === 6) striker.sixes++;
  n.partnership.runs += total; if (legal) n.partnership.balls++;

  // strike rotation from completed runs
  if (ran % 2 === 1) [n.strikerId, n.nonStrikerId] = [n.nonStrikerId, n.strikerId];

  // wicket validity: only run-outs on no-balls, free hits and wides
  let w = r.wicket;
  if (w && (n.freeHit || r.extra) && w.kind !== 'runout') w = null;
  if (w && (n.bat[w.batterId]?.out || (w.batterId !== strikerId && w.batterId !== nonStrikerId))) w = null;
  if (w) {
    const out = n.bat[w.batterId];
    out.out = true;
    const fielder = w.fielderId ? name(w.fielderId) : '';
    out.howOut = w.kind === 'bowled' ? `b ${name(bowlerId)}` : w.kind === 'caught' ? `c ${fielder} b ${name(bowlerId)}` : `run out (${fielder || 'fielder'})`;
    n.wickets++;
    if (w.kind !== 'runout') bowl.wickets++;
    n.overHadBatRunOrWicket = true;
    n.fallOfWickets.push({ runs: n.runs, wicket: n.wickets, playerId: w.batterId, over: formatOvers(n.legalBalls) });
    n.partnership = { runs: 0, balls: 0 };
    if (n.wickets < n.maxWickets && n.nextBatterIdx < n.battingOrder.length) {
      const nb = n.battingOrder[n.nextBatterIdx++];
      n.bat[nb] = { playerId: nb, runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
      if (n.strikerId === w.batterId) n.strikerId = nb; else n.nonStrikerId = nb;
    }
  }

  n.freeHit = r.extra === 'noball' ? true : r.extra === 'wide' ? inn.freeHit : false;

  const overDone = legal && n.legalBalls % BALLS_PER_OVER === 0;
  const record: BallRecord = {
    id: r.id, over: Math.floor((legal ? n.legalBalls - 1 : n.legalBalls) / BALLS_PER_OVER),
    ball: legal ? ((n.legalBalls - 1) % BALLS_PER_OVER) + 1 : n.legalBalls % BALLS_PER_OVER,
    strikerId, nonStrikerId, bowlerId, runs: total, batRuns, extraRuns, extra: extraKind, legal,
    boundary: r.boundary, wicket: w, freeHit: inn.freeHit, shot: r.shot, contact: r.contact, spec: r.spec,
    text: ctx.text ?? '', scoreAfter: `${n.runs}/${n.wickets}`,
  };
  n.balls.push(record);

  if (overDone) {
    if (n.overRuns === 0 && !n.overHadBatRunOrWicket && !n.balls.slice(-6).some((b) => b.extra)) bowl.maidens++;
    [n.strikerId, n.nonStrikerId] = [n.nonStrikerId, n.strikerId];
    n.lastBowlerId = bowlerId; n.bowlerId = null; n.overRuns = 0; n.overHadBatRunOrWicket = false;
  }

  if (n.wickets >= n.maxWickets) { n.completed = true; n.endReason = 'allout'; }
  else if (n.target != null && n.runs >= n.target) { n.completed = true; n.endReason = 'target'; }
  else if (n.legalBalls >= n.maxOvers * BALLS_PER_OVER) { n.completed = true; n.endReason = 'overs'; }
  return n;
}

export function createMatch(meta: MatchMeta): MatchState {
  return {
    meta: clone(meta), current: 0, finished: false, result: null,
    innings: [createInnings({ battingTeamId: meta.first.teamId, bowlingTeamId: meta.second.teamId, battingOrder: meta.first.order, maxOvers: meta.overs })],
  };
}

export function computeResult(m: MatchState, teamName: (id: string) => string): MatchResult {
  const [a, b] = m.innings;
  if (b.runs > a.runs) {
    const wk = b.maxWickets - b.wickets, left = b.maxOvers * 6 - b.legalBalls;
    return { winnerTeamId: b.battingTeamId, tied: false, margin: `${wk} wicket${wk === 1 ? '' : 's'}`, text: `${teamName(b.battingTeamId)} won by ${wk} wicket${wk === 1 ? '' : 's'} (${left} ball${left === 1 ? '' : 's'} left)` };
  }
  if (a.runs > b.runs) {
    const d = a.runs - b.runs;
    return { winnerTeamId: a.battingTeamId, tied: false, margin: `${d} run${d === 1 ? '' : 's'}`, text: `${teamName(a.battingTeamId)} won by ${d} run${d === 1 ? '' : 's'}` };
  }
  return { winnerTeamId: null, tied: true, margin: 'tie', text: 'Match tied' };
}

/** Applies a delivery to the current innings and advances innings / match state when appropriate. */
export function applyMatchDelivery(m: MatchState, r: DeliveryResult, teamName: (id: string) => string, ctx: ApplyContext = {}): MatchState {
  if (m.finished) return m;
  const cur = m.innings[m.current];
  const next = applyDelivery(cur, r, ctx);
  if (next === cur) return m;
  const out: MatchState = { ...m, innings: m.innings.map((x, i) => (i === m.current ? next : x)) };
  if (next.completed) {
    if (m.current === 0) {
      out.innings = [...out.innings, createInnings({
        battingTeamId: m.meta.second.teamId, bowlingTeamId: m.meta.first.teamId, battingOrder: m.meta.second.order,
        maxOvers: m.meta.overs, target: next.runs + 1,
      })];
      out.current = 1;
    } else { out.finished = true; out.result = computeResult(out, teamName); }
  }
  return out;
}

/** Ends of innings that happen while the 2nd innings is incomplete are resolved here (used by tests / restarts). */
export const ballsRemaining = (inn: Innings) => inn.maxOvers * BALLS_PER_OVER - inn.legalBalls;
export const currentRunRate = (inn: Innings) => (inn.legalBalls ? (inn.runs * 6) / inn.legalBalls : 0);
