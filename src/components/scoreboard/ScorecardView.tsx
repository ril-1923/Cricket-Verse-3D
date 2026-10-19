import { Link } from 'react-router-dom';
import type { Innings } from '../../types/cricket';
import { findPlayer, getTeam } from '../../data/teams';
import { formatOvers } from '../../utils/formatOvers';
import { economy, fmt2, strikeRate } from '../../utils/calculations';
import { ballChip, chipClass } from './Scoreboard';

const nm = (id: string) => findPlayer(id)?.name ?? id;
export function ScorecardView({ innings }: { innings: Innings[] }) {
  return (
    <>
      {innings.map((inn, idx) => {
        const bt = getTeam(inn.battingTeamId), bowlers = Object.values(inn.bowl);
        const yet = inn.battingOrder.filter((id) => !inn.bat[id]);
        const overs: Record<number, typeof inn.balls> = {}; inn.balls.forEach((b) => { (overs[b.over] ??= []).push(b); });
        return (
          <div key={idx} className="glass p-3 mb-3">
            <div className="d-flex justify-content-between align-items-baseline flex-wrap"><h5 className="m-0">{bt.name} — Innings {idx + 1}</h5><div><b className="fs-4">{inn.runs}/{inn.wickets}</b> <span className="dim">({formatOvers(inn.legalBalls)}/{inn.maxOvers} ov){inn.target ? ` · target ${inn.target}` : ''}</span></div></div>
            <div className="table-responsive"><table className="table table-dark table-sm align-middle mt-2 mb-1">
              <thead><tr><th>Batter</th><th></th><th className="text-end">R</th><th className="text-end">B</th><th className="text-end">4s</th><th className="text-end">6s</th><th className="text-end">SR</th></tr></thead>
              <tbody>{Object.values(inn.bat).map((b) => <tr key={b.playerId}><td><Link to={`/players/${b.playerId}`}>{nm(b.playerId)}</Link></td><td className="dim small">{b.out ? b.howOut : 'not out'}</td><td className="text-end"><b>{b.runs}</b></td><td className="text-end">{b.balls}</td><td className="text-end">{b.fours}</td><td className="text-end">{b.sixes}</td><td className="text-end">{fmt2(strikeRate(b.runs, b.balls))}</td></tr>)}</tbody>
            </table></div>
            <div className="small dim mb-2">Extras {inn.extras.wides + inn.extras.noballs + inn.extras.byes + inn.extras.legbyes} (wd {inn.extras.wides}, nb {inn.extras.noballs}, b {inn.extras.byes}, lb {inn.extras.legbyes}){yet.length ? ` · Did not bat: ${yet.map(nm).join(', ')}` : ''}</div>
            <div className="table-responsive"><table className="table table-dark table-sm align-middle mb-1">
              <thead><tr><th>Bowler</th><th className="text-end">O</th><th className="text-end">M</th><th className="text-end">R</th><th className="text-end">W</th><th className="text-end">Econ</th><th className="text-end">Dots</th></tr></thead>
              <tbody>{bowlers.map((b) => <tr key={b.playerId}><td><Link to={`/players/${b.playerId}`}>{nm(b.playerId)}</Link></td><td className="text-end">{formatOvers(b.balls)}</td><td className="text-end">{b.maidens}</td><td className="text-end">{b.runs}</td><td className="text-end"><b>{b.wickets}</b></td><td className="text-end">{fmt2(economy(b.runs, b.balls))}</td><td className="text-end">{b.dots}</td></tr>)}</tbody>
            </table></div>
            {inn.fallOfWickets.length > 0 && <div className="small dim mb-2">Fall of wickets: {inn.fallOfWickets.map((f) => `${f.runs}-${f.wicket} (${nm(f.playerId)}, ${f.over} ov)`).join(' · ')}</div>}
            <details><summary className="small">Ball-by-ball</summary>
              {Object.entries(overs).map(([o, bs]) => (
                <div key={o} className="over-row"><b>Over {+o + 1}</b> <span className="dim small">{nm(bs[0].bowlerId)}</span>
                  <div className="chips">{bs.map((b) => <span key={b.id} title={b.text} className={`chip ${chipClass(b)}`}>{ballChip(b)}</span>)}</div>
                  <div className="dim small">{bs.reduce((a, b) => a + b.runs, 0)} runs</div>
                </div>
              ))}
            </details>
          </div>
        );
      })}
    </>
  );
}
