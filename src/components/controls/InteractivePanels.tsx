import { useState } from 'react';
import type { MatchEngine } from '../../game/matchEngine';
import type { Shot } from '../../types/cricket';
import { paceRange } from '../../game/bowlingAI';
import { lengthWord } from '../../services/commentary';
import { useTick } from '../useTick';

export const SHOT_KEYS: Record<string, Shot> = { d: 'defend', g: 'drive', l: 'loft', p: 'pull', s: 'sweep', c: 'cut', f: 'glance' };
const SHOT_DEFAULT_DIR: Record<Shot, number> = { leave: 0, defend: 0, drive: 25, loft: 0, pull: -60, sweep: -75, cut: 95, glance: -135 };
const SHOT_LABEL: [Shot, string, string][] = [['defend', 'Defend', 'D'], ['drive', 'Ground', 'G'], ['loft', 'Loft', 'L'], ['pull', 'Pull', 'P'], ['sweep', 'Sweep', 'S'], ['cut', 'Cut', 'C'], ['glance', 'Glance', 'F']];

export function BattingPanel({ engine, dir, setDir }: { engine: MatchEngine; dir: number; setDir: (n: number) => void }) {
  useTick(80, true);
  const sim = engine.sim; const canPlay = engine.canPlayShot;
  const play = (s: Shot, useDefault = false) => { const d = useDefault ? SHOT_DEFAULT_DIR[s] : dir; engine.playShot(s, d, 0.9); };
  return (
    <div className="ctl-panel glass">
      <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="m-0">Batting controls</h6><span className="dim small">{sim ? (canPlay ? 'Ball incoming — pick a shot' : sim.phase === 'play' ? 'Ball in play' : 'Wait for the delivery') : 'Waiting for the next ball'}</span></div>
      <div className="shot-grid">
        {SHOT_LABEL.map(([s, l, k]) => <button key={s} className="btn btn-sm btn-shot" disabled={!canPlay} onClick={() => play(s)}><b>{l}</b><kbd>{k}</kbd></button>)}
      </div>
      <label className="small dim mt-2 d-flex justify-content-between"><span>◄ Leg side</span><span>Direction {dir > 0 ? `${dir}° off` : dir < 0 ? `${-dir}° leg` : 'straight'}</span><span>Off side ►</span></label>
      <input type="range" className="form-range" min={-170} max={170} step={5} value={dir} onChange={(e) => setDir(+e.target.value)} />
      <div className="d-flex gap-2 flex-wrap">
        <button className="btn btn-sm btn-gold" disabled={!sim || sim.phase !== 'play'} onClick={() => engine.run()}>Run <kbd>R</kbd></button>
        <button className="btn btn-sm btn-outline-light" disabled={!sim || sim.phase !== 'play'} onClick={() => engine.cancelRun()}>Cancel run <kbd>X</kbd></button>
        <span className="dim small align-self-center">←/→ adjust direction · Space = ground shot</span>
      </div>
      {engine.feedback && <div className="mt-2 small">Last shot: <b>{engine.feedback}</b></div>}
    </div>
  );
}

export function BowlingPanel({ engine }: { engine: MatchEngine }) {
  useTick(60, true);
  const spec = engine.userSpec; const [lo, hi] = paceRange(spec.style); const sim = engine.sim;
  const ready = engine.awaitingBowl; const running = !!sim && sim.phase === 'runup';
  const [pace01, setPace01] = useState(0.5);
  const set = (p: Partial<typeof spec>) => engine.setUserSpec(p);
  const bowlerZ = sim ? sim.s.bowler.e.z : 99;
  const windowNow = running && bowlerZ < 9.0 + 3.6 * 0.9 + 3.2;
  return (
    <div className="ctl-panel glass">
      <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="m-0">Bowling controls</h6><span className="dim small">{ready ? 'Choose a delivery, then start the run-up' : running ? 'Release the ball!' : 'Waiting…'}</span></div>
      <div className="btn-group btn-group-sm w-100 mb-2">
        {([['fast', 'Fast'], ['medium', 'Medium'], ['offspin', 'Off-spin'], ['legspin', 'Leg-spin']] as const).map(([s, l]) => (
          <button key={s} disabled={!ready} className={`btn btn-outline-light ${spec.style === s ? 'active' : ''}`} onClick={() => { const [a, b] = paceRange(s); set({ style: s, pace: a + (b - a) * pace01 }); }}>{l}</button>
        ))}
      </div>
      <label className="small dim d-flex justify-content-between"><span>Speed</span><span>{(spec.pace * 3.6).toFixed(0)} km/h</span></label>
      <input type="range" className="form-range" min={0} max={1} step={0.05} value={pace01} disabled={!ready} onChange={(e) => { const v = +e.target.value; setPace01(v); set({ pace: lo + (hi - lo) * v }); }} />
      <label className="small dim d-flex justify-content-between"><span>Line: leg ◄</span><span>{spec.lineOff > 1 ? 'wide of off' : spec.lineOff > 0.45 ? 'outside off' : spec.lineOff > -0.15 ? 'stumps' : 'leg side'}</span><span>► off</span></label>
      <input type="range" className="form-range" min={-1} max={1.4} step={0.05} value={spec.lineOff} disabled={!ready} onChange={(e) => set({ lineOff: +e.target.value })} />
      <label className="small dim d-flex justify-content-between"><span>Length: full ◄</span><span>{lengthWord(spec)}</span><span>► short</span></label>
      <input type="range" className="form-range" min={0.3} max={9} step={0.1} value={spec.length} disabled={!ready} onChange={(e) => set({ length: +e.target.value })} />
      <div className="d-flex gap-2 align-items-center flex-wrap">
        <button className="btn btn-gold" disabled={!ready} onClick={() => engine.startRunup()}>Start run-up <kbd>Space</kbd></button>
        <button className={`btn ${windowNow ? 'btn-success' : 'btn-outline-light'}`} disabled={!running} onClick={() => engine.releaseBall()}>Release ball <kbd>Space</kbd></button>
        {windowNow && <span className="gold small">Release as he reaches the crease!</span>}
      </div>
    </div>
  );
}
