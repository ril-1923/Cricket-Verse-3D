import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Link } from 'react-router-dom';
import { MatchEngine } from '../game/matchEngine';
import { CricketMatchScene } from '../scenes/CricketMatchScene';
import { DEFAULT_CONFIG } from '../store/matchStore';
import { STADIUMS } from '../data/stadiums';
import { useSettings, CameraMode } from '../store/settingsStore';
import { ErrorBoundary, webglOk } from '../components/ErrorBoundary';
import { CAMERAS } from '../components/controls/MatchControls';

/** Free-roam stadium with all 22 players in match positions (no match running). */
export default function StadiumArena() {
  const st = useSettings(); const [stadium, setStadium] = useState(STADIUMS[0].id); const [night, setNight] = useState(st.night); const [cam, setCam] = useState<CameraMode>('aerial');
  const engine = useMemo(() => new MatchEngine({ ...DEFAULT_CONFIG, stadiumId: stadium, seed: 11 }), [stadium]);
  const excite = useRef(0); const gl = useMemo(() => webglOk(), []);
  const names = (s: 'A' | 'B') => engine.teams[s].players;
  return (
    <div className="live">
      <div className="live-canvas">{gl ? <ErrorBoundary><Canvas shadows={st.graphics === 'high'} dpr={[1, 1.75]} camera={{ fov: 50, near: 0.1, far: 900, position: [0, 110, 78] }}><Suspense fallback={null}><CricketMatchScene engine={engine} camera={cam} graphics={st.graphics} night={night} excite={excite} drive={false} board={{ lines: ['CRICKETVERSE', 'ARENA VIEW', `${engine.stadium.capacity} SEATS`], sub: engine.stadium.name.toUpperCase() }} /></Suspense></Canvas></ErrorBoundary> : <div className="empty glass m-4">WebGL is not available in this browser.</div>}</div>
      <div className="live-top"><div className="glass p-2 d-flex flex-wrap gap-2 align-items-center"><b className="me-2">Stadium arena</b>
        <select className="form-select form-select-sm w-auto" value={stadium} onChange={(e) => setStadium(e.target.value)}>{STADIUMS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="form-select form-select-sm w-auto" value={cam} onChange={(e) => setCam(e.target.value as CameraMode)}>{CAMERAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn btn-sm btn-outline-light" onClick={() => setNight(!night)}><i className={`bi ${night ? 'bi-moon-stars' : 'bi-sun'}`} /> {night ? 'Night' : 'Day'}</button>
        <select className="form-select form-select-sm w-auto" value={st.graphics} onChange={(e) => st.set({ graphics: e.target.value as never })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        <Link to="/setup" className="btn btn-sm btn-gold ms-auto">Play a match here</Link></div></div>
      <aside className="live-side show d-none d-lg-block"><div className="glass p-3 small"><h6>All 22 players are on the field</h6>
        {(['A', 'B'] as const).map((s) => <div key={s} className="mb-2"><b>{engine.teams[s].name}</b><div className="dim">{names(s).map((p) => `${p.number} ${p.name.split(' ')[1]}`).join(' · ')}</div></div>)}<div className="dim">Use the free camera to orbit, zoom and pan.</div></div></aside>
    </div>
  );
}
