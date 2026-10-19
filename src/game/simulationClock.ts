/** Controlled simulation clock: converts real frame time to fixed simulation steps. Speed scales time, never scores. */
export class SimulationClock {
  speed: 0.5 | 1 | 2 = 1; paused = false; simTime = 0; private acc = 0;
  static readonly STEP = 1 / 60;
  /** Calls step(h) zero or more times for the given real elapsed seconds. */
  advance(realDt: number, step: (h: number) => void, maxSteps = 14) {
    if (this.paused) return;
    this.acc += Math.min(realDt, 0.1) * this.speed;
    let n = 0;
    while (this.acc >= SimulationClock.STEP && n < maxSteps) { step(SimulationClock.STEP); this.acc -= SimulationClock.STEP; this.simTime += SimulationClock.STEP; n++; }
    if (n === maxSteps) this.acc = 0;
  }
  reset() { this.acc = 0; this.simTime = 0; }
}
