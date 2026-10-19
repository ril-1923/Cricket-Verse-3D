import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEAMS, getTeam } from '../data/teams';
import { qualification, standings, useTournament, leagueDone } from '../store/tournamentStore';
import { useMatch } from '../store/matchStore';
import { fmt2 } from '../utils/calculations';

export default function Tournament() {
  const nav = useNavigate(); const { t, create, reset, simulate, simulateAll, configFor } = useTournament(); const startMatch = useMatch((s) => s.startMatch);
  const [sel, setSel] = useState<string[]>(TEAMS.slice(0, 4).map((x) => x.id)); const [overs, setOvers] = useState(2);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  if (!t) return (
    <div className="container-xl py-4" style={{ maxWidth: 900 }}>
      <h2>Tournament</h2><p className="dim">Round-robin league (win = 2 points, tie = 1), then semi-finals and a final. Every result comes from a played or simulated match.</p>
      <div className="glass p-3 mb-3"><h6>Choose 4 to 8 teams</h6><div className="d-flex flex-wrap gap-2">{TEAMS.map((x) => <button key={x.id} className={`team-tab ${sel.includes(x.id) ? 'on' : ''}`} style={{ ['--tc' as string]: x.primary }} onClick={() => toggle(x.id)}><b>{x.short}</b><span>{x.name}</span></button>)}</div>
        <div className="mt-3 d-flex gap-2 align-items-center"><label className="small dim">Overs per innings</label><select className="form-select form-select-sm w-auto" value={overs} onChange={(e) => setOvers(+e.target.value)}>{[2, 6, 10, 20].map((o) => <option key={o} value={o}>{o}</option>)}</select></div></div>
      <button className="btn btn-gold btn-lg" disabled={sel.length < 4} onClick={() => create(sel, overs)}>Create tournament ({sel.length} teams, {sel.length * (sel.length - 1) / 2} league matches)</button>
    </div>
  );
  const rows = standings(t), qual = qualification(t), done = leagueDone(t);
  const watch = (id: string) => { const cfg = configFor(id, { overs: t.overs, mode: 'auto' }); if (cfg) { startMatch(cfg); nav('/live'); } };
  const MatchRow = ({ m }: { m: (typeof t.matches)[0] }) => (
    <div className="d-flex flex-wrap align-items-center gap-2 py-2 border-bottom border-secondary-subtle">
      <span className="badge text-bg-secondary">{m.stage === 'league' ? m.id : m.stage}</span>
      <b className="flex-grow-1">{getTeam(m.a).short} v {getTeam(m.b).short}</b>
      {m.done ? <span className="small gold">{m.text}{m.viaSimulation ? ' · simulated' : ' · played live'}</span> : (
        <div className="btn-group btn-group-sm"><button className="btn btn-gold" onClick={() => watch(m.id)}><i className="bi bi-camera-video" /> Watch live 3D</button><button className="btn btn-outline-light" onClick={() => simulate(m.id)}><i className="bi bi-lightning" /> Simulate instantly</button></div>)}
    </div>
  );
  return (
    <div className="container-xl py-4">
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3"><h2 className="m-0 me-auto">Tournament <span className="dim fs-6">· {t.teamIds.length} teams · {t.overs} overs</span></h2>
        <button className="btn btn-sm btn-outline-light" onClick={simulateAll} disabled={!!t.champion}><i className="bi bi-lightning-charge" /> Simulate everything remaining</button>
        <button className="btn btn-sm btn-outline-danger" onClick={() => confirm('Reset the tournament?') && reset()}>Reset tournament</button></div>
      {t.champion && <div className="glass p-4 text-center mb-3 champion"><div className="trophy">🏆</div><h3 className="m-0">{getTeam(t.champion).name}</h3><div className="gold">Tournament champions</div></div>}
      <p className="small dim">“Watch live 3D” plays the match in the stadium. “Simulate instantly” runs the same engine without rendering and is labelled as simulated in the results.</p>
      <div className="row g-3">
        <div className="col-lg-7"><div className="glass p-3 table-responsive"><h6>Points table</h6><table className="table table-dark table-sm align-middle mb-0">
          <thead><tr><th>#</th><th>Team</th><th className="text-end">P</th><th className="text-end">W</th><th className="text-end">L</th><th className="text-end">T</th><th className="text-end">Pts</th><th className="text-end">RF/BF</th><th className="text-end">RA/BB</th><th className="text-end">NRR</th><th>Status</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r.teamId} className={i < 4 ? 'top4' : ''}><td>{i + 1}</td><td>{getTeam(r.teamId).name}</td><td className="text-end">{r.p}</td><td className="text-end">{r.w}</td><td className="text-end">{r.l}</td><td className="text-end">{r.t}</td><td className="text-end"><b>{r.pts}</b></td><td className="text-end small">{r.rf}/{(r.bf / 6).toFixed(1)}</td><td className="text-end small">{r.ra}/{(r.bb / 6).toFixed(1)}</td><td className="text-end">{r.nrr >= 0 ? '+' : ''}{fmt2(r.nrr)}</td><td><span className={`badge ${qual[r.teamId] === 'qualified' ? 'text-bg-success' : qual[r.teamId] === 'out' ? 'text-bg-secondary' : 'text-bg-warning'}`}>{qual[r.teamId]}</span></td></tr>)}</tbody></table>
          <div className="small dim mt-2">NRR is estimated from runs and overs (all-out innings are charged their full quota). Top four advance.</div></div></div>
        <div className="col-lg-5">
          {t.matches.some((m) => m.stage !== 'league') && <div className="glass p-3 mb-3"><h6>Playoffs</h6>{t.matches.filter((m) => m.stage !== 'league').map((m) => <MatchRow key={m.id} m={m} />)}</div>}
          <div className="glass p-3"><h6>League fixtures {done ? '(complete)' : ''}</h6>{t.matches.filter((m) => m.stage === 'league').map((m) => <MatchRow key={m.id} m={m} />)}</div>
        </div>
      </div>
    </div>
  );
}
