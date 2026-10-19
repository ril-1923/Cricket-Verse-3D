import type { Innings, Player } from '../types/cricket';
import { canBowl, maxOversPerBowler } from './cricketRules';
import { RNG, clamp } from '../utils/rng';

export interface Situation {
  chasing: boolean; ballsLeft: number; overs: number; wicketsInHand: number; runsNeeded: number | null;
  reqRR: number | null; curRR: number; phase: 'powerplay' | 'middle' | 'death'; progress: number;
}
export function situation(inn: Innings): Situation {
  const total = inn.maxOvers * 6, left = total - inn.legalBalls, progress = inn.legalBalls / total;
  const need = inn.target != null ? Math.max(0, inn.target - inn.runs) : null;
  return {
    chasing: inn.target != null, ballsLeft: left, overs: inn.maxOvers, wicketsInHand: inn.maxWickets - inn.wickets,
    runsNeeded: need, reqRR: need != null && left > 0 ? (need * 6) / left : null,
    curRR: inn.legalBalls ? (inn.runs * 6) / inn.legalBalls : 0,
    phase: progress < 0.25 ? 'powerplay' : progress > 0.8 ? 'death' : 'middle', progress,
  };
}
export type Mood = 'defensive' | 'balanced' | 'attacking';
/** Batting aggression 0..1 plus the risk margin (seconds) the batters accept on quick singles. */
export function battingMood(s: Situation, batter: Player): { aggression: number; mood: Mood; runRisk: number } {
  let a = s.chasing ? 0.52 : 0.55;
  if (s.phase === 'powerplay') a += 0.1;
  if (s.phase === 'death') a += 0.25;
  if (s.chasing && s.reqRR != null) a += clamp((s.reqRR - 7.5) / 9, -0.2, 0.45);
  if (s.chasing && s.runsNeeded != null && s.runsNeeded < 10 && s.reqRR != null && s.reqRR < 6) a -= 0.15; // protect the lead
  a -= (1 - s.wicketsInHand / 10) * 0.3;                    // wickets falling -> more careful
  if (s.wicketsInHand <= 2 && !(s.reqRR != null && s.reqRR > 12)) a -= 0.15;
  a *= 0.75 + (batter.batting / 100) * 0.4;
  a = clamp(a, 0.08, 1);
  const protect = s.chasing && s.reqRR != null && s.reqRR < 6;
  return { aggression: a, mood: a < 0.3 ? 'defensive' : a > 0.62 ? 'attacking' : 'balanced', runRisk: protect ? 0.6 : clamp(0.05 - a * 0.6, -0.45, 0.4) };
}
export type BowlPlan = 'defend' | 'balanced' | 'attack';
export function bowlingPlan(s: Situation, inn: Innings): BowlPlan {
  if (s.chasing) {
    if (s.reqRR != null && s.reqRR > 10 && s.wicketsInHand > 4) return 'defend';        // protect a lead
    if (s.reqRR != null && s.reqRR < 6.5) return 'attack';                                // need wickets
    return 'balanced';
  }
  if (s.phase === 'death') return 'defend';
  if (inn.wickets === 0 && s.phase === 'powerplay') return 'attack';
  return s.curRR > 9 ? 'attack' : 'balanced';
}
export const fieldPresetFor = (plan: BowlPlan, s: Situation) =>
  s.phase === 'powerplay' ? (plan === 'defend' ? 'balanced' : 'attacking') : plan === 'defend' || s.phase === 'death' ? 'defensive' : plan === 'attack' ? 'attacking' : 'balanced';

/** Chooses the next bowler: respects overs-per-bowler and no consecutive overs; prefers pace early/late and spin through the middle. */
export function pickBowler(inn: Innings, squad: Player[], rng: RNG, exclude: string[] = []): string {
  const s = situation(inn);
  const maxPer = maxOversPerBowler(inn.maxOvers);
  const elig = squad.filter((p) => !exclude.includes(p.id) && p.bowling >= 40 && canBowl(inn, p.id, maxPer));
  const pool = elig.length ? elig : squad.filter((p) => !exclude.includes(p.id) && canBowl(inn, p.id, 99));
  const list = pool.length ? pool : squad.filter((p) => p.id !== inn.lastBowlerId);
  const weights = list.map((p) => {
    let w = Math.pow(p.bowling / 50, 3);
    const spin = p.bowlStyle === 'offspin' || p.bowlStyle === 'legspin';
    if (s.phase === 'middle' && spin) w *= 1.5;
    if ((s.phase === 'powerplay' || s.phase === 'death') && p.bowlStyle === 'fast') w *= 1.6;
    return w;
  });
  return rng.weighted(list, weights).id;
}
