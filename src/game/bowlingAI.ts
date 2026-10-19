import type { DeliverySpec, Innings, Player } from '../types/cricket';
import type { BowlPlan } from './tacticalAI';
import { RNG, clamp } from '../utils/rng';

const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
/** Deterministic per-batter weakness used by the bowling AI. */
export const weaknessOf = (p: Player): 'short' | 'full' | 'off' | 'leg' => (['short', 'full', 'off', 'leg'] as const)[hash(p.id) % 4];

export const LENGTHS = { fullToss: 0.2, yorker: 1.0, full: 2.6, good: 4.8, back: 6.4, short: 7.6, bouncer: 8.6 } as const;
const PACE: Record<string, [number, number]> = { fast: [31, 36], medium: [25, 29], offspin: [19, 23], legspin: [18, 22] };

export function paceRange(style: string) { return PACE[style] ?? PACE.medium; }

/** Builds a delivery spec: lengths/lines from tactical plan + batter weakness, variety from recent deliveries. */
export function chooseDelivery(o: { bowler: Player; batter: Player; plan: BowlPlan; inn: Innings; rng: RNG; recent: string[] }): DeliverySpec {
  const { bowler, batter, plan, rng } = o;
  const style = bowler.bowlStyle;
  const spin = style === 'offspin' || style === 'legspin';
  const weak = weaknessOf(batter);
  const targetWeak = plan === 'attack' ? rng.chance(0.45) : rng.chance(0.2);
  const opts: [string, number, number][] = []; // label, length, lineOff
  const stump = rng.range(-0.1, 0.25), outside = rng.range(0.3, 0.7), leg = rng.range(-0.45, -0.1);
  if (plan === 'defend') opts.push(['Good length', LENGTHS.good, outside], ['Yorker', LENGTHS.yorker, stump], ['Back of a length', LENGTHS.back, outside], ['Full', LENGTHS.full, outside + 0.2], ['Good length', LENGTHS.good, stump]);
  else if (plan === 'attack') opts.push(['Full', LENGTHS.full, stump], ['Good length', LENGTHS.good, stump], ['Short', LENGTHS.short, stump], ['Yorker', LENGTHS.yorker, stump], ['Good length', LENGTHS.good, outside], ['Bouncer', LENGTHS.bouncer, stump]);
  else opts.push(['Good length', LENGTHS.good, outside], ['Full', LENGTHS.full, outside], ['Back of a length', LENGTHS.back, stump], ['Yorker', LENGTHS.yorker, stump], ['Short', LENGTHS.short, outside], ['Good length', LENGTHS.good, leg]);
  if (spin) { for (const x of opts) if (x[0] === 'Yorker' || x[0] === 'Bouncer' || x[0] === 'Short') { x[0] = 'Good length'; x[1] = rng.range(3.2, 5.2); } }
  let pick = rng.pick(opts);
  if (targetWeak) {
    if (weak === 'short') pick = ['Short', LENGTHS.short, stump];
    if (weak === 'full') pick = ['Full', LENGTHS.full, stump];
    if (weak === 'off') pick = ['Good length', LENGTHS.good, rng.range(0.55, 0.8)];
    if (weak === 'leg') pick = ['Good length', LENGTHS.good, rng.range(-0.5, -0.2)];
    if (spin && (pick[0] === 'Short')) pick = ['Good length', rng.range(3.4, 5), pick[2]];
  }
  if (o.recent.slice(-2).every((r) => r === pick[0]) && o.recent.length >= 2) pick = rng.pick(opts); // variety
  const [lo, hi] = paceRange(style);
  let pace = rng.range(lo, hi);
  let label = pick[0];
  if (!spin && rng.chance(0.14)) { pace *= 0.82; label = 'Slower ball'; }
  const handFlip = batter.hand === 'R' ? 1 : -1;
  let turn = 0;
  if (style === 'offspin') turn = -rng.range(0.7, 1.9) * handFlip;
  else if (style === 'legspin') turn = rng.range(0.7, 1.9) * handFlip;
  else turn = rng.range(-0.5, 0.5);
  // rare loose delivery (more often for weaker bowlers) so wides / full tosses appear naturally
  return { style, pace, lineOff: clamp(pick[2], -1.1, 1.3), length: clamp(pick[1], 0.2, 9), turn, label };
}
