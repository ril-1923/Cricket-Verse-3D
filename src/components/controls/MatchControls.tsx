import type { MatchEngine } from '../../game/matchEngine';
import type { CameraMode } from '../../store/settingsStore';
import { useSettings } from '../../store/settingsStore';
import { FIELD_PRESETS } from '../../game/fieldingAI';

export const CAMERAS: [CameraMode, string][] = [['broadcast', 'Broadcast'], ['aerial', 'Stadium aerial'], ['bowler', 'Bowler view'], ['batsman', 'Batsman view'], ['ball', 'Ball follow'], ['boundary', 'Boundary'], ['free', 'Free camera']];
export const MOBILE_CAMERAS: CameraMode[] = ['broadcast', 'aerial', 'ball', 'free'];

export function MatchControls({ engine, onRestart, onExit, camera, setCamera }: { engine: MatchEngine; onRestart: () => void; onExit: () => void; camera: CameraMode; setCamera: (c: CameraMode) => void }) {
  const st = useSettings();
  const paused = engine.clock.paused, ready = engine.phase === 'ready', finished = engine.phase === 'finished';
  return (
    <div className="controls glass">
      <div className="btn-group btn-group-sm">
        {ready ? <button className="btn btn-gold" onClick={() => engine.start()}><i className="bi bi-play-fill" /> Start</button>
          : paused ? <button className="btn btn-gold" onClick={() => engine.resume()}><i className="bi bi-play-fill" /> Resume</button>
          : <button className="btn btn-outline-light" disabled={finished} onClick={() => engine.pause()}><i className="bi bi-pause-fill" /> Pause</button>}
        <button className="btn btn-outline-light" onClick={onRestart}><i className="bi bi-arrow-counterclockwise" /> Restart</button>
        <button className="btn btn-outline-danger" onClick={onExit}><i className="bi bi-box-arrow-left" /> Exit</button>
      </div>
      <div className="btn-group btn-group-sm" role="group" aria-label="Match speed">
        {([0.5, 1, 2] as const).map((s) => <button key={s} className={`btn btn-outline-light ${engine.clock.speed === s ? 'active' : ''}`} onClick={() => { engine.setSpeed(s); st.set({ speed: s }); }}>{s}×</button>)}
      </div>
      <select className="form-select form-select-sm sel" value={camera} aria-label="Camera" onChange={(e) => { setCamera(e.target.value as CameraMode); st.set({ camera: e.target.value as CameraMode }); }}>
        {CAMERAS.map(([k, l]) => <option key={k} value={k} className={MOBILE_CAMERAS.includes(k) ? '' : 'desk-only'}>{l}</option>)}
      </select>
      <select className="form-select form-select-sm sel" value={engine.fieldOverride} aria-label="Field setting" onChange={(e) => engine.setFieldPreset(e.target.value as never)}>
        <option value="auto">Field: AI</option>{FIELD_PRESETS.map((p) => <option key={p} value={p}>Field: {p}</option>)}
      </select>
      <select className="form-select form-select-sm sel" value={st.graphics} aria-label="Graphics" onChange={(e) => st.set({ graphics: e.target.value as never })}>
        <option value="low">Graphics: Low</option><option value="medium">Graphics: Medium</option><option value="high">Graphics: High</option>
      </select>
      <button className={`btn btn-sm ${st.sound ? 'btn-outline-light' : 'btn-outline-secondary'}`} aria-pressed={st.sound} onClick={() => st.set({ sound: !st.sound })} title="Sound"><i className={`bi ${st.sound ? 'bi-volume-up-fill' : 'bi-volume-mute-fill'}`} /></button>
    </div>
  );
}
