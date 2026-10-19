import type { Shot, TeamSide } from '../types/cricket';

export type Action = 'idle' | 'walk' | 'run' | 'runup' | 'bowl' | 'stance' | 'swing' | 'keeper' | 'dive' | 'catch' | 'throw' | 'pickup' | 'celebrate' | 'sit' | 'follow';

/** Mutable in-world state for one of the 22 players. Rendering reads this every frame. */
export interface PlayerEntity {
  id: string; side: TeamSide; hand: 'R' | 'L';
  x: number; z: number; heading: number; speed: number;
  action: Action; actT: number; actDur: number; shot: Shot;
  tx: number; tz: number; tSpeed: number; arrived: boolean;
  faceX: number; faceZ: number; hasFace: boolean;   // desired facing once arrived
  seated: boolean; hold: boolean;                   // hold: movement driven manually by the simulation
  posture: Action;                                  // pose adopted when stationary (idle | stance | keeper | sit)
}
export const newEntity = (id: string, side: TeamSide, hand: 'R' | 'L'): PlayerEntity => ({
  id, side, hand, x: 0, z: 0, heading: 0, speed: 0, action: 'idle', actT: 0, actDur: 0, shot: 'defend',
  tx: 0, tz: 0, tSpeed: 5, arrived: true, faceX: 0, faceZ: 1, hasFace: false, seated: false, hold: false, posture: 'idle',
});
const LOCOMOTION: Action[] = ['idle', 'walk', 'run', 'stance', 'keeper', 'sit'];

export function setAction(e: PlayerEntity, a: Action, dur = 0, shot?: Shot) {
  e.action = a; e.actT = 0; e.actDur = dur; if (shot) e.shot = shot;
}
export function faceToward(e: PlayerEntity, x: number, z: number) { e.faceX = x - e.x; e.faceZ = z - e.z; e.hasFace = true; }
export function setTarget(e: PlayerEntity, x: number, z: number, speed: number) {
  e.tx = x; e.tz = z; e.tSpeed = speed; e.arrived = false;
}
const turnTo = (cur: number, want: number, maxStep: number) => {
  let d = want - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  return cur + Math.max(-maxStep, Math.min(maxStep, d));
};

/** Moves an entity toward its target with acceleration; picks locomotion/posture action; returns remaining distance. */
export function moveEntity(e: PlayerEntity, dt: number, accel = 16): number {
  e.actT += dt;
  const busy = !LOCOMOTION.includes(e.action);
  if (busy && e.actDur > 0 && e.actT >= e.actDur) setAction(e, e.posture);
  const dx = e.tx - e.x, dz = e.tz - e.z, d = Math.hypot(dx, dz);
  if (d < 0.08) {
    e.speed = Math.max(0, e.speed - accel * dt * 1.5); e.arrived = true;
    if (e.hasFace) e.heading = turnTo(e.heading, Math.atan2(e.faceX, e.faceZ), 8 * dt);
    if (!busy && e.speed < 0.3) { e.speed = 0; if (e.action !== e.posture) setAction(e, e.posture); }
    return d;
  }
  e.arrived = false;
  const want = Math.min(e.tSpeed, Math.max(1.2, d * 3));
  e.speed += Math.max(-accel * dt, Math.min(accel * dt, want - e.speed));
  const step = Math.min(d, e.speed * dt);
  e.x += (dx / d) * step; e.z += (dz / d) * step;
  e.heading = turnTo(e.heading, Math.atan2(dx, dz), 9 * dt);
  if (!busy) {
    const a: Action = e.speed > 4.2 ? 'run' : e.speed > 0.5 ? 'walk' : e.posture;
    if (e.action !== a) setAction(e, a);
  }
  return d;
}
