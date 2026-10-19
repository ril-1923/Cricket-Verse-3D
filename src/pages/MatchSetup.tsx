import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEAMS, getTeam, KITS } from '../data/teams';
import { STADIUMS } from '../data/stadiums';
import { useMatch } from '../store/matchStore';
import { useSettings } from '../store/settingsStore';
import { FORMAT_OVERS, MatchConfig, MatchFormat } from '../types/cricket';
import { RNG } from '../utils/rng';

const FORMATS: [MatchFormat, string][] = [['quick', 'Quick Match · 2 overs'], ['short', 'Short Match · 6 overs'], ['t10', 'T10 · 10 overs'], ['t20', 'T20 · 20 overs']];
export default function MatchSetup() {
  const nav = useNavigate(); const { savedConfig, saveConfig, startMatch } = useMatch(); const settings = useSettings();
  const [c, setC] = useState<MatchConfig>({ ...savedConfig, speed: settings.speed, night: savedConfig.night });
  const [toss, setToss] = useState<{ winner: 'A' | 'B'; flipped: boolean } | null>(null);
  const up = (p: Partial<MatchConfig>) => { setC((x) => ({ ...x, ...p })); setToss(null); };
  const practice = c.mode === 'practice';
  const interactive = c.mode !== 'auto';
  const doToss = () => {
    const seed = c.seed || 1; const r = new RNG(seed * 7919 + Date.now() % 1000); const winner = r.chance(0.5) ? 'A' : 'B';
    let first: 'A' | 'B' = winner;
    if (!(interactive && winner === c.controlTeam)) first = r.chance(0.5) ? winner : winner === 'A' ? 'B' : 'A'; // AI winner picks bat or bowl
    setToss({ winner, flipped: true }); setC((x) => ({ ...x, tossWinner: winner, battingFirst: first }));
  };
  const same = c.teamAId === c.teamBId;
  const begin = () => {
    let cfg = { ...c, overs: practice ? 50 : FORMAT_OVERS[c.format], seed: Math.floor(Math.random() * 1e9) + 1 };
    if (practice) cfg = { ...cfg, battingFirst: cfg.practiceKind === 'batting' ? cfg.controlTeam : (cfg.controlTeam === 'A' ? 'B' : 'A') };
    saveConfig(cfg); useSettings.getState().set({ speed: cfg.speed, night: cfg.night }); startMatch(cfg); nav('/live');
  };
  const tA = getTeam(c.teamAId), tB = getTeam(c.teamBId);
  const needToss = !practice && !toss;
  return (
    <div className="container-xl py-4">
      <h2 className="mb-1">Match setup</h2><p className="dim">Pick the teams, format and how much of the game you want to control.</p>
      <div className="row g-3">
        <div className="col-lg-7">
          <div className="glass p-3 mb-3"><h6>Teams</h6>
            <div className="row g-2">
              {(['A', 'B'] as const).map((s) => (
                <div className="col-sm-6" key={s}>
                  <label className="small dim">Side {s} <span className="kit-dot" style={{ background: KITS[s].shirt }} /> {s === 'A' ? 'blue & gold' : 'green & red'}</label>
                  <select className="form-select" value={s === 'A' ? c.teamAId : c.teamBId} onChange={(e) => up(s === 'A' ? { teamAId: e.target.value } : { teamBId: e.target.value })}>
                    {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {same && <div className="text-warning small mt-2">Choose two different teams.</div>}
          </div>
          <div className="glass p-3 mb-3"><h6>Match</h6>
            <div className="row g-2">
              <div className="col-sm-6"><label className="small dim">Format</label><select className="form-select" disabled={practice} value={c.format} onChange={(e) => up({ format: e.target.value as MatchFormat })}>{FORMATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div className="col-sm-6"><label className="small dim">Stadium</label><select className="form-select" value={c.stadiumId} onChange={(e) => up({ stadiumId: e.target.value })}>{STADIUMS.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.capacity})</option>)}</select></div>
              <div className="col-sm-4"><label className="small dim">Time</label><select className="form-select" value={c.night ? 'n' : 'd'} onChange={(e) => up({ night: e.target.value === 'n' })}><option value="d">Day</option><option value="n">Night (floodlights)</option></select></div>
              <div className="col-sm-4"><label className="small dim">Difficulty</label><select className="form-select" value={c.difficulty} onChange={(e) => up({ difficulty: e.target.value as never })}><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></div>
              <div className="col-sm-4"><label className="small dim">Match speed</label><select className="form-select" value={c.speed} onChange={(e) => up({ speed: +e.target.value as never })}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></div>
            </div>
          </div>
          <div className="glass p-3"><h6>Who plays?</h6>
            <div className="row g-2">
              <div className="col-sm-6"><label className="small dim">Mode</label>
                <select className="form-select" value={c.mode} onChange={(e) => up({ mode: e.target.value as never })}>
                  <option value="auto">Automatic AI match (watch)</option><option value="bat">Interactive batting</option><option value="bowl">Interactive bowling</option><option value="both">Full match — control batting & bowling</option><option value="practice">Practice mode</option>
                </select></div>
              {interactive && <div className="col-sm-3"><label className="small dim">You control</label><select className="form-select" value={c.controlTeam} onChange={(e) => up({ controlTeam: e.target.value as never })}><option value="A">Side A</option><option value="B">Side B</option></select></div>}
              {practice && <div className="col-sm-3"><label className="small dim">Practice</label><select className="form-select" value={c.practiceKind} onChange={(e) => up({ practiceKind: e.target.value as never })}><option value="batting">Batting</option><option value="bowling">Bowling</option></select></div>}
            </div>
            {interactive && !practice && <p className="small dim mt-2 mb-0">Shot keys: D defend · G ground · L loft · P pull · S sweep · C cut · F glance · R run · X cancel run. Bowling: choose line, length, speed and style, then press Space to run in and Space again to release.</p>}
          </div>
        </div>
        <div className="col-lg-5">
          <div className="glass p-3 sticky-top" style={{ top: 70 }}>
            <h6>Kick-off</h6>
            <div className="vs"><div className="vs-team" style={{ borderColor: KITS.A.shirt }}><b>{tA.short}</b><span>{tA.name}</span></div><span className="dim">vs</span><div className="vs-team" style={{ borderColor: KITS.B.shirt }}><b>{tB.short}</b><span>{tB.name}</span></div></div>
            <ul className="small dim ps-3 my-3"><li>{practice ? 'Unlimited deliveries' : `${FORMAT_OVERS[c.format]} overs per innings`}</li><li>{STADIUMS.find((s) => s.id === c.stadiumId)?.name} · {c.night ? 'night' : 'day'}</li><li>{c.mode === 'auto' ? 'Both teams AI-controlled' : practice ? `Practice ${c.practiceKind}` : `You control side ${c.controlTeam}`}</li></ul>
            {!practice && (
              <div className="mb-3">
                <button className="btn btn-outline-light w-100" onClick={doToss}><i className="bi bi-coin" /> {toss ? 'Re-toss' : 'Flip the coin'}</button>
                {toss && (
                  <div className="mt-2 small">
                    <b>{toss.winner === 'A' ? tA.name : tB.name}</b> won the toss{interactive && toss.winner === c.controlTeam ? ' — your choice:' : ' and chose to '}
                    {interactive && toss.winner === c.controlTeam ? (
                      <div className="btn-group btn-group-sm ms-2"><button className={`btn btn-outline-light ${c.battingFirst === toss.winner ? 'active' : ''}`} onClick={() => setC((x) => ({ ...x, battingFirst: toss.winner }))}>Bat</button><button className={`btn btn-outline-light ${c.battingFirst !== toss.winner ? 'active' : ''}`} onClick={() => setC((x) => ({ ...x, battingFirst: toss.winner === 'A' ? 'B' : 'A' }))}>Bowl</button></div>
                    ) : <b>{c.battingFirst === toss.winner ? 'bat' : 'bowl'} first</b>}
                    <div className="dim">{getTeam(c.battingFirst === 'A' ? c.teamAId : c.teamBId).name} bat first.</div>
                  </div>
                )}
              </div>
            )}
            <button className="btn btn-gold btn-lg w-100" disabled={same || needToss} onClick={begin}>{practice ? 'Start practice' : needToss ? 'Flip the coin first' : 'Start match'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
