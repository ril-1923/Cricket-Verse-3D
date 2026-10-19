import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Link, useNavigate } from 'react-router-dom';
import { useMatch } from '../store/matchStore';
import { useSettings } from '../store/settingsStore';
import { CricketMatchScene } from '../scenes/CricketMatchScene';
import { Scoreboard } from '../components/scoreboard/Scoreboard';
import { Commentary } from '../components/commentary/Commentary';
import { MatchControls } from '../components/controls/MatchControls';
import { BattingPanel, BowlingPanel, SHOT_KEYS } from '../components/controls/InteractivePanels';
import { ErrorBoundary, webglOk } from '../components/ErrorBoundary';
import { audio } from '../services/audio';
import { formatOvers } from '../utils/formatOvers';

export default function LiveMatch() {
  const nav = useNavigate();
  const engine = useMatch((s) => s.engine); useMatch((s) => s.v);
  const restart = useMatch((s) => s.restart), exit = useMatch((s) => s.exit);
  const st = useSettings();
  const [camera, setCamera] = useState(st.camera);
  const [dir, setDir] = useState(20);
  const [showCm, setShowCm] = useState(false), [compact, setCompact] = useState(window.innerWidth < 768);
  const excite = useRef(0);
  const gl = useMemo(() => webglOk(), []);

  useEffect(() => {
    if (!engine) return;
    audio.setEnabled(st.sound);
    if (st.sound) audio.startAmbience();
    engine.onSfx = (e) => {
      if (e.type === 'contact') { audio.bat(Math.min(1.2, (e.q ?? 0.5) + 0.3)); } else if (e.type === 'edge') audio.bat(0.5);
      else if (e.type === 'boundary4') { audio.cheer(1); excite.current = 1; } else if (e.type === 'boundary6') { audio.cheer(1.4); excite.current = 1.4; }
      else if (e.type === 'wicket') { audio.wicket(); excite.current = 1; }
    };
    return () => { engine.onSfx = null; audio.stopAmbience(); };
  }, [engine, st.sound]);

  useEffect(() => {
    if (!engine) return;
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement; if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) && ev.key !== ' ') return;
      audio.unlock();
      const k = ev.key.toLowerCase();
      if (k === 'escape') { engine.clock.paused ? engine.resume() : engine.pause(); return; }
      if (engine.awaitingBowl && k === ' ') { ev.preventDefault(); engine.startRunup(); return; }
      if (engine.sim && engine.sim.phase === 'runup' && engine.userBowling && k === ' ') { ev.preventDefault(); engine.releaseBall(); return; }
      if (!engine.userBatting) return;
      if (k === 'arrowleft') setDir((d) => Math.max(-170, d - 10)); else if (k === 'arrowright') setDir((d) => Math.min(170, d + 10));
      else if (k === 'r') engine.run(); else if (k === 'x') engine.cancelRun();
      else if (k === ' ') { ev.preventDefault(); engine.playShot('drive', dir, 0.9); }
      else if (SHOT_KEYS[k]) engine.playShot(SHOT_KEYS[k], dir, 0.9);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [engine, dir]);

  if (!engine) return <div className="empty glass m-4"><h4>No match in progress</h4><p className="dim">Set up a match to see the 3D stadium come alive.</p><Link className="btn btn-gold" to="/setup">Go to match setup</Link></div>;

  const inn = engine.inn, over = formatOvers(inn.legalBalls), night = engine.cfg.night;
  const board = {
    lines: [`${engine.teamOf(inn.battingTeamId).short} ${inn.runs}/${inn.wickets}`, `OVERS ${over}/${inn.maxOvers}`, inn.target != null ? `TARGET ${inn.target}` : `RR ${(inn.legalBalls ? (inn.runs * 6) / inn.legalBalls : 0).toFixed(2)}`],
    sub: engine.match.finished ? engine.match.result!.text : engine.stadium.name.toUpperCase(),
  };
  const res = engine.match.result;
  const userBat = engine.userBatting, userBowl = engine.userBowling && (engine.awaitingBowl || engine.sim?.phase === 'runup');
  const exitMatch = () => { exit(); nav('/'); };

  return (
    <div className="live">
      <div className="live-canvas">
        {gl ? (
          <ErrorBoundary>
            <Canvas shadows={st.graphics === 'high'} dpr={st.graphics === 'low' ? 1 : [1, 1.75]} gl={{ antialias: st.graphics !== 'low', powerPreference: 'high-performance' }} camera={{ fov: 50, near: 0.1, far: 900, position: [0, 10, 40] }}>
              <Suspense fallback={null}><CricketMatchScene engine={engine} camera={camera} graphics={st.graphics} night={night} board={board} excite={excite} /></Suspense>
            </Canvas>
          </ErrorBoundary>
        ) : <div className="empty glass m-4"><h5>WebGL not available</h5><p className="dim">Your browser could not create a 3D context. The match can still be played in Match Centre.</p></div>}
      </div>
      <div className="live-top">
        <Scoreboard engine={engine} compact={compact} />
        <button className="btn btn-sm btn-outline-light sb-toggle" onClick={() => setCompact(!compact)} aria-label="Toggle scoreboard detail"><i className={`bi ${compact ? 'bi-chevron-down' : 'bi-chevron-up'}`} /></button>
      </div>
      {engine.banner && <div key={engine.banner.id} className={`banner b-${engine.banner.kind}`}>{engine.banner.text}</div>}
      {engine.phase === 'ready' && (
        <div className="overlay-center glass">
          <h4>{engine.teams.A.name} vs {engine.teams.B.name}</h4>
          <p className="dim mb-2">{engine.stadium.name} · {night ? 'Night' : 'Day'} · {engine.isPractice ? `Practice (${engine.cfg.practiceKind})` : `${engine.cfg.overs} overs`} · {engine.cfg.mode === 'auto' ? 'Automatic AI match' : 'Interactive'}</p>
          <button className="btn btn-gold btn-lg" onClick={() => { audio.unlock(); engine.start(); }}>Start match</button>
        </div>
      )}
      {engine.clock.paused && engine.phase !== 'ready' && <div className="overlay-center glass"><h4>Paused</h4><button className="btn btn-gold" onClick={() => engine.resume()}>Resume</button></div>}
      {engine.phase === 'finished' && res && !engine.isPractice && (
        <div className="overlay-center result glass">
          <div className="trophy">🏆</div><h3>{res.tied ? 'Match tied' : `${engine.teamName(res.winnerTeamId!)} win`}</h3><p className="lead">{res.text}</p>
          <div className="d-flex gap-3 justify-content-center mb-3 flex-wrap">{engine.match.innings.map((i) => <div key={i.battingTeamId}><div className="dim small">{engine.teamName(i.battingTeamId)}</div><b className="fs-4">{i.runs}/{i.wickets}</b> <span className="dim">({formatOvers(i.legalBalls)})</span></div>)}</div>
          <div className="d-flex gap-2 justify-content-center flex-wrap"><Link to="/scorecard" className="btn btn-gold">Full scorecard</Link><Link to="/centre" className="btn btn-outline-light">Match centre</Link><button className="btn btn-outline-light" onClick={() => restart()}>Play again</button><button className="btn btn-outline-light" onClick={exitMatch}>Exit</button></div>
        </div>
      )}
      <div className="live-bottom">
        {engine.isPractice && <div className="practice glass">Practice · balls {engine.practice.balls} · runs {engine.practice.runs} · wickets {engine.practice.wickets} · boundaries {engine.practice.boundaries}{engine.feedback ? ` · ${engine.feedback}` : ''}</div>}
        {userBat && <BattingPanel engine={engine} dir={dir} setDir={setDir} />}
        {userBowl && <BowlingPanel engine={engine} />}
        <MatchControls engine={engine} camera={camera} setCamera={setCamera} onRestart={() => restart()} onExit={exitMatch} />
      </div>
      <button className="btn btn-sm btn-outline-light cm-toggle d-lg-none" onClick={() => setShowCm(!showCm)}><i className="bi bi-chat-text" /> Commentary</button>
      <aside className={`live-side ${showCm ? 'show' : ''}`}><Commentary engine={engine} limit={30} /></aside>
    </div>
  );
}
