import { Link, useParams } from 'react-router-dom';
import { useMatch } from '../store/matchStore';
import { useHistory } from '../store/historyStore';
import { ScorecardView } from '../components/scoreboard/ScorecardView';
import { getTeam } from '../data/teams';

export default function Scorecard() {
  const { id } = useParams(); const engine = useMatch((s) => s.engine); useMatch((s) => s.v); const records = useHistory((s) => s.records);
  const rec = id ? records.find((r) => r.id === id) : undefined;
  const innings = rec ? rec.innings : engine?.match.innings;
  if (!innings) return <div className="empty glass m-4"><h4>No scorecard yet</h4><p className="dim">Play or simulate a match, or open one from history.</p><Link to="/setup" className="btn btn-gold me-2">Match setup</Link><Link to="/history" className="btn btn-outline-light">History</Link></div>;
  const title = rec ? `${getTeam(rec.teamAId).name} vs ${getTeam(rec.teamBId).name}` : `${engine!.teams.A.name} vs ${engine!.teams.B.name}`;
  const result = rec ? rec.result.text : engine!.match.finished ? engine!.match.result!.text : 'Match in progress';
  return (
    <div className="container-xl py-4"><h2 className="mb-0">{title}</h2><p className="gold">{result}{rec && !rec.live ? ' · simulated instantly' : ''}</p><ScorecardView innings={innings} /></div>
  );
}
