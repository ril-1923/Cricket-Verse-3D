import type { Player } from '../types/cricket';
import { BALL_R, Ball, PathPoint, predictPath } from './ballPhysics';

export type FieldPreset = 'attacking' | 'balanced' | 'defensive';
// 9 outfielders as (off, z). `off` is metres toward the off side; negative = leg side. z in world coordinates.
const PRESETS: Record<FieldPreset, [number, number][]> = {
  balanced:   [[2.2, -14], [17, -8], [22, 4], [12, 26], [-12, 26], [-24, 6], [-24, -9], [-26, -44], [30, -44]],
  attacking:  [[2.2, -14], [5, -12.5], [11, -1], [10, 20], [-10, 20], [-12, 0], [-16, -9], [-20, -35], [14, -8]],
  defensive:  [[44, -10], [38, 20], [22, 48], [-22, 48], [-42, 12], [-46, -8], [-26, -42], [32, -40], [20, 8]],
};
export const FIELD_PRESETS = Object.keys(PRESETS) as FieldPreset[];

/** World positions for the nine fielders (excl. bowler & keeper); mirrored for left-handers; scaled to fit the stadium. */
export function fieldPositions(preset: FieldPreset, hand: 'R' | 'L', rx: number, rz: number): { x: number; z: number }[] {
  const sign = hand === 'R' ? -1 : 1;
  return PRESETS[preset].map(([off, z]) => {
    let x = sign * off, zz = z;
    const k = Math.hypot(x / rx, zz / rz);
    if (k > 0.86) { x *= 0.86 / k; zz *= 0.86 / k; }
    return { x, z: zz };
  });
}
export const keeperZ = (style: string) => (style === 'fast' ? -19 : style === 'medium' ? -15 : -11.6);

export interface FielderRef { e: { x: number; z: number; id: string }; p: Player; isKeeper: boolean; isBowler: boolean }
export interface Intercept { f: FielderRef; t: number; x: number; z: number; air: boolean; feasible: boolean; lag: number }
export interface Plan {
  chaser: Intercept | null; catchers: Intercept[]; boundaryT: number | null; path: PathPoint[]; end: { x: number; z: number };
}
export const fielderSpeed = (p: Player) => p.speed * (0.86 + p.fielding / 520);

/** Predicts the ball path, then finds who can reach it first. The fastest-to-intercept fielder chases; air interceptors line up catches. */
export function planFielding(ball: Ball, fielders: FielderRef[], rx: number, rz: number): Plan {
  const path = predictPath(ball, rx, rz, 9, 0.05);
  const last = path[path.length - 1] ?? { x: ball.x, z: ball.z, t: 0 };
  const outside = (last as PathPoint).t > 0 && ((last.x / rx) ** 2 + (last.z / rz) ** 2 >= 1);
  const boundaryT = outside ? last.t : null;
  const all: Intercept[] = [];
  for (const f of fielders) {
    const sp = fielderSpeed(f.p);
    let best: Intercept | null = null, least: Intercept | null = null;
    for (const pt of path) {
      if (pt.air && (pt.y > 2.4 || pt.y < 0.3)) { /* only catchable band while airborne */ if (pt.y > 2.4) continue; }
      const d = Math.hypot(pt.x - f.e.x, pt.z - f.e.z);
      const reach = pt.air ? 1.0 : 0.8;
      const need = 0.4 + Math.max(0, d - reach - 0.25) / sp;
      const lag = need - pt.t;
      const cand: Intercept = { f, t: pt.t, x: pt.x, z: pt.z, air: pt.air, feasible: lag <= 0, lag };
      if (cand.feasible && !best) best = cand;
      if (!least || lag < least.lag) least = cand;
      if (best) break;
    }
    const pick = best ?? least ?? { f, t: 0, x: last.x, z: last.z, air: false, feasible: false, lag: 99 };
    all.push(pick);
  }
  const feas = all.filter((c) => c.feasible).sort((a, b) => a.t - b.t);
  const chaser = feas[0] ?? all.slice().sort((a, b) => a.lag - b.lag)[0] ?? null;
  return { chaser, catchers: feas.filter((c) => c.air && c !== chaser).slice(0, 2), boundaryT, path, end: { x: last.x, z: last.z } };
}
export { BALL_R };
