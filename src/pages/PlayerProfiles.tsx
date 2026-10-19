import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { TEAMS, findPlayer, getTeam } from '../data/teams';
import { overall } from '../types/cricket';
import { useHistory } from '../store/historyStore';
import { aggregatePlayers, batAvg, ecoOf, srOf } from '../services/statistics';
import { fmt2 } from '../utils/calculations';

export default function PlayerProfiles() {
  const { id } = useParams(); const hist = useHistory((s) => s.records);
  const [q, setQ] = useState(''), [role, setRole] = useState(''), [team, setTeam] = useState('');
  const all = useMemo(() => TEAMS.flatMap((t) => t.players), []);
  const list = all.filter((p) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!role || p.role === role) && (!team || p.teamId === team));
  const p = id ? findPlayer(id) : undefined; const a = p ? aggregatePlayers(hist).get(p.id) : undefined;
  return (
    <div className="container-xl py-4">
      <h2>Player profiles</h2>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="glass p-3">
            <input className="form-control mb-2" placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />
            <div className="d-flex gap-2 mb-2"><select className="form-select form-select-sm" value={team} onChange={(e) => setTeam(e.target.value)}><option value="">All teams</option>{TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <select className="form-select form-select-sm" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option>{['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'].map((r) => <option key={r}>{r}</option>)}</select></div>
            <div className="plist">{list.map((x) => <Link key={x.id} to={`/players/${x.id}`} className={`prow ${x.id === id ? 'on' : ''}`}><span>{x.name}</span><span className="dim small">{getTeam(x.teamId).short} · {x.role}</span><b>{overall(x)}</b></Link>)}{list.length === 0 && <div className="dim small">No players match these filters.</div>}</div>
          </div>
        </div>
        <div className="col-lg-8">
          {!p ? <div className="empty glass"><h5>Select a player</h5><p className="dim">Pick someone from the list to see ratings and career numbers from your matches.</p></div> : (
            <div className="glass p-3">
              <div className="d-flex gap-3 align-items-center flex-wrap"><div className="crest" style={{ background: `linear-gradient(135deg, ${getTeam(p.teamId).primary}, ${getTeam(p.teamId).accent})` }}>{p.number}</div><div><h3 className="m-0">{p.name}</h3><div className="dim">{getTeam(p.teamId).name} · {p.role} · {p.hand === 'R' ? 'Right' : 'Left'}-hand bat · {p.bowlStyle}</div></div><div className="ms-auto text-end"><div className="lab">Overall</div><b className="fs-1 gold">{overall(p)}</b></div></div>
              <div className="row mt-3 g-3"><div className="col-md-6" style={{ height: 240 }}><ResponsiveContainer><RadarChart data={[{ k: 'Batting', v: p.batting }, { k: 'Bowling', v: p.bowling }, { k: 'Fielding', v: p.fielding }, { k: 'Speed', v: Math.round((p.speed - 5) * 30) }]}><PolarGrid stroke="#ffffff33" /><PolarAngleAxis dataKey="k" tick={{ fill: '#cfd9ee', fontSize: 12 }} /><Radar dataKey="v" stroke="#f2c14e" fill="#f2c14e" fillOpacity={0.35} /></RadarChart></ResponsiveContainer></div>
                <div className="col-md-6"><table className="table table-dark table-sm"><tbody>
                  <tr><td>Batting / Bowling / Fielding</td><td className="text-end">{p.batting} / {p.bowling} / {p.fielding}</td></tr><tr><td>Running speed</td><td className="text-end">{p.speed.toFixed(1)} m/s</td></tr>
                  <tr><td>Matches</td><td className="text-end">{a?.matches ?? 0}</td></tr><tr><td>Runs (best)</td><td className="text-end">{a?.runs ?? 0} ({a?.best ?? 0})</td></tr><tr><td>Average / strike rate</td><td className="text-end">{a ? `${fmt2(batAvg(a))} / ${fmt2(srOf(a))}` : '-'}</td></tr>
                  <tr><td>4s / 6s</td><td className="text-end">{a?.fours ?? 0} / {a?.sixes ?? 0}</td></tr><tr><td>Wickets / economy</td><td className="text-end">{a?.wickets ?? 0} / {a && a.ballsBowled ? fmt2(ecoOf(a)) : '-'}</td></tr></tbody></table>
                  {!a && <div className="dim small">No completed matches yet — stats come from matches you play or simulate.</div>}</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
