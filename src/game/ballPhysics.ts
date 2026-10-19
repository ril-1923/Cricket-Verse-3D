// Lightweight custom ball physics: gravity, quadratic drag, pitch/outfield bounce, rolling friction, spin/seam deviation.
export const G = 9.81;
export const BALL_R = 0.036;
export const STUMP_Z = 10.06;       // stumps at z = +/-10.06
export const STUMP_HALF = 0.114;    // half the stump width (9 in)
export const STUMP_H = 0.711;       // 28 in
export const CREASE_Z = 8.84;       // popping crease
export const BAT_PLANE_Z = -9.1;    // plane where bat meets ball
export const PITCH_HALF_W = 1.6;
export const PITCH_HALF_L = 11;

export interface Ball {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  bounces: number;          // total bounces since release
  bouncesSinceHit: number;  // bounces since bat contact (or throw)
  turnPending: number;      // lateral velocity (m/s) applied at first pitch bounce
  pitchFriction: number;    // horizontal speed kept after pitch bounce
  stopped: boolean;
}
export const newBall = (): Ball => ({ x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, bounces: 0, bouncesSinceHit: 0, turnPending: 0, pitchFriction: 0.8, stopped: true });
export const cloneBall = (b: Ball): Ball => ({ ...b });
export const speedOf = (b: Ball) => Math.hypot(b.vx, b.vy, b.vz);
export const onPitch = (x: number, z: number) => Math.abs(x) < PITCH_HALF_W && Math.abs(z) < PITCH_HALF_L;

const SUB = 1 / 120;
/** Advances the ball by dt (internally sub-stepped). Returns true if a bounce occurred. */
export function stepBall(b: Ball, dt: number): boolean {
  let bounced = false;
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(SUB, left); left -= h;
    if (b.stopped) return bounced;
    const rolling = b.y <= BALL_R + 1e-4 && Math.abs(b.vy) < 1e-3;
    if (rolling) {
      b.y = BALL_R; b.vy = 0;
      const sp = Math.hypot(b.vx, b.vz);
      const dec = (onPitch(b.x, b.z) ? 1.0 : 1.7) * h;
      if (sp <= dec + 0.05) { b.vx = b.vz = 0; b.stopped = true; return bounced; }
      const f = (sp - dec) / sp; b.vx *= f; b.vz *= f;
    } else {
      const sp = Math.hypot(b.vx, b.vy, b.vz), k = 0.0011 * sp;
      b.vx -= k * b.vx * h; b.vy -= k * b.vy * h; b.vz -= k * b.vz * h;
      b.vy -= G * h;
    }
    b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    if (b.y <= BALL_R && b.vy < 0) {
      b.y = BALL_R; b.bounces++; b.bouncesSinceHit++; bounced = true;
      const pitch = onPitch(b.x, b.z);
      const e = pitch ? 0.68 : 0.48;
      if (-b.vy < 1.1) { b.vy = 0; } else b.vy = -b.vy * e;
      const hf = pitch ? b.pitchFriction : 0.82;
      b.vx *= hf; b.vz *= hf;
      if (pitch && b.turnPending !== 0) { b.vx += b.turnPending; b.turnPending = 0; }
    }
  }
  return bounced;
}

/** Linear crossing of the plane z = planeZ between two states (returns interpolated x,y or null). */
export function crossZ(px: number, py: number, pz: number, cx: number, cy: number, cz: number, planeZ: number) {
  if ((pz - planeZ) * (cz - planeZ) > 0 || pz === cz) return null;
  const t = (planeZ - pz) / (cz - pz);
  return { x: px + (cx - px) * t, y: py + (cy - py) * t, t };
}

export interface PathPoint { t: number; x: number; y: number; z: number; speed: number; air: boolean }
/** Predicts the future path of a ball (does not mutate the input). Stops when stopped, out of bounds or maxT. */
export function predictPath(ball: Ball, rx: number, rz: number, maxT = 9, dt = 0.05): PathPoint[] {
  const b = cloneBall(ball); const out: PathPoint[] = [];
  for (let t = dt; t <= maxT; t += dt) {
    stepBall(b, dt);
    const outside = (b.x / rx) ** 2 + (b.z / rz) ** 2 >= 1;
    out.push({ t, x: b.x, y: b.y, z: b.z, speed: speedOf(b), air: b.y > 0.2 });
    if (outside || b.stopped) break;
  }
  return out;
}

export const insideField = (x: number, z: number, rx: number, rz: number) => (x / rx) ** 2 + (z / rz) ** 2 < 1;

/** Launches a ball from (x0,y0,z0) to arrive at (tx,ty,tz) travelling at horizontal speed hs, ignoring drag (+small compensation). */
export function launchTo(b: Ball, x0: number, y0: number, z0: number, tx: number, ty: number, tz: number, hs: number) {
  const dx = tx - x0, dz = tz - z0, D = Math.max(0.5, Math.hypot(dx, dz));
  const t = D / (hs * 0.985);
  b.x = x0; b.y = y0; b.z = z0;
  b.vx = (dx / D) * hs; b.vz = (dz / D) * hs;
  b.vy = (ty - y0 + 0.5 * G * t * t) / t;
  b.stopped = false;
  return t;
}
