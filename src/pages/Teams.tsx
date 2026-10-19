import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TEAMS } from '../data/teams';
import { overall } from '../types/cricket';
import { useHistory } from '../store/historyStore';
import { aggregatePlayers, teamRecord } from '../services/statistics';

export default function Teams() {
  const [sel, setSel] = useState(TEAMS[0].id); const hist = useHistory((s) => s.records);
  const team = TEAMS.find((t) => t.id === sel)!, agg = aggregatePlayers(hist), rec = teamRecord(hist, sel);
  const avg = (f: (p: (typeof team.players)[0]) => number) => Math.round(team.players.reduce((a, p) => a + f(p), 0) / team.players.length);
  return (
    <div className="container-xl py-4">
      <h2>Teams</h2><p className="dim">Eight fictional franchises with original identities. Squad stats grow as you play matches.</p>
      <div className="team-tabs mb-3">{TEAMS.map((t) => <button key={t.id} className={`team-tab ${sel === t.id ? 'on' : ''}`} style={{ ['--tc' as string]: t.primary }} onClick={() => setSel(t.id)}><b>{t.short}</b><span>{t.name}</span></button>)}</div>
      <div className="glass p-3 mb-3 d-flex flex-wrap gap-4 align-items-center">
        <div className="crest" style={{ background: `linear-gradient(135deg, ${team.primary}, ${team.accent})` }}>{team.short}</div>
        <div><h4 className="m-0">{team.name}</h4><div className="dim small">Played {rec.played} · Won {rec.won} · Lost {rec.lost} · Tied {rec.tied}</div></div>
        <div className="ms-auto d-flex gap-3"><div><div className="lab">Batting</div><b className="fs-4">{avg((p) => p.batting)}</b></div><div><div className="lab">Bowling</div><b className="fs-4">{avg((p) => p.bowling)}</b></div><div><div className="lab">Fielding</div><b className="fs-4">{avg((p) => p.fielding)}</b></div></div>
      </div>
      <div className="glass p-2 table-responsive"><table className="table table-dark table-hover align-middle mb-0">
        <thead><tr><th>#</th><th>Player</th><th>Role</th><th className="text-end">BAT</th><th className="text-end">BOWL</th><th className="text-end">FIELD</th><th className="text-end">OVR</th><th className="text-end">M</th><th className="text-end">Runs</th><th className="text-end">Wkts</th></tr></thead>
        <tbody>{team.players.map((p) => { const a = agg.get(p.id); return <tr key={p.id}><td className="dim">{p.number}</td><td><Link to={`/players/${p.id}`}>{p.name}</Link> {p.hand === 'L' && <span className="badge text-bg-secondary">LHB</span>}</td><td>{p.role}</td><td className="text-end">{p.batting}</td><td className="text-end">{p.bowling}</td><td className="text-end">{p.fielding}</td><td className="text-end"><b>{overall(p)}</b></td><td className="text-end">{a?.matches ?? 0}</td><td className="text-end">{a?.runs ?? 0}</td><td className="text-end">{a?.wickets ?? 0}</td></tr>; })}</tbody>
      </table></div>
    </div>
  );
}
