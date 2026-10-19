import { useSettings, CameraMode } from '../store/settingsStore';
import { useHistory } from '../store/historyStore';
import { useTournament } from '../store/tournamentStore';
import { CAMERAS } from '../components/controls/MatchControls';

export default function Settings() {
  const s = useSettings(); const clearH = useHistory((x) => x.clear); const resetT = useTournament((x) => x.reset);
  return (
    <div className="container-xl py-4" style={{ maxWidth: 820 }}>
      <h2>Settings</h2><p className="dim">Saved automatically on this device. Nothing leaves your browser.</p>
      <div className="glass p-3 mb-3"><h6>Graphics & sound</h6>
        <div className="row g-3">
          <div className="col-sm-6"><label className="small dim">Graphics quality</label><select className="form-select" value={s.graphics} onChange={(e) => s.set({ graphics: e.target.value as never })}><option value="low">Low — fewer spectators, no roof, no trail</option><option value="medium">Medium</option><option value="high">High — shadows, full crowd</option></select></div>
          <div className="col-sm-6"><label className="small dim">Sound effects</label><div className="form-check form-switch mt-2"><input className="form-check-input" type="checkbox" id="snd" checked={s.sound} onChange={(e) => s.set({ sound: e.target.checked })} /><label htmlFor="snd" className="form-check-label">{s.sound ? 'On' : 'Muted'}</label></div></div>
        </div></div>
      <div className="glass p-3 mb-3"><h6>Match defaults</h6>
        <div className="row g-3">
          <div className="col-sm-4"><label className="small dim">Default camera</label><select className="form-select" value={s.camera} onChange={(e) => s.set({ camera: e.target.value as CameraMode })}>{CAMERAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="col-sm-4"><label className="small dim">Match speed</label><select className="form-select" value={s.speed} onChange={(e) => s.set({ speed: +e.target.value as never })}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></div>
          <div className="col-sm-4"><label className="small dim">Default time</label><select className="form-select" value={s.night ? 'n' : 'd'} onChange={(e) => s.set({ night: e.target.value === 'n' })}><option value="d">Day</option><option value="n">Night</option></select></div>
        </div></div>
      <div className="glass p-3 mb-3"><h6>Interface</h6>
        <div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="cmp" checked={s.compact} onChange={(e) => s.set({ compact: e.target.checked })} /><label htmlFor="cmp" className="form-check-label">Compact scoreboard by default</label></div>
        <div className="form-check form-switch mt-2"><input className="form-check-input" type="checkbox" id="rm" checked={s.reducedMotion} onChange={(e) => s.set({ reducedMotion: e.target.checked })} /><label htmlFor="rm" className="form-check-label">Reduce interface animations</label></div></div>
      <div className="glass p-3"><h6>Saved data</h6><div className="d-flex gap-2 flex-wrap">
        <button className="btn btn-outline-light" onClick={() => s.reset()}>Reset settings</button>
        <button className="btn btn-outline-danger" onClick={() => confirm('Delete all saved matches?') && clearH()}>Clear match history</button>
        <button className="btn btn-outline-danger" onClick={() => confirm('Reset tournament progress?') && resetT()}>Reset tournament</button></div></div>
    </div>
  );
}
