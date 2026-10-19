// Headless, deterministic simulation of ONE delivery: run-up -> release -> flight/bounce -> bat contact -> fielding -> running -> result.
// The 3D scene only renders this state. Outcomes come from the physics + fielding, never from a hardcoded result.
import type { ContactType, DeliveryResult, DeliverySpec, Difficulty, Player, Shot } from '../types/cricket';
import { RNG, clamp } from '../utils/rng';
import { BALL_R, BAT_PLANE_Z, Ball, STUMP_H, STUMP_HALF, STUMP_Z, cloneBall, crossZ, insideField, launchTo, newBall, speedOf, stepBall } from './ballPhysics';
import { PlayerEntity, moveEntity, setAction, setTarget } from './entities';
import { FielderRef, Plan, fielderSpeed, keeperZ, planFielding } from './fieldingAI';
import { SHOTS } from './battingAI';

export interface SimEvent { type: 'release' | 'bounce' | 'contact' | 'edge' | 'catch' | 'drop' | 'stump' | 'throw' | 'boundary4' | 'boundary6' | 'wicket' | 'stop'; x?: number; z?: number; q?: number }
export interface SimSetup {
  id: number; rng: RNG; rx: number; rz: number; difficulty: Difficulty; spec: DeliverySpec;
  bowler: FielderRef & { e: PlayerEntity }; keeper: FielderRef & { e: PlayerEntity };
  fielders: (FielderRef & { e: PlayerEntity })[];
  striker: { e: PlayerEntity; p: Player }; nonStriker: { e: PlayerEntity; p: Player };
  freeHit: boolean; userBat: boolean; userBowl: boolean;
  aiShot?: (arr: { lineOff: number; height: number; t: number; bounced: boolean; length: number }, spec: DeliverySpec) => { shot: Shot; dir: number; power: number };
  runRisk: number;
}
export const RUN_END_Z = 9.3;
export const RUNUP: Record<string, { len: number; speed: number; y: number }> = {
  fast: { len: 14, speed: 6.6, y: 2.15 }, medium: { len: 10, speed: 5.6, y: 2.05 }, offspin: { len: 5, speed: 3.6, y: 1.95 }, legspin: { len: 5, speed: 3.6, y: 1.95 },
};
const offSign = (hand: 'R' | 'L') => (hand === 'R' ? -1 : 1);
export const endPos = (end: -1 | 1, hand: 'R' | 'L') => (end === -1 ? { x: -offSign(hand) * 0.45, z: -RUN_END_Z } : { x: offSign(hand) * 1.6, z: RUN_END_Z });

interface Runner { e: PlayerEntity; p: Player; end: -1 | 1; moving: boolean; sx: number; sz: number; ex: number; ez: number; prog: number; target: -1 | 1; turnWait: number; }

export class DeliverySim {
  t = 0;
  phase: 'runup' | 'flight' | 'play' | 'done' = 'runup';
  ball: Ball = newBall();
  ballVisible = false;
  mode: 'bowl' | 'free' | 'held' | 'thrown' = 'bowl';
  holder: (FielderRef & { e: PlayerEntity }) | null = null;
  events: SimEvent[] = [];
  result: DeliveryResult | null = null;
  spec: DeliverySpec;                       // actual (after release scatter)
  runners: Runner[];
  completedRuns = 0;
  runQueue = 0;
  // delivery facts
  noBall = false; releaseT = 0; releaseErr = 0.4; pressT: number | null = null;
  private triggered = false; private released = false;
  private shotPlan: { shot: Shot; dir: number; power: number; contactT: number } | null = null; private swingStarted = false;
  private resolved = false; contact: ContactType = 'none'; batContact = false; bodyHit = false; dirDeg = 0; timing = 0; shotUsed: Shot = 'leave';
  private catchable = false; private tried = new Set<string>(); private cool = new Map<string, number>();
  private plan: Plan | null = null; private planAt = -9; runsEnabled = false; private runCheckAt = 0;
  private heldT = 0; private deadT = 0; private throwEnd: -1 | 1 = -1; private thrower: string | undefined;
  private runInProgress = false; private wicket: DeliveryResult['wicket'] = null; private boundary: 4 | 6 | null = null;
  private extra: 'wide' | 'noball' | null = null; private fielderFirst: string | undefined; private dropped: string | undefined; private airborneFirst = false; private keeperTook = false;
  private runStartT = 0; private diveCool = 0;
  private skill: { bat: number; bowl: number };
  private diffBat: number;

  constructor(public s: SimSetup) {
    this.spec = { ...s.spec };
    const hand = s.striker.p.hand;
    const bw = s.difficulty === 'hard' ? 1.08 : s.difficulty === 'easy' ? 0.9 : 1;
    this.skill = { bat: clamp((s.striker.p.batting / 100) * (s.userBat ? 1 : bw), 0.1, 1), bowl: clamp((s.bowler.p.bowling / 100) * (s.userBowl ? 1 : (2 - bw)), 0.1, 1) };
    this.diffBat = s.userBat ? (s.difficulty === 'easy' ? 0.1 : s.difficulty === 'hard' ? -0.06 : 0) : 0;
    const mk = (x: { e: PlayerEntity; p: Player }, end: -1 | 1): Runner => ({ e: x.e, p: x.p, end, moving: false, sx: 0, sz: 0, ex: 0, ez: 0, prog: 0, target: end, turnWait: 0 });
    this.runners = [mk(s.striker, -1), mk(s.nonStriker, 1)];
    for (const r of this.runners) { const ep = endPos(r.end, hand); r.e.hold = true; r.e.x = ep.x; r.e.z = ep.z; r.e.tx = ep.x; r.e.tz = ep.z; }
    const st = s.striker.e;
    st.posture = 'stance'; setAction(st, 'stance'); st.faceX = offSign(hand); st.faceZ = 0; st.hasFace = true; st.heading = Math.atan2(st.faceX, st.faceZ);
    const ns = s.nonStriker.e; ns.posture = 'idle'; setAction(ns, 'idle'); ns.faceX = 0; ns.faceZ = -1; ns.hasFace = true;
    const b = s.bowler.e; b.hold = true; const ru = RUNUP[this.spec.style] ?? RUNUP.medium;
    b.x = 0.9; b.z = STUMP_Z + ru.len; b.heading = Math.PI; b.speed = 0; setAction(b, 'idle');
    s.keeper.e.posture = 'keeper'; setAction(s.keeper.e, 'keeper');
  }

  get done() { return this.phase === 'done'; }
  private ev(e: SimEvent) { this.events.push(e); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---------- inputs ----------
  startRunup() { this.triggered = true; }
  pressRelease() { if (this.pressT == null) this.pressT = this.t; }
  /** Interactive batting: schedule a shot; contact happens after the shot's swing lead time. */
  playShot(shot: Shot, dir: number, power = 0.85) {
    if (this.resolved || this.phase === 'done' || this.shotPlan) return false;
    const m = SHOTS[shot];
    this.shotPlan = { shot, dir, power, contactT: this.t + m.lead };
    this.startSwing(); return true;
  }
  queueRun() { if (this.runsEnabled || this.phase === 'play') this.runQueue = Math.min(3, this.runQueue + 1); }
  cancelRun() {
    this.runQueue = 0;
    if (this.runInProgress) for (const r of this.runners) if (r.moving && r.prog < 0.4) { r.target = (r.target * -1) as -1 | 1; [r.sx, r.ex] = [r.ex, r.sx]; [r.sz, r.ez] = [r.ez, r.sz]; r.prog = 1 - r.prog; }
  }
  get userBatting() { return this.s.userBat; }
  get canPlay() { return !this.resolved && !this.shotPlan && this.phase !== 'done'; }

  private startSwing() {
    if (!this.shotPlan || this.swingStarted) return;
    this.swingStarted = true;
    const m = SHOTS[this.shotPlan.shot];
    setAction(this.s.striker.e, 'swing', m.lead + 0.35, this.shotPlan.shot);
  }

  // ---------- main step ----------
  step(dt: number) {
    if (this.phase === 'done') return;
    this.t += dt;
    if (this.phase === 'runup') this.stepRunup(dt);
    else this.stepBallPhase(dt);
    this.stepFielders(dt);
    this.stepRunners(dt);
    if ((this.phase as string) !== 'done' && this.t > 55) this.finish();
  }

  private stepRunup(dt: number) {
    const b = this.s.bowler.e, ru = RUNUP[this.spec.style] ?? RUNUP.medium;
    if (!this.triggered) return;
    if (b.action !== 'runup' && b.action !== 'bowl') setAction(b, 'runup');
    if (!this.released) {
      if (b.action === 'runup' && b.z <= 9.0 + ru.speed * 0.24) { setAction(b, 'bowl', 0.9); this.releaseT = this.t + 0.24; }
      b.speed = ru.speed; b.z -= ru.speed * dt; b.x += (0.9 - b.x) * 0.1; b.heading = Math.PI;
      if (b.action === 'bowl' && this.t >= this.releaseT) this.release();
    }
  }

  private release() {
    this.released = true; const s = this.s, b = s.bowler.e, rng = s.rng, spec = this.spec, ru = RUNUP[spec.style] ?? RUNUP.medium;
    this.releaseErr = this.pressT != null ? Math.abs(this.pressT - this.releaseT) : 0.35;
    const sk = this.skill.bowl;
    const accuracy = s.userBowl ? 1 + this.releaseErr * 5 : 1;
    const sdLine = (0.05 + (1 - sk) * 0.28) * accuracy, sdLen = (0.15 + (1 - sk) * 0.6) * accuracy;
    spec.lineOff += rng.normal(0, sdLine); spec.length = clamp(spec.length + rng.normal(0, sdLen), -0.8, 9.4);
    this.noBall = !s.freeHit && rng.chance(s.userBowl ? 0.012 + this.releaseErr * 0.02 : 0.012);
    const hand = s.striker.p.hand;
    const landX = offSign(hand) * spec.lineOff; // world x of the off side is offSign
    const ball = this.ball; const ry = ru.y, rz0 = 9.0, rx0 = b.x + 0.1;
    ball.bounces = 0; ball.bouncesSinceHit = 0; ball.pitchFriction = spec.style === 'fast' ? 0.84 : spec.style === 'medium' ? 0.78 : 0.68;
    ball.turnPending = offSign(hand) * spec.turn;
    if (spec.length < 0.6) { // full toss: arrives at bat plane at a chosen height
      const h = clamp(0.35 + (0.6 - spec.length) * 0.8, 0.25, 1.5);
      launchTo(ball, rx0, ry, rz0, landX, h, BAT_PLANE_Z, spec.pace);
    } else launchTo(ball, rx0, ry, rz0, landX, BALL_R, -STUMP_Z + spec.length, spec.pace);
    { // keeper moves to the predicted line of the ball at his depth
      const pb = cloneBall(ball), kz = s.keeper.e.z; let n = 0;
      while (pb.z > kz && n++ < 400) stepBall(pb, 0.01);
      setTarget(s.keeper.e, clamp(pb.x, -3, 3), kz, 8);
    }
    this.ballVisible = true; this.mode = 'bowl'; this.phase = 'flight';
    this.ev({ type: 'release', x: rx0, z: rz0 });
    b.hold = false; setAction(b, 'follow', 1.4); b.tx = b.x + 1.6; b.tz = 5.5; b.tSpeed = 3.5; b.arrived = false; b.posture = 'idle';
    // AI batter reads the ball and schedules a shot (timing error shrinks with skill)
    if (!s.userBat && s.aiShot) {
      const arr = this.predictArrival();
      if (arr) {
        const plan = s.aiShot(arr, spec);
        if (plan.shot !== 'leave') {
          const m = SHOTS[plan.shot];
          const sd = (0.115 - 0.075 * this.skill.bat) * (1 + (spec.pace - 26) / 45) + (plan.shot === 'defend' ? -0.01 : 0.01);
          this.shotPlan = { ...plan, contactT: this.t + arr.t + rng.normal(0, Math.max(0.02, sd)) };
          void m;
        }
      }
    }
  }

  private predictArrival() {
    const b = cloneBall(this.ball); const hand = this.s.striker.p.hand; let bounced = false; let t = 0;
    while (b.z > BAT_PLANE_Z && t < 2) { if (stepBall(b, 0.01)) bounced = true; t += 0.01; }
    return { lineOff: offSign(hand) * b.x, height: b.y, t, bounced, length: this.spec.length };
  }

  private stepBallPhase(dt: number) {
    const b = this.ball;
    // AI / user swing animation start
    if (this.shotPlan && !this.swingStarted && this.t >= this.shotPlan.contactT - SHOTS[this.shotPlan.shot].lead) this.startSwing();
    if (this.mode === 'held' && this.holder) { b.x = this.holder.e.x; b.z = this.holder.e.z; b.y = 1.05; b.vx = b.vy = b.vz = 0; return; }
    const px = b.x, py = b.y, pz = b.z;
    if (stepBall(b, dt)) this.ev({ type: 'bounce', x: b.x, z: b.z });
    if (b.bouncesSinceHit > 0 && this.mode !== 'bowl') this.catchable = false;
    if (this.mode === 'bowl' || this.mode === 'free') {
      // bat plane resolution (first crossing of a bowled ball)
      if (!this.resolved && this.mode === 'bowl') {
        const c = crossZ(px, py, pz, b.x, b.y, b.z, BAT_PLANE_Z);
        if (c) { b.x = c.x; b.y = Math.max(c.y, BALL_R); this.resolveBatBall(); }
      }
      // striker's stumps (bowled)
      if (this.phase !== 'done' && b.vz < 0) {
        const c = crossZ(px, py, pz, b.x, b.y, b.z, -STUMP_Z);
        if (c && Math.abs(c.x) < STUMP_HALF + BALL_R && c.y < STUMP_H + BALL_R) {
          if (!this.noBall && !this.s.freeHit && this.extra === null) {
            this.wicket = { kind: 'bowled', batterId: this.s.striker.p.id }; this.ev({ type: 'stump', x: c.x, z: -STUMP_Z }); this.ev({ type: 'wicket' }); this.finish(); return;
          }
        }
      }
    }
    if (this.mode === 'thrown') this.checkThrowArrival(px, py, pz);
    if (this.phase === 'done') return;
    // boundary
    if ((this.mode === 'free' || this.mode === 'thrown') && this.phase === 'play' && !insideField(b.x, b.z, this.s.rx, this.s.rz)) {
      const six = this.mode === 'free' && this.batContact && b.bouncesSinceHit === 0 && this.catchable !== false;
      this.boundary = six ? 6 : 4; if (this.mode === 'thrown') this.batContact = false;
      this.ev({ type: six ? 'boundary6' : 'boundary4', x: b.x, z: b.z }); this.finish(); return;
    }
    // stopped ball far from everyone is still reached by the chasing fielder (see stepFielders)
  }

  // ---------- bat/ball ----------
  private resolveBatBall() {
    this.resolved = true; const s = this.s, b = this.ball, rng = s.rng, hand = s.striker.p.hand;
    const lineOff = offSign(hand) * b.x, height = b.y, speed = speedOf(b);
    const bounced = b.bounces > 0;
    // no-ball: full toss above waist
    if (!bounced && height > 1.2) this.noBall = true;
    if (this.noBall) this.extra = 'noball';
    let contact: ContactType = 'none'; const sp = this.shotPlan;
    this.shotUsed = sp?.shot ?? 'leave';
    if (sp && sp.shot !== 'leave') {
      const m = SHOTS[sp.shot];
      const err = sp.contactT - this.t; this.timing = err;
      const tf = Math.max(0, 1 - Math.pow(Math.abs(err) / 0.17, 1.5));
      const fit = (v: number, [lo, hi]: [number, number], tol: number) => 1 - clamp((v < lo ? lo - v : v > hi ? v - hi : 0) / tol, 0, 1);
      let q = tf * fit(lineOff, m.line, 0.7) * fit(height, m.h, 0.55);
      if (sp.shot === 'sweep' && (s.spec.style === 'fast' || s.spec.style === 'medium')) q *= 0.75;
      if (q > 0.03) {
        q += 0.06 + (this.skill.bat - 0.6) * 0.35 - (this.skill.bowl - 0.6) * 0.25 + this.diffBat + rng.normal(0, 0.09);
        q = clamp(q, 0, 1);
        const miss = sp.shot === 'defend' ? 0.07 : 0.15, edge = sp.shot === 'defend' ? 0.2 : 0.32;
        if (q < miss) contact = 'miss'; else if (q < edge) contact = 'edge'; else contact = 'clean';
        this.hitBall(sp.shot, sp.dir, sp.power, q, contact, speed);
      } else contact = 'miss';
      if (contact === 'miss') this.shotUsed = sp.shot;
    }
    this.contact = contact;
    // wide: ball beyond reach and no contact
    if (!this.batContact && !this.noBall && (lineOff > 1.05 || lineOff < -0.95 || height > 1.95)) this.extra = 'wide';
    // pad: low ball near body, no bat contact
    if (!this.batContact && this.extra === null && height < 0.55 && Math.abs(b.x - (-offSign(hand) * 0.45)) < 0.32 && rng.chance(0.45)) {
      this.bodyHit = true; this.contact = 'pad'; const sd = -offSign(hand);
      const ang = rng.range(0.4, 2.4), sp2 = rng.range(3, 7);
      b.vx = sd * Math.sin(ang) * sp2 * 0.7 + offSign(hand) * 0.5; b.vz = rng.range(-1, 1) * sp2; b.vy = rng.range(0.5, 1.5); this.mode = 'free';
    }
    if (this.batContact) { this.runsEnabled = true; this.afterContact(); }
    else { this.phase = 'play'; this.runCheckAt = this.t + (this.bodyHit ? 0.4 : 0.9); this.mode = this.mode === 'bowl' ? 'free' : this.mode; if (this.bodyHit) this.runsEnabled = true; this.replan(); }
  }

  private hitBall(shot: Shot, dirIn: number, power: number, q: number, contact: ContactType, pace: number) {
    const b = this.ball, rng = this.s.rng, hand = this.s.striker.p.hand, m = SHOTS[shot];
    let dir: number, speed: number, launch: number;
    if (contact === 'edge') {
      dir = (rng.chance(0.65) ? 1 : -1) * rng.range(110, 172); speed = rng.range(5, 17); launch = rng.range(4, 36);
    } else {
      dir = dirIn + rng.normal(0, 1) * (1 - q) * 22;
      speed = m.base * (0.3 + 0.8 * q) * power + (shot === 'defend' ? 0 : pace * 0.06);
      launch = m.launch + (1 - q) * (m.attacking ? 13 : 9) + rng.range(-1.5, 3);
      if (shot === 'defend') speed = clamp(speed, 1.2, 6);
    }
    this.dirDeg = dir; const r = (dir * Math.PI) / 180, l = (launch * Math.PI) / 180, vh = speed * Math.cos(l);
    b.vx = offSign(hand) * Math.sin(r) * vh; b.vz = Math.cos(r) * vh; b.vy = speed * Math.sin(l);
    b.y = Math.max(b.y, 0.15); b.z = BAT_PLANE_Z; b.bouncesSinceHit = 0; b.turnPending = 0; b.stopped = false;
    this.mode = 'free'; this.batContact = true; this.catchable = true; this.contact = contact;
    this.ev({ type: contact === 'edge' ? 'edge' : 'contact', x: b.x, z: b.z, q });
  }

  private afterContact() { this.phase = 'play'; this.replan(true); this.evaluateRun(); }

  // ---------- fielding ----------
  private replan(force = false) {
    if (!force && this.t - this.planAt < 0.3) return;
    this.planAt = this.t;
    if (this.mode === 'held' || this.mode === 'thrown') return;
    this.plan = planFielding(this.ball, this.s.fielders as FielderRef[], this.s.rx, this.s.rz);
    const p = this.plan, fs = this.s.fielders;
    const targeted = new Set<string>();
    const go = (f: FielderRef & { e: PlayerEntity }, x: number, z: number) => {
      targeted.add(f.e.id);
      if (f.e.action === 'dive' || f.e.action === 'catch' || f.e.action === 'throw' || f.e.action === 'pickup') { f.e.tx = x; f.e.tz = z; f.e.arrived = false; f.e.tSpeed = fielderSpeed(f.p); return; }
      setTarget(f.e, x, z, fielderSpeed(f.p));
    };
    if (p.chaser) {
      const c = p.chaser; const tgt = c.feasible ? c : { x: p.end.x, z: p.end.z };
      go(c.f as never, tgt.x, tgt.z);
    }
    for (const c of p.catchers) go(c.f as never, c.x, c.z);
    // back-up: next fastest fielder moves behind the chaser along the ball's line
    if (p.chaser) {
      const rest = fs.filter((f) => !targeted.has(f.e.id) && !f.isKeeper && !f.isBowler).sort((a, b) => Math.hypot(a.e.x - p.chaser!.x, a.e.z - p.chaser!.z) - Math.hypot(b.e.x - p.chaser!.x, b.e.z - p.chaser!.z));
      const bk = rest[0];
      if (bk && Math.hypot(bk.e.x - p.chaser.x, bk.e.z - p.chaser.z) > 4) {
        const dx = p.end.x - this.ball.x, dz = p.end.z - this.ball.z, d = Math.hypot(dx, dz) || 1;
        const tx = clamp(p.chaser.x + (dx / d) * 7, -this.s.rx * 0.9, this.s.rx * 0.9), tz = clamp(p.chaser.z + (dz / d) * 7, -this.s.rz * 0.9, this.s.rz * 0.9);
        go(bk, tx, tz);
      }
    }
    // keeper & bowler cover the stumps ends to receive throws (unless chasing)
    const k = this.s.keeper, bw = this.s.bowler;
    const keeperStillBehindBall = !this.batContact && this.ball.z > k.e.z + 0.5;
    if (!targeted.has(k.e.id) && !keeperStillBehindBall) { const kx = this.s.striker.p.hand === 'R' ? 0.1 : -0.1; setTarget(k.e, kx, -STUMP_Z - 1.1, 6.5); }
    if (!targeted.has(bw.e.id)) setTarget(bw.e, -1.4, STUMP_Z + 1.3, 6);
  }

  private stepFielders(dt: number) {
    const b = this.ball;
    if (this.phase === 'play' && (this.mode === 'free') && !this.runsEnabled && this.t >= this.runCheckAt) { this.runsEnabled = true; this.evaluateRun(); }
    if (this.phase === 'play' && this.mode === 'free') this.replan();
    for (const f of this.s.fielders) { if (f.e.hold) continue; moveEntity(f.e, dt); }
    moveEntity(this.s.bowler.e, dt);
    if (this.phase !== 'play') return;
    if (this.mode === 'free') this.checkInterceptions();
    if (this.mode === 'held') this.stepHeld(dt);
    void b;
  }

  private checkInterceptions() {
    const b = this.ball, rng = this.s.rng;
    for (const f of this.s.fielders) {
      if ((this.cool.get(f.e.id) ?? 0) > this.t) continue;
      const d = Math.hypot(b.x - f.e.x, b.z - f.e.z), air = b.y > 0.3;
      const sk = f.p.fielding / 100;
      if (air && this.catchable && d < 1.0 && b.y < 2.55 && !this.tried.has(f.e.id)) {
        this.tried.add(f.e.id);
        const sp = speedOf(b);
        let p = 0.52 + 0.45 * sk - Math.max(0, sp - 18) * 0.006 - (b.y > 2.0 || b.y < 0.5 ? 0.14 : 0) - (f.isKeeper ? -0.05 : 0);
        if (this.s.userBat) p += this.s.difficulty === 'easy' ? -0.05 : this.s.difficulty === 'hard' ? 0.04 : 0;
        p = clamp(p - 0.08, 0.2, 0.94);
        setAction(f.e, 'catch', 0.7);
        if (rng.chance(p) && !this.noBall && !this.s.freeHit) {
          this.ev({ type: 'catch', x: b.x, z: b.z });
          this.wicket = { kind: 'caught', batterId: this.s.striker.p.id, fielderId: f.p.id }; this.fielderFirst = f.p.id; this.ev({ type: 'wicket' });
          this.hold(f); this.finish(); return;
        }
        this.dropped = f.p.id; this.ev({ type: 'drop', x: b.x, z: b.z }); b.vx *= 0.35; b.vz *= 0.35; b.vy = -Math.abs(b.vy) * 0.2 - 0.5;
        this.cool.set(f.e.id, this.t + 0.8); this.catchable = false; continue;
      }
      if (air && !this.batContact && f.isKeeper && d < 1.6 && b.y < 2.3 && !this.tried.has(f.e.id)) { // keeper takes a delivery that missed the bat
        this.tried.add(f.e.id);
        if (rng.chance(clamp(0.72 + 0.3 * sk - d * 0.08, 0.6, 0.99))) { this.keeperTook = true; setAction(f.e, 'catch', 0.5); this.hold(f); return; }
        this.cool.set(f.e.id, this.t + 0.7); continue;
      }
      const reach = f.e.action === 'dive' ? 1.9 : f.isKeeper ? 1.5 : 0.85;
      if (!air && d < reach) {
        const fast = speedOf(b) > 14 && f.e.action !== 'dive';
        if (fast && !rng.chance(clamp(0.6 + 0.38 * sk, 0.6, 0.97))) { b.vx *= 0.55; b.vz *= 0.55; this.cool.set(f.e.id, this.t + 0.7); continue; }
        if (f.e.action === 'dive' && !rng.chance(clamp(0.5 + 0.45 * sk, 0.5, 0.95))) { this.cool.set(f.e.id, this.t + 0.9); continue; }
        this.airborneFirst = false; this.hold(f); return;
      }
      // dive trigger for fast ground balls about to be missed
      if (!air && d < 2.4 && d > 1.0 && speedOf(b) > 9 && this.t > this.diveCool && (this.plan?.chaser?.f.e.id === f.e.id) && f.e.action !== 'dive') {
        setAction(f.e, 'dive', 0.85); this.diveCool = this.t + 1.5;
      }
    }
  }

  private hold(f: FielderRef & { e: PlayerEntity }) {
    this.mode = 'held'; this.holder = f; this.heldT = 0; this.ball.stopped = true; this.catchable = false;
    if (!this.fielderFirst) this.fielderFirst = f.p.id;
    if (f.e.action !== 'catch') setAction(f.e, 'pickup', 0.45);
    f.e.tx = f.e.x; f.e.tz = f.e.z; f.e.speed = 0;
    this.ev({ type: 'stop', x: f.e.x, z: f.e.z });
    // everyone else holds position
    this.plan = null;
  }

  private stepHeld(dt: number) {
    const f = this.holder!; this.heldT += dt;
    if (this.heldT < 0.32) return;
    this.evaluateRun();
    const moving = this.runners.filter((r) => r.moving);
    if (moving.length === 0) {
      if (this.s.userBat && this.runQueue === 0 && this.heldT < 1.0) return;
      this.deadT += dt; if (this.deadT > 0.15) this.finish(); return;
    }
    // throw to the end where the ball is most likely to beat the runner
    let bestEnd: -1 | 1 = -1, bestMargin = -99;
    for (const r of moving) {
      const rem = Math.hypot(r.ex - r.e.x, r.ez - r.e.z) / Math.max(5, r.p.speed);
      const dist = Math.hypot(f.e.x - 0, f.e.z - r.target * STUMP_Z);
      const margin = rem - (dist / (22 + 10 * (f.p.fielding / 100)) + 0.25);
      if (margin > bestMargin) { bestMargin = margin; bestEnd = r.target; }
    }
    this.throwBall(f, bestEnd);
  }

  private throwBall(f: FielderRef & { e: PlayerEntity }, end: -1 | 1) {
    const rng = this.s.rng, sk = f.p.fielding / 100, b = this.ball;
    const dist = Math.hypot(f.e.x, f.e.z - end * STUMP_Z);
    const err = rng.normal(0, (0.12 + (1 - sk) * 0.75) * Math.max(0.3, dist / 30));
    const hs = 22 + 12 * sk;
    f.e.heading = Math.atan2(0 - f.e.x, end * STUMP_Z - f.e.z); setAction(f.e, 'throw', 0.5);
    launchTo(b, f.e.x, 1.5, f.e.z, err, 0.45 + rng.normal(0, 0.12), end * STUMP_Z, hs);
    b.stopped = false; b.bouncesSinceHit = 0; this.mode = 'thrown'; this.catchable = false; this.holder = null; this.throwEnd = end; this.thrower = f.p.id;
    const rec = end === -1 ? this.s.keeper : this.s.bowler;
    setTarget(rec.e, clamp(err, -1.8, 1.8), end * (STUMP_Z + 1.0), 7.5);
    this.ev({ type: 'throw' });
  }

  private checkThrowArrival(px: number, py: number, pz: number) {
    const b = this.ball, end = this.throwEnd;
    const c = crossZ(px, py, pz, b.x, b.y, b.z, end * STUMP_Z);
    if (!c || (end === -1 ? b.vz >= 0 : b.vz <= 0)) return;
    const rec = end === -1 ? this.s.keeper : this.s.bowler;
    const direct = Math.abs(c.x) < STUMP_HALF + 0.03 && c.y < STUMP_H + 0.03;
    const collect = !direct && Math.abs(c.x) < 2.2 && c.y < 2.3 && this.s.rng.chance(clamp(0.6 + 0.37 * (rec.p.fielding / 100), 0.6, 0.97));
    if (direct || collect) {
      this.ev({ type: 'stump', x: c.x, z: end * STUMP_Z });
      const out = this.runners.find((r) => r.moving && r.target === end && r.prog < 0.97);
      if (out) { this.wicket = { kind: 'runout', batterId: out.p.id, fielderId: this.thrower }; this.ev({ type: 'wicket' }); this.fielderFirst ??= this.thrower; this.finish(); return; }
      if (collect) { b.x = rec.e.x; b.z = rec.e.z; this.mode = 'held'; this.holder = rec; this.heldT = 0; b.stopped = true; return; }
    }
    this.mode = 'free'; this.catchable = false; // missed -> overthrow possible; ball keeps travelling
    this.tried = new Set(this.s.fielders.map((x) => x.e.id)); this.replan(true);
  }

  // ---------- running ----------
  private evaluateRun() {
    if (this.runInProgress || this.phase !== 'play' || !this.runsEnabled || this.runners.some((r) => r.moving || r.turnWait > 0)) return;
    if (this.mode === 'thrown') return;
    if (this.s.userBat) { if (this.runQueue > 0) { this.runQueue--; this.startRun(); } return; }
    if (this.canRun()) this.startRun();
  }
  private canRun(): boolean {
    const rng = this.s.rng;
    if (this.completedRuns >= 3) return false;
    const p = this.plan;
    if (this.mode === 'free' && p) {
      if (p.boundaryT != null && (!p.chaser || !p.chaser.feasible || p.chaser.t > p.boundaryT * 0.98)) return false;
      if (this.catchable && p.chaser?.air && p.chaser.feasible) return false;
    }
    const tFor = (end: -1 | 1): number => {
      if (this.mode === 'held' && this.holder) return Math.max(0, 0.45 - this.heldT) + Math.hypot(this.holder.e.x, this.holder.e.z - end * STUMP_Z) / 24;
      if (p?.chaser) return p.chaser.t + 0.5 + Math.hypot(p.chaser.x, p.chaser.z - end * STUMP_Z) / 24;
      return 99;
    };
    const tBall = Math.min(tFor(-1), tFor(1));
    const spd = (this.runners[0].p.speed + this.runners[1].p.speed) / 2;
    const runTime = (2 * RUN_END_Z) / (spd * 0.96) + 0.1;
    return tBall - runTime > this.s.runRisk + rng.normal(0, 0.22);
  }
  private startRun() {
    this.runInProgress = true; this.runStartT = this.t;
    for (const r of this.runners) {
      r.target = (r.end * -1) as -1 | 1; const hand = this.s.striker.p.hand;
      const a = endPos(r.end, hand), z = endPos(r.target, hand);
      r.sx = r.e.x; r.sz = r.e.z; r.ex = z.x; r.ez = z.z; r.prog = 0; r.moving = true; void a;
      r.e.posture = 'idle'; setAction(r.e, 'run');
    }
  }
  private stepRunners(dt: number) {
    for (const r of this.runners) {
      if (r.turnWait > 0) r.turnWait -= dt;
      if (!r.moving) { if (!r.e.hold) continue; moveEntity(r.e, dt); continue; }
      const len = Math.hypot(r.ex - r.sx, r.ez - r.sz) || 1;
      r.prog = Math.min(1, r.prog + ((r.p.speed * 0.96) / len) * dt * (r.prog < 0.08 ? 0.7 : 1));
      const bulge = Math.sin(Math.PI * r.prog) * (r.target === 1 ? 1.0 : -1.0);
      const px = r.e.x, pz = r.e.z;
      r.e.x = r.sx + (r.ex - r.sx) * r.prog + bulge; r.e.z = r.sz + (r.ez - r.sz) * r.prog;
      const dx = r.e.x - px, dz = r.e.z - pz; if (dx * dx + dz * dz > 1e-8) r.e.heading = Math.atan2(dx, dz);
      r.e.speed = r.p.speed * 0.96; if (r.e.action !== 'run') setAction(r.e, 'run');
      if (r.prog >= 1) {
        r.moving = false; r.end = r.target; r.e.speed = 0; r.turnWait = 0.2;
        const striker = r.end === -1; r.e.posture = striker ? 'stance' : 'idle'; setAction(r.e, r.e.posture);
        r.e.faceX = striker ? offSign(this.s.striker.p.hand) : 0; r.e.faceZ = striker ? 0 : -1; r.e.hasFace = true; r.e.tx = r.e.x; r.e.tz = r.e.z;
      }
    }
    if (this.runInProgress && this.runners.every((r) => !r.moving)) {
      this.runInProgress = false; this.completedRuns++;
      this.evaluateRun();
    }
  }

  // ---------- result ----------
  private finish() {
    if (this.phase === 'done') return;
    this.phase = 'done'; const wk = this.wicket;
    if (this.noBall && this.extra === null) this.extra = 'noball';
    const ran = wk && wk.kind !== 'runout' ? 0 : this.completedRuns;
    this.result = {
      id: this.s.id, extra: this.extra, batContact: this.batContact, bodyHit: this.bodyHit,
      runsRan: this.boundary ? 0 : ran, boundary: this.boundary, wicket: wk,
      shot: this.shotUsed, contact: this.contact, spec: { ...this.spec }, dropped: this.dropped, stoppedBy: this.fielderFirst,
      dirDeg: this.batContact ? this.dirDeg : undefined, airborne: this.airborneFirst, timing: this.timing, keeperTook: this.keeperTook,
    };
    for (const r of this.runners) { r.moving = false; r.e.hold = false; }
    this.s.bowler.e.hold = false;
  }
}
