import * as THREE from 'three';
import type { PlayerEntity } from '../../game/entities';
import { SHOTS } from '../../game/battingAI';
import { SKINS } from '../../data/teams';

export interface Rig {
  root: THREE.Group; hips: THREE.Group; torso: THREE.Group; head: THREE.Group;
  lS: THREE.Group; lE: THREE.Group; rS: THREE.Group; rE: THREE.Group; lH: THREE.Group; lK: THREE.Group; rH: THREE.Group; rK: THREE.Group;
  bat: THREE.Mesh; helmet: THREE.Mesh; cap: THREE.Mesh; padL: THREE.Mesh; padR: THREE.Mesh; gloves: THREE.Mesh[]; phase: number; seed: number;
}
const box = (w: number, h: number, d: number, m: THREE.Material, y = 0) => { const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); x.position.y = y; x.castShadow = true; return x; };
const cyl = (r: number, h: number, m: THREE.Material, y: number) => { const x = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, h, 8), m); x.position.y = y; x.castShadow = true; return x; };
const mats = new Map<string, THREE.MeshStandardMaterial>();
const mat = (c: string) => { let m = mats.get(c); if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }); mats.set(c, m); } return m; };

/** Builds a low-poly cricketer from primitive geometry (no external assets). Forward = +z. */
export function buildRig(kit: { shirt: string; accent: string; trousers: string }, skinIdx: number, left: boolean, idx: number): Rig {
  const root = new THREE.Group(); const flip = new THREE.Group(); if (left) flip.scale.x = -1; root.add(flip);
  const hips = new THREE.Group(); hips.position.y = 0.92; flip.add(hips);
  const skin = mat(SKINS[skinIdx % SKINS.length]), shirt = mat(kit.shirt), acc = mat(kit.accent), trs = mat(kit.trousers), white = mat('#f4f4f0'), dark = mat('#14161d');
  hips.add(box(0.36, 0.2, 0.22, trs, 0.02));
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(box(0.42, 0.52, 0.24, shirt, 0.3)); torso.add(box(0.44, 0.07, 0.25, acc, 0.55)); torso.add(box(0.1, 0.5, 0.01, acc, 0.3));
  const head = new THREE.Group(); head.position.y = 0.7; torso.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), skin); hm.castShadow = true; head.add(hm);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), shirt); cap.position.y = 0.02; head.add(cap);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), mat('#1a2540')); helmet.position.y = 0.025; head.add(helmet);
  const arm = (side: number) => {
    const s = new THREE.Group(); s.position.set(side * 0.27, 0.5, 0); torso.add(s);
    s.add(cyl(0.05, 0.28, acc, -0.14));
    const e = new THREE.Group(); e.position.y = -0.28; s.add(e);
    e.add(cyl(0.042, 0.26, skin, -0.13));
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), white); g.position.y = -0.29; e.add(g);
    return { s, e, g };
  };
  const L = arm(-1), R = arm(1);
  const bat = box(0.1, 0.8, 0.04, mat('#d9b46a'), -0.62); bat.position.z = 0.05; R.e.add(bat);
  const leg = (side: number) => {
    const h = new THREE.Group(); h.position.set(side * 0.1, -0.05, 0); hips.add(h);
    h.add(cyl(0.075, 0.45, trs, -0.22));
    const k = new THREE.Group(); k.position.y = -0.45; h.add(k);
    k.add(cyl(0.062, 0.43, trs, -0.215));
    const pad = box(0.11, 0.36, 0.15, white, -0.22); pad.position.z = 0.02; k.add(pad);
    k.add(box(0.1, 0.07, 0.24, dark, -0.45)).position.z = 0.04;
    return { h, k, pad };
  };
  const lg = leg(-1), rg = leg(1);
  return { root, hips, torso, head, lS: L.s, lE: L.e, rS: R.s, rE: R.e, lH: lg.h, lK: lg.k, rH: rg.h, rK: rg.k, bat, helmet, cap, padL: lg.pad, padR: rg.pad, gloves: [L.g, R.g], phase: idx * 1.7, seed: idx };
}

const ease = (x: number) => x * x * (3 - 2 * x);
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
interface Pose { hipY: number; hipX: number; torsoX: number; torsoY: number; torsoZ: number; lSx: number; lSz: number; lEx: number; rSx: number; rSz: number; rEx: number; lHx: number; lKx: number; rHx: number; rKx: number; rootY: number; headX: number; bat: number }
const blank = (): Pose => ({ hipY: 0.92, hipX: 0, torsoX: 0, torsoY: 0, torsoZ: 0, lSx: 0, lSz: 0.05, lEx: -0.1, rSx: 0, rSz: -0.05, rEx: -0.1, lHx: 0, lKx: 0.05, rHx: 0, rKx: 0.05, rootY: 0, headX: 0, bat: 0 });

/** Procedural pose for the entity's current action. Rotation sign convention: +x = limb swings backward / torso leans forward. */
export function computePose(e: PlayerEntity, r: Rig, t: number, dt: number): Pose {
  const p = blank(); const a = e.action;
  r.phase += e.speed * dt * 1.9;
  const ph = r.phase, amp = cl(e.speed / 6.5, 0.15, 1.1);
  const gait = (mult = 1) => {
    p.lHx = -Math.sin(ph) * amp * 0.95 * mult; p.rHx = Math.sin(ph) * amp * 0.95 * mult;
    p.lKx = (0.5 + 0.5 * Math.sin(ph + 1.6)) * amp * 1.3 * mult; p.rKx = (0.5 - 0.5 * Math.sin(ph - 1.6)) * amp * 1.3 * mult;
    p.lSx = Math.sin(ph) * amp * 0.9; p.rSx = -Math.sin(ph) * amp * 0.9; p.lEx = -0.3 - amp * 0.9; p.rEx = -0.3 - amp * 0.9;
    p.torsoX = amp * 0.22; p.rootY = Math.abs(Math.sin(ph)) * amp * 0.05;
  };
  const ac = e.actT, dur = Math.max(0.01, e.actDur);
  switch (a) {
    case 'walk': gait(0.7); p.torsoX *= 0.3; break;
    case 'run': gait(1); break;
    case 'runup': gait(1.15); p.rEx = -1.6; break;
    case 'follow': gait(0.9); p.torsoX = 0.35; break;
    case 'idle': p.torsoZ = Math.sin(t * 1.4 + r.seed) * 0.02; p.rSx = 0.05 * Math.sin(t + r.seed); break;
    case 'sit': p.hipY = 0.5; p.lHx = p.rHx = -1.5; p.lKx = p.rKx = 1.5; p.torsoX = 0.1; p.lSx = p.rSx = -0.5; p.lEx = p.rEx = -0.7; break;
    case 'keeper': p.hipY = 0.58; p.torsoX = 0.55; p.lHx = p.rHx = -1.1; p.lKx = p.rKx = 1.9; p.lSx = p.rSx = -1.2; p.lEx = p.rEx = -0.5; break;
    case 'stance': p.hipY = 0.8; p.torsoX = 0.5; p.lHx = p.rHx = -0.45; p.lKx = p.rKx = 0.8; p.lSx = p.rSx = -0.95; p.lEx = p.rEx = -0.6; p.bat = 1; break;
    case 'swing': {
      const m = SHOTS[e.shot] ?? SHOTS.drive, L = m.lead, back = ease(cl(ac / (L * 0.6), 0, 1)), fwd = ease(cl((ac - L * 0.6) / (L * 0.4 + 0.12), 0, 1)), fin = ease(cl((ac - L - 0.15) / 0.2, 0, 1));
      const up = e.shot === 'defend' ? -1.5 : -2.35, end = e.shot === 'defend' ? -1.2 : e.shot === 'loft' ? -2.6 : e.shot === 'pull' ? -1.5 : -0.55;
      const s = (-0.95 + (up + 0.95) * back) + (end - up) * fwd + (e.shot === 'loft' ? -0.2 * fin : 0);
      p.lSx = p.rSx = s; p.lEx = p.rEx = -0.5 + 0.4 * fwd; p.hipY = e.shot === 'sweep' ? 0.55 : 0.78; p.torsoX = e.shot === 'sweep' ? 0.9 : 0.5 - 0.2 * fwd;
      p.torsoY = (e.shot === 'pull' ? -1 : e.shot === 'cut' ? 0.8 : e.shot === 'glance' ? -0.5 : 0.35) * fwd; p.lHx = p.rHx = -0.45; p.lKx = p.rKx = e.shot === 'sweep' ? 1.6 : 0.8; p.bat = 1; break;
    }
    case 'bowl': {
      const q = ac / dur, w = cl(q / 0.5, 0, 1);
      p.rSx = 0.3 - w * Math.PI * 2; p.rEx = -0.1; p.lSx = q < 0.35 ? -2.5 : -2.5 + ease(cl((q - 0.35) / 0.3, 0, 1)) * 2.8; p.torsoX = 0.6 * Math.sin(cl(q / 0.55, 0, 1) * Math.PI);
      p.lHx = -0.9 + q * 0.6; p.lKx = 0.4; p.rHx = 0.3; p.rKx = 0.2 + q * 0.5; p.rootY = 0.05; break;
    }
    case 'dive': { const k = ease(cl(ac / 0.25, 0, 1)); p.hipX = 1.35 * k; p.hipY = 0.92 - 0.38 * k; p.lSx = p.rSx = -2.9 * k; p.lEx = p.rEx = -0.1; p.lHx = p.rHx = 0.4 * k; p.lKx = p.rKx = 0.5 * k; break; }
    case 'catch': p.lSx = p.rSx = -2.7; p.lEx = p.rEx = -0.3; p.rootY = 0.12 * Math.sin(cl(ac / 0.5, 0, 1) * Math.PI); p.torsoX = -0.1; p.lHx = p.rHx = -0.2; break;
    case 'throw': { const q = cl(ac / 0.5, 0, 1), c = ease(cl(q / 0.45, 0, 1)), f = ease(cl((q - 0.45) / 0.3, 0, 1)); p.rSx = -2.6 * c + 3.4 * f; p.rEx = -1.2 * (1 - f); p.torsoY = -0.7 * c + 1.3 * f; p.torsoX = 0.3 * f; p.lSx = -1.2; p.lHx = -0.5 * f; p.rHx = 0.4; break; }
    case 'pickup': p.hipY = 0.62; p.torsoX = 1.0; p.lHx = p.rHx = -0.9; p.lKx = p.rKx = 1.4; p.lSx = p.rSx = -0.7; p.lEx = p.rEx = -0.3; break;
    case 'celebrate': p.lSx = p.rSx = -2.9; p.lSz = 0.5 + 0.4 * Math.sin(t * 11); p.rSz = -0.5 - 0.4 * Math.sin(t * 11); p.rootY = Math.abs(Math.sin(t * 7 + r.seed)) * 0.2; p.lEx = p.rEx = -0.2; p.torsoX = -0.1; break;
  }
  if (a === 'run' && e.hasFace === false) p.bat = 0;
  return p;
}

const k = (dt: number) => 1 - Math.exp(-dt * 20);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function applyPose(r: Rig, p: Pose, dt: number) {
  const f = k(dt);
  const set = (o: THREE.Object3D, ax: 'x' | 'y' | 'z', v: number) => { o.rotation[ax] = lerp(o.rotation[ax], v, f); };
  r.hips.position.y = lerp(r.hips.position.y, p.hipY + p.rootY, f); set(r.hips, 'x', p.hipX);
  set(r.torso, 'x', p.torsoX); set(r.torso, 'y', p.torsoY); set(r.torso, 'z', p.torsoZ); set(r.head, 'x', p.headX - p.torsoX * 0.6);
  set(r.lS, 'x', p.lSx); set(r.lS, 'z', p.lSz); set(r.lE, 'x', p.lEx); set(r.rS, 'x', p.rSx); set(r.rS, 'z', p.rSz); set(r.rE, 'x', p.rEx);
  set(r.lH, 'x', p.lHx); set(r.lK, 'x', p.lKx); set(r.rH, 'x', p.rHx); set(r.rK, 'x', p.rKx);
}
