import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useHistory } from '../store/historyStore';
import { TEAMS, getTeam } from '../data/teams';
import { aggregatePlayers, ballsOf, distribution, ecoOf, srOf, teamRecord } from '../services/statistics';
import { simulateInstantly } from '../services/simulate';
import { DEFAULT_CONFIG } from '../store/matchStore';
import { fmt2 } from '../utils/calculations';

const tip = { contentStyle: { background: '#0b1a33', border: '1px solid #2b4a7a' } };
const COLORS = ['#6b7a99', '#9fb0cf', '#5ad1c2', '#8ecae6', '#3ddc84', '#f2c14e'];
export default function Statistics() {
  const { records, add } = useHistory();
  const [team, setTeam] = useState(''), [matchId, setMatchId] = useState(''), [p1, setP1] = useState(''), [p2, setP2] = useState('');
  const filtered = useMemo(() => records.filter((r) => (!matchId || r.id === matchId) && (!team || r.teamAId === team || r.teamBId === team)), [records, team, matchId]);
  const agg = useMemo(() => [...aggregatePlayers(filtered).values()], [filtered]);
  const dist = useMemo(() => distribution(ballsOf(filtered, team || undefined)), [filtered, team]);
  const perOver = useMemo(() => {
    const rows: { over: number; runs: number; wickets: number; n: number }[] = [];
    for (const r of filtered) for (const i of r.innings) { if (team && i.battingTeamId !== team) continue; const seen = new Set<number>(); for (const b of i.balls) { while (rows.length <= b.over) rows.push({ over: rows.length + 1, runs: 0, wickets: 0, n: 0 }); rows[b.over].runs += b.runs; if (b.wicket) rows[b.over].wickets++; seen.add(b.over); } seen.forEach((o) => rows[o].n++); }
    return rows.map((r) => ({ over: r.over, runs: +(r.runs / Math.max(1, r.n)).toFixed(2), wickets: +(r.wickets / Math.max(1, r.n)).toFixed(2) }));
  }, [filtered, team]);
  const batters = agg.filter((a) => a.balls >= 6).sort((a, b) => srOf(b) - srOf(a)).slice(0, 8).map((a) => ({ name: a.name.split(' ')[1] ?? a.name, sr: +srOf(a).toFixed(1) }));
  const bowlers = agg.filter((a) => a.ballsBowled >= 6).sort((a, b) => ecoOf(a) - ecoOf(b)).slice(0, 8).map((a) => ({ name: a.name.split(' ')[1] ?? a.name, eco: +ecoOf(a).toFixed(2) }));
  const wins = TEAMS.map((t) => teamRecord(filtered, t.id)).filter((r) => r.played > 0).map((r) => ({ name: getTeam(TEAMS.find((t) => t.name === r.name)!.id).short, pct: +r.pct.toFixed(0) }));
  const a1 = agg.find((a) => a.id === p1), a2 = agg.find((a) => a.id === p2);
  const cmp = a1 && a2 ? [{ k: 'Runs', a: a1.runs, b: a2.runs }, { k: 'Wickets', a: a1.wickets, b: a2.wickets }, { k: 'Strike rate', a: +srOf(a1).toFixed(0), b: +srOf(a2).toFixed(0) }, { k: '4s+6s', a: a1.fours + a1.sixes, b: a2.fours + a2.sixes }] : [];
  const simulate = () => { for (let i = 0; i < 5; i++) { const ids = TEAMS.map((t) => t.id).sort(() => Math.random() - 0.5); add(simulateInstantly({ ...DEFAULT_CONFIG, teamAId: ids[0], teamBId: ids[1], format: 'quick', overs: 2, seed: Math.floor(Math.random() * 1e9) + 1, battingFirst: Math.random() < 0.5 ? 'A' : 'B' })); } };
  if (records.length === 0) return <div className="container-xl py-4"><h2>Statistics</h2><div className="empty glass"><h5>No completed matches yet</h5><p className="dim">Charts are built only from real matches you play or simulate. Nothing here is pre-filled.</p><Link to="/setup" className="btn btn-gold me-2">Play a match</Link><button className="btn btn-outline-light" onClick={simulate}>Simulate 5 quick matches (instant, not watched)</button></div></div>;
  const Empty = ({ t }: { t: string }) => <div className="dim small p-3">{t}</div>;
  return (
    <div className="container-xl py-4">
      <div className="d-flex flex-wrap gap-2 align-items-end mb-3"><h2 className="m-0 me-auto">Statistics</h2>
        <select className="form-select form-select-sm w-auto" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team filter"><option value="">All teams</option>{TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select className="form-select form-select-sm w-auto" value={matchId} onChange={(e) => setMatchId(e.target.value)} aria-label="Match filter"><option value="">All matches ({records.length})</option>{records.map((r) => <option key={r.id} value={r.id}>{getTeam(r.teamAId).short} v {getTeam(r.teamBId).short} · {new Date(r.date).toLocaleDateString()}</option>)}</select>
        <button className="btn btn-sm btn-outline-light" onClick={simulate}>+5 simulated matches</button></div>
      <div className="row g-3 mb-3">{[['Matches', filtered.length], ['Legal balls', dist.total], ['Boundary %', fmt2(dist.boundaryPct)], ['Dot-ball %', fmt2(dist.dotPct)], ['Wickets', dist.wicket]].map(([l, v]) => <div key={l as string} className="col-6 col-md"><div className="glass p-3 text-center"><div className="lab">{l}</div><b className="fs-3">{v}</b></div></div>)}</div>
      <div className="row g-3">
        <div className="col-lg-6"><div className="glass p-3"><h6>Runs per over (average)</h6><div style={{ height: 250 }}>{perOver.length ? <ResponsiveContainer><BarChart data={perOver}><CartesianGrid stroke="#ffffff22" /><XAxis dataKey="over" stroke="#9fb0cf" /><YAxis stroke="#9fb0cf" /><Tooltip {...tip} /><Bar dataKey="runs" fill="#f2c14e" /></BarChart></ResponsiveContainer> : <Empty t="No overs bowled in this selection." />}</div></div></div>
        <div className="col-lg-6"><div className="glass p-3"><h6>Wickets per over (average)</h6><div style={{ height: 250 }}>{perOver.length ? <ResponsiveContainer><BarChart data={perOver}><CartesianGrid stroke="#ffffff22" /><XAxis dataKey="over" stroke="#9fb0cf" /><YAxis stroke="#9fb0cf" /><Tooltip {...tip} /><Bar dataKey="wickets" fill="#ef5b5b" /></BarChart></ResponsiveContainer> : <Empty t="No data." />}</div></div></div>
        <div className="col-lg-4"><div className="glass p-3"><h6>Scoring distribution</h6><div style={{ height: 250 }}><ResponsiveContainer><PieChart><Pie data={[{ n: 'Dots', v: dist.dot }, { n: '1s', v: dist.one }, { n: '2s', v: dist.two }, { n: '3s', v: dist.three }, { n: '4s', v: dist.four }, { n: '6s', v: dist.six }].filter((d) => d.v > 0)} dataKey="v" nameKey="n" outerRadius={85} label>{COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip {...tip} /><Legend /></PieChart></ResponsiveContainer></div></div></div>
        <div className="col-lg-4"><div className="glass p-3"><h6>Batter strike rates</h6><div style={{ height: 250 }}>{batters.length ? <ResponsiveContainer><BarChart data={batters} layout="vertical"><CartesianGrid stroke="#ffffff22" /><XAxis type="number" stroke="#9fb0cf" /><YAxis type="category" dataKey="name" stroke="#9fb0cf" width={70} /><Tooltip {...tip} /><Bar dataKey="sr" fill="#3ddc84" /></BarChart></ResponsiveContainer> : <Empty t="Needs batters who faced 6+ balls." />}</div></div></div>
        <div className="col-lg-4"><div className="glass p-3"><h6>Bowling economy</h6><div style={{ height: 250 }}>{bowlers.length ? <ResponsiveContainer><BarChart data={bowlers} layout="vertical"><CartesianGrid stroke="#ffffff22" /><XAxis type="number" stroke="#9fb0cf" /><YAxis type="category" dataKey="name" stroke="#9fb0cf" width={70} /><Tooltip {...tip} /><Bar dataKey="eco" fill="#5ad1c2" /></BarChart></ResponsiveContainer> : <Empty t="Needs bowlers with 1+ over." />}</div></div></div>
        <div className="col-lg-6"><div className="glass p-3"><h6>Team win percentage</h6><div style={{ height: 250 }}>{wins.length ? <ResponsiveContainer><BarChart data={wins}><CartesianGrid stroke="#ffffff22" /><XAxis dataKey="name" stroke="#9fb0cf" /><YAxis domain={[0, 100]} stroke="#9fb0cf" /><Tooltip {...tip} /><Bar dataKey="pct" fill="#8ecae6" /></BarChart></ResponsiveContainer> : <Empty t="No teams in this selection." />}</div></div></div>
        <div className="col-lg-6"><div className="glass p-3"><h6>Player comparison</h6>
          <div className="d-flex gap-2 mb-2">{[[p1, setP1], [p2, setP2]].map(([v, s], i) => <select key={i} className="form-select form-select-sm" value={v as string} onChange={(e) => (s as (x: string) => void)(e.target.value)} aria-label={`Player ${i + 1}`}><option value="">Player {i + 1}</option>{agg.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>)}</div>
          <div style={{ height: 210 }}>{cmp.length ? <ResponsiveContainer><BarChart data={cmp}><CartesianGrid stroke="#ffffff22" /><XAxis dataKey="k" stroke="#9fb0cf" /><YAxis stroke="#9fb0cf" /><Tooltip {...tip} /><Legend /><Bar dataKey="a" name={a1!.name} fill="#f2c14e" /><Bar dataKey="b" name={a2!.name} fill="#3ddc84" /></BarChart></ResponsiveContainer> : <Empty t="Choose two players to compare." />}</div></div></div>
      </div>
    </div>
  );
}
