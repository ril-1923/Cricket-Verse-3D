import type { DeliverySpec, Player, Shot } from '../types/cricket';
import { RNG, clamp } from '../utils/rng';

export interface ShotModel { h: [number, number]; line: [number, number]; dir: [number, number]; base: number; launch: number; lead: number; attacking: boolean }
/** Per-shot ideal windows (height at bat plane in m, line in m toward off side), direction (deg from straight, + = off side), speed and launch angle. */
export const SHOTS: Record<Shot, ShotModel> = {
  leave:  { h: [0, 3], line: [-9, 9], dir: [0, 0], base: 0, launch: 0, lead: 0.1, attacking: false },
  defend: { h: [0, 1.5], line: [-0.55, 0.6], dir: [-8, 8], base: 3.6, launch: 2, lead: 0.2, attacking: false },
  drive:  { h: [0.05, 0.85], line: [-0.15, 0.85], dir: [-40, 65], base: 27, launch: 4, lead: 0.26, attacking: false },
  cut:    { h: [0.45, 1.15], line: [0.55, 1.9], dir: [65, 130], base: 24, launch: 6, lead: 0.26, attacking: true },
  pull:   { h: [0.85, 1.7], line: [-0.7, 0.45], dir: [-115, -15], base: 28, launch: 12, lead: 0.28, attacking: true },
  glance: { h: [0.1, 1.05], line: [-1.3, -0.1], dir: [-165, -100], base: 19, launch: 4, lead: 0.24, attacking: false },
  sweep:  { h: [0, 0.65], line: [-0.7, 0.6], dir: [-125, -35], base: 21, launch: 8, lead: 0.3, attacking: true },
  loft:   { h: [0.05, 1.05], line: [-0.45, 0.85], dir: [-60, 60], base: 31, launch: 24, lead: 0.3, attacking: true },
};
export interface Arrival { lineOff: number; height: number; t: number; bounced: boolean; length: number }
export interface ShotPlan { shot: Shot; dir: number; power: number }
export interface FieldPoint { x: number; z: number }

const toOffSign = (hand: 'R' | 'L') => (hand === 'R' ? -1 : 1); // world x of "off side" for this hand

/** Direction (deg) within [lo,hi] that points to the biggest gap among fielders (sampled at ~35 m). */
export function bestGap(lo: number, hi: number, hand: 'R' | 'L', fielders: FieldPoint[], rng: RNG, bias = 0): number {
  let best = (lo + hi) / 2, bestScore = -1;
  const sign = toOffSign(hand);
  for (let i = 0; i <= 8; i++) {
    const a = lo + ((hi - lo) * i) / 8;
    const r = (a * Math.PI) / 180;
    const px = sign * Math.sin(r) * 35, pz = -9 + Math.cos(r) * 35;
    let dmin = 99;
    for (const f of fielders) dmin = Math.min(dmin, Math.hypot(f.x - px, f.z - pz));
    const score = dmin + rng.range(0, 6) - Math.abs(a - bias) * 0.03;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

export function chooseShot(o: {
  batter: Player; bowler: Player; spec: DeliverySpec; arr: Arrival; aggression: number; fielders: FieldPoint[]; rng: RNG; freeHit: boolean;
}): ShotPlan {
  const { batter, spec, arr, rng } = o;
  const a = clamp(o.freeHit ? o.aggression + 0.3 : o.aggression, 0.05, 1);
  const spin = spec.style === 'offspin' || spec.style === 'legspin';
  const wide = arr.lineOff > 1.05 || arr.lineOff < -0.95 || arr.height > 1.95;
  if (wide && !(a > 0.8 && rng.chance(0.35)) && rng.chance(0.9)) return { shot: 'leave', dir: 0, power: 0 };

  const cands: [Shot, number][] = [];
  const h = arr.height, L = arr.length, line = arr.lineOff;
  const att = (w: number) => w * (0.35 + 1.7 * a), def = (w: number) => w * (1.1 - 0.9 * a);
  if (arr.bounced === false) { cands.push(['drive', 3], ['loft', att(2.5)], ['defend', def(1.5)], ['glance', line < -0.2 ? 2 : 0.2]); }
  else if (L < 1.7) cands.push(['defend', def(3)], ['loft', att(1.8)], ['drive', 1.2]);
  else if (L < 3.6) cands.push(['drive', 3], ['loft', att(2)], ['defend', def(1.5)], ['glance', line < -0.2 ? 2.2 : 0.2], ['sweep', spin ? att(1.4) : 0]);
  else if (L < 6.2) cands.push(['defend', def(2.6)], ['drive', line < 0.9 && h < 1.0 ? 2.4 : 0.4], ['glance', line < -0.2 ? 2 : 0.2], ['cut', line > 0.6 ? att(1.6) : 0], ['loft', att(1.1)], ['sweep', spin && h < 0.6 ? att(1.6) : 0]);
  else { cands.push(['pull', h > 0.8 && line < 0.6 ? att(2.4) : 0.2], ['cut', line > 0.5 ? att(2.2) : 0.1], ['defend', def(1.2)], ['leave', h > 1.5 ? def(2) : 0.2], ['loft', att(0.6)]); }
  const shot = rng.weighted(cands.map((c) => c[0]), cands.map((c) => Math.max(0.01, c[1])));
  const m = SHOTS[shot];
  const dir = shot === 'defend' ? rng.range(-6, 6) : bestGap(m.dir[0], m.dir[1], batter.hand, o.fielders, rng, shot === 'drive' ? (line > 0.4 ? 25 : -10) : 0);
  return { shot, dir, power: clamp(0.62 + 0.38 * a + rng.range(-0.05, 0.05), 0.5, 1) };
}
