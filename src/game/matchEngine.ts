// Orchestrates a whole match: players, phases, AI/user control, delivery simulation and the rules engine.
import type { DeliverySpec, Innings, MatchConfig, MatchRecord, MatchState, Player, Shot, Team, TeamSide } from '../types/cricket';
import { getTeam, KITS } from '../data/teams';
import { getStadium, Stadium } from '../data/stadiums';
import { RNG, clamp } from '../utils/rng';
import { applyMatchDelivery, createMatch, setBowler } from './cricketRules';
import { DeliverySim, RUNUP, SimEvent, endPos } from './deliverySim';
import { PlayerEntity, newEntity, setAction, setTarget, moveEntity } from './entities';
import { FieldPreset, fieldPositions, keeperZ, FielderRef } from './fieldingAI';
import { battingMood, bowlingPlan, fieldPresetFor, pickBowler, situation } from './tacticalAI';
import { chooseShot } from './battingAI';
import { chooseDelivery } from './bowlingAI';
import { dugoutSeat } from './layout';
import { commentary, timingFeedback } from '../services/commentary';
import { Ball, newBall, STUMP_Z } from './ballPhysics';
import { SimulationClock } from './simulationClock';

export type Phase = 'ready' | 'pre' | 'await' | 'delivery' | 'post' | 'overBreak' | 'inningsBreak' | 'finished';
export interface CommentaryLine { id: number; over: number; ball: number; text: string; kind: 'wicket' | 'boundary' | 'run' | 'dot' | 'extra' | 'info'; score: string; innings: number; overLabel: string }
export interface Banner { text: string; kind: 'four' | 'six' | 'wicket' | 'wide' | 'noball' | 'info'; id: number }

export class MatchEngine {
  cfg: MatchConfig; teams: Record<TeamSide, Team>; stadium: Stadium; rng: RNG;
  match!: MatchState;
  entities = new Map<string, PlayerEntity>(); players = new Map<string, Player>();
  phase: Phase = 'ready'; phaseT = 0; sim: DeliverySim | null = null;
  clock = new SimulationClock();
  commentaryLog: CommentaryLine[] = []; banner: Banner | null = null; private bannerId = 0;
  restBall: Ball = newBall(); ballVisible = true; private ballReturn: { from: [number, number, number]; t: number } | null = null;
  userSpec: DeliverySpec = { style: 'fast', pace: 32, lineOff: 0.3, length: 4.8, turn: 0, label: 'Custom' };
  fieldOverride: FieldPreset | 'auto' = 'auto';
  feedback = ''; lastResultText = '';
  practice = { balls: 0, runs: 0, wickets: 0, boundaries: 0 };
  onChange: (() => void) | null = null; onSfx: ((e: SimEvent) => void) | null = null; onFinish: ((r: MatchRecord) => void) | null = null;
  record: MatchRecord | null = null;
  private deliveryId = 0; private inningsIdx = 0; private slots: Record<TeamSide, (string | null)[]> = { A: [], B: [] };
  private recent: string[] = []; private postMin = 1; private postMax = 9; private deliveryCount = 0;
  private celebrateUntil = 0;

  constructor(cfg: MatchConfig) {
    this.cfg = cfg; this.rng = new RNG(cfg.seed);
    this.teams = { A: getTeam(cfg.teamAId), B: getTeam(cfg.teamBId) };
    this.stadium = getStadium(cfg.stadiumId);
    for (const s of ['A', 'B'] as TeamSide[]) for (const p of this.teams[s].players) { this.players.set(p.id, p); this.entities.set(p.id, newEntity(p.id, s, p.hand)); }
    this.clock.speed = cfg.speed;
    this.reset();
  }

  // ---------- helpers ----------
  get inn(): Innings { return this.match.innings[this.match.current]; }
  sideOf(teamId: string): TeamSide { return this.teams.A.id === teamId ? 'A' : 'B'; }
  teamOf(teamId: string) { return this.teams[this.sideOf(teamId)]; }
  nameOf = (id: string) => this.players.get(id)?.name ?? id;
  teamName = (id: string) => (this.teams.A.id === id ? this.teams.A.name : this.teams.B.name);
  ent(id: string) { return this.entities.get(id)!; }
  get ballPos() {
    if (this.sim && this.sim.ballVisible) return { x: this.sim.ball.x, y: this.sim.ball.y, z: this.sim.ball.z, visible: true, speed: Math.hypot(this.sim.ball.vx, this.sim.ball.vy, this.sim.ball.vz) };
    return { x: this.restBall.x, y: this.restBall.y, z: this.restBall.z, visible: this.ballVisible, speed: 0 };
  }
  get userBatting() { const c = this.cfg, s = this.sideOf(this.inn.battingTeamId); return s === c.controlTeam && (c.mode === 'bat' || c.mode === 'both' || (c.mode === 'practice' && c.practiceKind === 'batting')); }
  get userBowling() { const c = this.cfg, s = this.sideOf(this.inn.bowlingTeamId); return s === c.controlTeam && (c.mode === 'bowl' || c.mode === 'both' || (c.mode === 'practice' && c.practiceKind === 'bowling')); }
  get keeperId() { return this.keeperOf(this.sideOf(this.inn.bowlingTeamId)).id; }
  get isPractice() { return this.cfg.mode === 'practice'; }
  private notify() { this.onChange?.(); }

  // ---------- lifecycle ----------
  reset() {
    const c = this.cfg; this.rng = new RNG(c.seed); this.deliveryId = 0; this.deliveryCount = 0; this.sim = null; this.commentaryLog = []; this.banner = null;
    this.recent = []; this.record = null; this.practice = { balls: 0, runs: 0, wickets: 0, boundaries: 0 }; this.feedback = ''; this.lastResultText = '';
    const first = c.battingFirst, second: TeamSide = first === 'A' ? 'B' : 'A';
    const overs = this.isPractice ? 50 : c.overs;
    this.match = createMatch({
      overs, first: { teamId: this.teams[first].id, order: this.teams[first].players.map((p) => p.id) },
      second: { teamId: this.teams[second].id, order: this.teams[second].players.map((p) => p.id) },
    });
    this.inningsIdx = 0; this.slots = { A: [], B: [] };
    this.clock.paused = false; this.clock.reset(); this.clock.speed = c.speed;
    this.beginInnings(true);
    this.phase = 'ready'; this.phaseT = 0; this.ballReturn = null; this.ballVisible = true;
    this.pushInfo(`${this.teamName(this.inn.battingTeamId)} to bat first. ${this.overs()} per side.`);
    this.notify();
  }
  private overs() { return `${this.match.meta.overs} over${this.match.meta.overs === 1 ? '' : 's'}`; }
  start() { if (this.phase === 'ready') { this.phase = 'pre'; this.phaseT = 0; this.notify(); } }
  pause() { this.clock.paused = true; this.notify(); }
  resume() { this.clock.paused = false; this.notify(); }
  setSpeed(s: 0.5 | 1 | 2) { this.clock.speed = s; this.cfg.speed = s; this.notify(); }

  /** Advance by real elapsed time (scaled by the simulation clock). */
  update(realDt: number) { this.clock.advance(realDt, (h) => this.step(h)); }
  /** Deterministic fixed-step advance (used by headless simulation and tests). */
  stepFixed(h: number) { this.step(h); }

  private pushInfo(text: string) {
    this.commentaryLog.push({ id: this.commentaryLog.length + 1, over: 0, ball: 0, text, kind: 'info', score: '', innings: this.inningsIdx, overLabel: '' });
  }
  private setBanner(text: string, kind: Banner['kind']) { this.banner = { text, kind, id: ++this.bannerId }; }

  // ---------- innings & arrangement ----------
  private beginInnings(snap: boolean) {
    const inn = this.inn, fs = this.sideOf(inn.bowlingTeamId);
    const squad = this.teams[fs].players;
    const keeper = squad.find((p) => p.role === 'Wicketkeeper') ?? squad[2];
    const bowlerId = pickBowler(inn, squad, this.rng, [keeper.id]);
    this.match = { ...this.match, innings: this.match.innings.map((x, i) => (i === this.match.current ? setBowler(x, bowlerId) : x)) };
    const rest = squad.filter((p) => p.id !== keeper.id && p.id !== bowlerId).map((p) => p.id);
    this.slots[fs] = rest.slice(0, 9);
    this.arrange(snap);
  }
  private keeperOf(side: TeamSide) { const sq = this.teams[side].players; return sq.find((p) => p.role === 'Wicketkeeper') ?? sq[2]; }
  private preset(): FieldPreset {
    if (this.fieldOverride !== 'auto') return this.fieldOverride;
    const inn = this.inn, s = situation(inn); return fieldPresetFor(bowlingPlan(s, inn), s);
  }
  private place(e: PlayerEntity, x: number, z: number, posture: PlayerEntity['posture'], face: [number, number] | null, snap: boolean, speed?: number) {
    e.posture = posture; e.seated = posture === 'sit'; e.hold = false;
    if (face) { e.faceX = face[0]; e.faceZ = face[1]; e.hasFace = true; } else e.hasFace = false;
    if (snap) { e.x = e.tx = x; e.z = e.tz = z; e.speed = 0; e.arrived = true; setAction(e, posture); if (face) e.heading = Math.atan2(face[0], face[1]); return; }
    const d = Math.hypot(e.x - x, e.z - z);
    setTarget(e, x, z, speed ?? (d > 28 ? 7 : d > 8 ? 5.6 : 3.4));
  }
  /** Sets every player's target for the next delivery: batters at the crease, others in dugout; fielders in the field. */
  arrange(snap = false) {
    const inn = this.inn, bs = this.sideOf(inn.battingTeamId), fs: TeamSide = bs === 'A' ? 'B' : 'A';
    const hand = this.ent(inn.strikerId).hand, sg = hand === 'R' ? -1 : 1;
    this.teams[bs].players.forEach((p, i) => {
      const e = this.ent(p.id);
      if (p.id === inn.strikerId) { const q = endPos(-1, hand); this.place(e, q.x, q.z, 'stance', [sg, 0], snap, 4.6); }
      else if (p.id === inn.nonStrikerId) { const q = endPos(1, hand); this.place(e, q.x, q.z, 'idle', [0, -1], snap, 4.6); }
      else { const q = dugoutSeat(this.stadium, bs, i); this.place(e, q.x, q.z, 'sit', [1, 0], snap, inn.bat[p.id]?.out ? 3.2 : 5); }
    });
    const squad = this.teams[fs].players;
    const bowlerId = inn.bowlerId ?? inn.lastBowlerId ?? squad[0].id;
    const bowlerP = this.players.get(bowlerId)!;
    const keeper = this.keeperOf(fs), ke = this.ent(keeper.id);
    const style = this.userBowling && this.phase === 'await' ? this.userSpec.style : bowlerP.bowlStyle;
    const ru = RUNUP[style] ?? RUNUP.medium;
    this.place(this.ent(bowlerId), 0.9, STUMP_Z + ru.len, 'idle', [0, -1], snap, 4.4);
    this.place(ke, hand === 'R' ? 0.15 : -0.15, keeperZ(style), 'keeper', [0, 1], snap, 4.6);
    const pos = fieldPositions(this.preset(), hand, this.stadium.rx, this.stadium.rz);
    // keep slot order stable; the new bowler's old slot goes to the previous bowler
    const slots = this.slots[fs];
    const bi = slots.indexOf(bowlerId);
    if (bi >= 0) { const prev = inn.lastBowlerId && !slots.includes(inn.lastBowlerId) ? inn.lastBowlerId : squad.find((p) => !slots.includes(p.id) && p.id !== bowlerId && p.id !== keeper.id)?.id ?? null; slots[bi] = prev; }
    for (let k = 0; k < 9; k++) {
      const id = slots[k]; if (!id) continue; const e = this.ent(id);
      this.place(e, pos[k].x, pos[k].z, 'idle', [pos[k].x * -0.3, 10], snap, 4.8);
    }
  }
  private allArrived(tol = 0.7) {
    for (const e of this.entities.values()) if (Math.hypot(e.tx - e.x, e.tz - e.z) > tol) return false;
    return true;
  }
  private moveAll(h: number, except?: Set<string>) { for (const e of this.entities.values()) if (!except?.has(e.id) && !e.hold) moveEntity(e, h); }

  // ---------- user input ----------
  get awaitingBowl() { return this.phase === 'await'; }
  get canPlayShot() { return !!this.sim && this.sim.userBatting && this.sim.canPlay; }
  setUserSpec(p: Partial<DeliverySpec>) {
    this.userSpec = { ...this.userSpec, ...p };
    if (p.style) this.arrange();
    this.notify();
  }
  startRunup() {
    if (this.phase !== 'await') return;
    this.buildSim(); this.sim!.startRunup(); this.phase = 'delivery'; this.phaseT = 0; this.notify();
  }
  releaseBall() { this.sim?.pressRelease(); }
  playShot(shot: Shot, dirDeg: number, power = 0.85) {
    if (!this.sim) return false;
    if (!this.userBatting) return false;
    return this.sim.playShot(shot, dirDeg, power);
  }
  run() { this.sim?.queueRun(); }
  cancelRun() { this.sim?.cancelRun(); }
  setFieldPreset(p: FieldPreset | 'auto') { this.fieldOverride = p; if (this.phase !== 'delivery') this.arrange(); this.notify(); }

  // ---------- stepping ----------
  private step(h: number) {
    this.phaseT += h;
    switch (this.phase) {
      case 'ready': this.moveAll(h); this.updateRestBall(h); break;
      case 'pre': {
        this.moveAll(h); this.updateRestBall(h);
        if (this.phaseT > 0.9 && (this.allArrived() || this.phaseT > 12)) this.beginDelivery();
        break;
      }
      case 'await': this.moveAll(h); this.updateRestBall(h); break;
      case 'delivery': {
        const sim = this.sim!;
        const except = new Set<string>(); for (const f of sim.s.fielders) except.add(f.e.id); except.add(sim.s.striker.e.id); except.add(sim.s.nonStriker.e.id);
        sim.step(h); this.moveAll(h, except);
        for (const ev of sim.drainEvents()) this.onSfx?.(ev);
        if (sim.done) this.completeDelivery();
        break;
      }
      case 'post': case 'overBreak': case 'inningsBreak': {
        this.moveAll(h); this.updateRestBall(h);
        const min = this.phase === 'inningsBreak' ? 3.5 : this.phase === 'overBreak' ? 2.2 : this.postMin;
        const max = this.phase === 'inningsBreak' ? 18 : this.postMax;
        if (this.phaseT > min && (this.allArrived(0.9) || this.phaseT > max)) this.afterPost();
        break;
      }
      case 'finished': this.moveAll(h); this.updateRestBall(h); break;
    }
  }
  private updateRestBall(h: number) {
    const inn = this.inn; const b = this.players.get(inn.bowlerId ?? inn.lastBowlerId ?? '') ? this.ent(inn.bowlerId ?? inn.lastBowlerId!) : null;
    if (!b) return;
    const tx = b.x + Math.sin(b.heading) * 0.25, tz = b.z + Math.cos(b.heading) * 0.25;
    if (this.ballReturn) {
      this.ballReturn.t += h; const k = clamp(this.ballReturn.t / 1.4, 0, 1), f = this.ballReturn.from;
      this.restBall.x = f[0] + (tx - f[0]) * k; this.restBall.z = f[2] + (tz - f[2]) * k;
      this.restBall.y = f[1] + (1.05 - f[1]) * k + Math.sin(k * Math.PI) * 1.6;
      if (k >= 1) this.ballReturn = null;
    } else { this.restBall.x = tx; this.restBall.y = 1.05; this.restBall.z = tz; }
  }

  private buildSim() {
    const inn = this.inn, bs = this.sideOf(inn.battingTeamId), fs: TeamSide = bs === 'A' ? 'B' : 'A';
    const bowlerP = this.players.get(inn.bowlerId!)!, strikerP = this.players.get(inn.strikerId)!, nonP = this.players.get(inn.nonStrikerId)!;
    const keeperP = this.keeperOf(fs);
    const fielders = this.teams[fs].players.map((p) => ({ e: this.ent(p.id), p, isKeeper: p.id === keeperP.id, isBowler: p.id === bowlerP.id }));
    const sit = situation(inn), mood = battingMood(sit, strikerP);
    const userBat = this.userBatting, userBowl = this.userBowling;
    const spec = userBowl ? { ...this.userSpec } : chooseDelivery({ bowler: bowlerP, batter: strikerP, plan: bowlingPlan(sit, inn), inn, rng: this.rng, recent: this.recent });
    this.recent.push(spec.label); if (this.recent.length > 4) this.recent.shift();
    const fielderPts = fielders.filter((f) => !f.isKeeper && !f.isBowler).map((f) => ({ x: f.e.x, z: f.e.z }));
    this.sim = new DeliverySim({
      id: ++this.deliveryId, rng: this.rng, rx: this.stadium.rx, rz: this.stadium.rz, difficulty: this.cfg.difficulty, spec,
      bowler: fielders.find((f) => f.isBowler)!, keeper: fielders.find((f) => f.isKeeper)!, fielders,
      striker: { e: this.ent(strikerP.id), p: strikerP }, nonStriker: { e: this.ent(nonP.id), p: nonP },
      freeHit: inn.freeHit, userBat, userBowl, runRisk: mood.runRisk,
      aiShot: (arr, sp) => chooseShot({ batter: strikerP, bowler: bowlerP, spec: sp, arr, aggression: mood.aggression, fielders: fielderPts, rng: this.rng, freeHit: inn.freeHit }),
    });
    this.ballVisible = true; this.ballReturn = null;
  }

  private beginDelivery() {
    if (this.userBowling) {
      const bp = this.players.get(this.inn.bowlerId!)!; this.userSpec.style = this.userSpec.style ?? bp.bowlStyle;
      this.phase = 'await'; this.phaseT = 0; this.arrange(); this.notify(); return;
    }
    this.buildSim(); this.sim!.startRunup(); this.phase = 'delivery'; this.phaseT = 0; this.notify();
  }

  private completeDelivery() {
    const sim = this.sim!, res = sim.result!, inn = this.inn;
    const bowler = this.players.get(inn.bowlerId!)!, striker = this.players.get(inn.strikerId)!;
    const text = commentary(res, { bowler, striker, nameOf: this.nameOf });
    const prevCurrent = this.match.current;
    this.match = applyMatchDelivery(this.match, res, this.teamName, { text, nameOf: this.nameOf });
    const after = this.match.innings[prevCurrent]; const rec = after.balls[after.balls.length - 1];
    this.deliveryCount++;
    const kind = res.wicket ? 'wicket' : res.boundary ? 'boundary' : res.extra ? 'extra' : rec && rec.runs > 0 ? 'run' : 'dot';
    this.commentaryLog.push({
      id: this.commentaryLog.length + 1, over: rec?.over ?? 0, ball: rec?.ball ?? 0, text, kind, score: `${after.runs}/${after.wickets}`, innings: prevCurrent,
      overLabel: `${rec?.over ?? 0}.${rec?.ball ?? 0}`,
    });
    this.lastResultText = text;
    this.feedback = timingFeedback(res);
    if (res.wicket) this.setBanner(res.wicket.kind === 'runout' ? 'RUN OUT!' : 'OUT!', 'wicket');
    else if (res.boundary === 6) this.setBanner('SIX!', 'six'); else if (res.boundary === 4) this.setBanner('FOUR!', 'four');
    else if (res.extra === 'wide') this.setBanner('WIDE', 'wide'); else if (res.extra === 'noball') this.setBanner('NO BALL — FREE HIT', 'noball');
    // practice bookkeeping
    if (this.isPractice) { this.practice.balls++; this.practice.runs += rec?.runs ?? 0; if (res.wicket) this.practice.wickets++; if (res.boundary) this.practice.boundaries++; }
    // visual reactions
    this.ballReturn = { from: [sim.ball.x, sim.ball.y, sim.ball.z], t: 0 }; this.ballVisible = true;
    const bowlerE = this.ent(bowler.id);
    if (res.wicket) { for (const f of sim.s.fielders) if (Math.hypot(f.e.x - bowlerE.x, f.e.z - bowlerE.z) < 30 || f.e.id === bowler.id) setAction(f.e, 'celebrate', 2.6); }
    this.sim = null;
    this.arrange();
    this.postMin = res.wicket ? 3.2 : res.boundary ? 2.2 : res.extra ? 1.0 : 1.3; this.postMax = res.wicket ? 11 : 8;
    this.phase = 'post'; this.phaseT = 0;
    this.notify();
  }

  private afterPost() {
    const m = this.match;
    if (this.isPractice && (m.current !== this.inningsIdx || m.finished)) { this.restartPracticeInnings(); return; }
    if (m.finished) {
      this.phase = 'finished'; this.phaseT = 0;
      this.pushInfo(m.result!.text);
      this.record = {
        id: `m${Date.now().toString(36)}${this.cfg.seed.toString(36)}`, date: Date.now(), config: { ...this.cfg }, teamAId: this.teams.A.id, teamBId: this.teams.B.id,
        innings: m.innings, result: m.result!, live: true, tournamentMatchId: this.cfg.tournamentMatchId,
      };
      if (m.result!.winnerTeamId) { const ws = this.sideOf(m.result!.winnerTeamId); for (const p of this.teams[ws].players) setAction(this.ent(p.id), 'celebrate', 6); this.setBanner(m.result!.text, 'info'); }
      this.onFinish?.(this.record); this.notify(); return;
    }
    if (m.current !== this.inningsIdx) {
      this.inningsIdx = m.current; this.phase = 'inningsBreak'; this.phaseT = 0;
      this.pushInfo(`Innings break. ${this.teamName(this.inn.battingTeamId)} need ${this.inn.target} to win from ${this.overs()}.`);
      this.setBanner(`TARGET ${this.inn.target}`, 'info');
      this.beginInnings(false); this.notify(); return;
    }
    if (this.inn.bowlerId === null) {
      const fs = this.sideOf(this.inn.bowlingTeamId), squad = this.teams[fs].players, keeper = this.keeperOf(fs);
      const id = pickBowler(this.inn, squad, this.rng, [keeper.id]);
      this.match = { ...m, innings: m.innings.map((x, i) => (i === m.current ? setBowler(x, id) : x)) };
      this.arrange(); this.phase = 'overBreak'; this.phaseT = 0;
      this.pushInfo(`End of over ${Math.floor(this.inn.legalBalls / 6)}. ${this.nameOf(id)} comes on to bowl.`);
      this.notify(); return;
    }
    this.phase = 'pre'; this.phaseT = 0; this.notify();
  }

  private restartPracticeInnings() {
    const bp = this.practice; this.match = createMatch(this.match.meta); this.inningsIdx = 0; this.slots = { A: [], B: [] };
    this.beginInnings(false); this.phase = 'pre'; this.phaseT = 0; this.practice = bp; this.notify();
  }
}
