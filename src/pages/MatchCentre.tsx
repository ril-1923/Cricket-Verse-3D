import { Link } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMatch } from '../store/matchStore';
import { useHistory } from '../store/historyStore';
import { Commentary } from '../components/commentary/Commentary';
import { getTeam } from '../data/teams';
import type { Innings } from '../types/cricket';

function worm(innings: Innings[]) {
  const n = Math.max(...innings.map((i) => i.maxOvers)) * 6; const rows: Record<string, number>[] = [];
  for (let b = 0; b <= n; b++) { const row: Record<string, number> = { ball: b }; innings.forEach((inn, k) => { let runs = 0, legal = 0, shown = b === 0; for (const x of inn.balls) { runs += x.runs; if (x.legal) legal++; if (legal === b && !shown) shown = true; if (legal > b) break; } if (b <= inn.legalBalls) row[`i${k}`] = b === 0 ? 0 : (() => { let r = 0, l = 0; for (const x of inn.balls) { if (l >= b) break; r += x.runs; if (x.legal) l++; } return r; })(); void shown; void runs; }); rows.push(row); }
  return rows;
}
export default function MatchCentre() {
  const engine = useMatch((s) => s.engine); useMatch((s) => s.v); const records = useHistory((s) => s.records);
  const last = records[0];
  if (!engine && !last) return <div className="empty glass m-4"><h4>Match centre is empty</h4><p className="dim">Start a match to follow the ball-by-ball story here.</p><Link to="/setup" className="btn btn-gold">Match setup</Link></div>;
  const innings = engine ? engine.match.innings : last.innings;
  const label = (i: number) => getTeam(innings[i].battingTeamId).name;
  const data = worm(innings);
  return (
    <div className="container-xl py-4">
      <h2>Match centre</h2>
      <p className="dim">{engine ? `Live: ${engine.teams.A.name} vs ${engine.teams.B.name}` : `Latest completed match: ${getTeam(last.teamAId).name} vs ${getTeam(last.teamBId).name} — ${last.result.text}`}</p>
      <div className="row g-3">
        <div className="col-lg-7"><div className="glass p-3 mb-3"><h6>Run progression (worm)</h6>
          <div style={{ height: 280 }}><ResponsiveContainer><LineChart data={data}><CartesianGrid stroke="#ffffff22" /><XAxis dataKey="ball" stroke="#9fb0cf" label={{ value: 'legal balls', position: 'insideBottom', offset: -2, fill: '#9fb0cf' }} /><YAxis stroke="#9fb0cf" /><Tooltip contentStyle={{ background: '#0b1a33', border: '1px solid #2b4a7a' }} /><Legend />
            {innings.map((_, i) => <Line key={i} type="monotone" dataKey={`i${i}`} name={label(i)} stroke={i ? '#3ddc84' : '#f2c14e'} dot={false} strokeWidth={2} connectNulls={false} />)}</LineChart></ResponsiveContainer></div></div>
          <div className="glass p-3"><h6>Over by over</h6>{innings.map((inn, k) => { const per: number[] = []; inn.balls.forEach((b) => { per[b.over] = (per[b.over] ?? 0) + b.runs; }); return <div key={k} className="mb-2"><b>{label(k)}</b><div className="chips mt-1">{per.length ? per.map((r, o) => <span key={o} className="chip chip-r" title={`Over ${o + 1}`}>{r}</span>) : <span className="dim small">No overs completed</span>}</div></div>; })}<Link to="/scorecard" className="btn btn-sm btn-outline-light mt-2">Full scorecard</Link></div></div>
        <div className="col-lg-5">{engine ? <Commentary engine={engine} limit={400} /> : <div className="glass p-3"><h6>Commentary</h6><div className="cm-list">{last.innings.flatMap((i) => i.balls).slice(-60).reverse().map((b) => <div key={`${b.id}-${b.over}`} className="cm-line"><span className="cm-ov">{b.over}.{b.ball}</span><span className="cm-tx">{b.text}</span><span className="cm-sc">{b.scoreAfter}</span></div>)}</div></div>}</div>
      </div>
    </div>
  );
}
