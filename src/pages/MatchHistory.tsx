import { Link } from 'react-router-dom';
import { useHistory } from '../store/historyStore';
import { getTeam } from '../data/teams';
import { formatOvers } from '../utils/formatOvers';

export default function MatchHistory() {
  const { records, remove, clear } = useHistory();
  return (
    <div className="container-xl py-4">
      <div className="d-flex align-items-center mb-3"><h2 className="m-0 me-auto">Match history</h2>{records.length > 0 && <button className="btn btn-sm btn-outline-danger" onClick={() => confirm('Delete all saved matches?') && clear()}>Clear history</button>}</div>
      {records.length === 0 ? <div className="empty glass"><h5>No matches saved yet</h5><p className="dim">Finished matches (watched or simulated) are saved here on this device.</p><Link to="/setup" className="btn btn-gold">Play a match</Link></div> : (
        <div className="d-grid gap-2">{records.map((r) => (
          <div key={r.id} className="glass p-3 d-flex flex-wrap align-items-center gap-3">
            <div className="flex-grow-1"><b>{getTeam(r.teamAId).name} vs {getTeam(r.teamBId).name}</b><div className="gold small">{r.result.text}</div><div className="dim small">{new Date(r.date).toLocaleString()} · {r.config.overs} overs · {r.live ? 'watched live' : 'simulated instantly'}{r.tournamentMatchId ? ' · tournament' : ''}</div></div>
            <div className="text-end small">{r.innings.map((i) => <div key={i.battingTeamId}>{getTeam(i.battingTeamId).short} <b>{i.runs}/{i.wickets}</b> <span className="dim">({formatOvers(i.legalBalls)})</span></div>)}</div>
            <div className="btn-group btn-group-sm"><Link to={`/scorecard/${r.id}`} className="btn btn-outline-light">Scorecard</Link><button className="btn btn-outline-danger" aria-label="Delete match" onClick={() => remove(r.id)}><i className="bi bi-trash" /></button></div>
          </div>))}</div>)}
    </div>
  );
}
