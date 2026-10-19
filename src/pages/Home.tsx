import { Link } from 'react-router-dom';
import { useMatch } from '../store/matchStore';
import { useHistory } from '../store/historyStore';
import { getTeam } from '../data/teams';

const MODES = [
  ['bi-robot', 'Watch an AI match', 'Both teams play themselves: bowling, batting, running, fielding. You pick the camera.', '/setup'],
  ['bi-lightning-charge', 'Bat or bowl yourself', 'Choose your shot, direction and timing — or set line, length and speed — against AI opposition.', '/setup'],
  ['bi-bullseye', 'Practice', 'Endless deliveries with instant timing feedback.', '/setup'],
  ['bi-trophy', 'Tournament', 'League table, net run rate, semi-finals and a final.', '/tournament'],
];
export default function Home() {
  const engine = useMatch((s) => s.engine); const rec = useHistory((s) => s.records[0]);
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-in">
          <h1>CricketVerse <span className="gold">3D</span></h1>
          <p className="tag">Experience Cricket. Control the Game.</p>
          <p className="dim hero-p">Twenty-two simulated players, a full stadium, real ball physics and a rules engine that scores every delivery — in your browser.</p>
          <div className="d-flex gap-2 flex-wrap">
            <Link to="/setup" className="btn btn-gold btn-lg">Play a match</Link>
            {engine && <Link to="/live" className="btn btn-outline-light btn-lg">Resume live match</Link>}
            <Link to="/arena" className="btn btn-outline-light btn-lg">Explore the stadium</Link>
          </div>
        </div>
        <div className="hero-pitch" aria-hidden><div className="pitch-strip"><span className="stump s1" /><span className="stump s2" /><span className="ball-dot" /></div></div>
      </section>
      <div className="container-xl py-4">
        <div className="row g-3">{MODES.map(([i, t, d, to]) => <div className="col-md-6 col-xl-3" key={t}><Link to={to} className="mode glass"><i className={`bi ${i}`} /><h5>{t}</h5><p className="dim mb-0">{d}</p></Link></div>)}</div>
        <div className="glass p-3 mt-3 d-flex flex-wrap align-items-center gap-3"><h6 className="m-0">Latest result</h6>{rec ? <><span><b>{getTeam(rec.teamAId).name}</b> vs <b>{getTeam(rec.teamBId).name}</b> — <span className="gold">{rec.result.text}</span></span><Link className="btn btn-sm btn-outline-light ms-auto" to={`/scorecard/${rec.id}`}>Scorecard</Link></> : <span className="dim">No matches played yet. Results you play or simulate will appear here.</span>}</div>
      </div>
    </div>
  );
}
