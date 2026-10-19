import type { MatchEngine } from '../../game/matchEngine';
import { KITS } from '../../data/teams';
import { formatOvers } from '../../utils/formatOvers';
import { fmt2, requiredRate, runRate } from '../../utils/calculations';
import type { BallRecord } from '../../types/cricket';

export const ballChip = (b: BallRecord) => (b.wicket ? 'W' : b.extra === 'wide' ? `${b.runs}wd` : b.extra === 'noball' ? `${b.runs}nb` : b.runs === 0 ? '•' : String(b.runs));
export const chipClass = (b: BallRecord) => (b.wicket ? 'chip-w' : b.boundary === 6 ? 'chip-6' : b.boundary === 4 ? 'chip-4' : b.extra ? 'chip-x' : b.runs === 0 ? 'chip-0' : 'chip-r');

/** Broadcast scoreboard. Every value is read from the live innings state. */
export function Scoreboard({ engine, compact }: { engine: MatchEngine; compact?: boolean }) {
  const m = engine.match, inn = engine.inn, side = engine.sideOf(inn.battingTeamId), team = engine.teams[side];
  const bs = inn.bat[inn.strikerId], bn = inn.bat[inn.nonStrikerId];
  const bw = inn.bowlerId ? inn.bowl[inn.bowlerId] : inn.lastBowlerId ? inn.bowl[inn.lastBowlerId] : undefined;
  const left = inn.maxOvers * 6 - inn.legalBalls, need = inn.target != null ? Math.max(0, inn.target - inn.runs) : null;
  const rr = requiredRate(inn);
  const recent = inn.balls.slice(-8);
  const prevInn = m.current > 0 ? m.innings[0] : null;
  const nm = engine.nameOf;
  return (
    <div className="scoreboard glass" style={{ ['--side' as string]: KITS[side].css }}>
      <div className="sb-main">
        <div className="sb-team"><span className="sb-dot" /><div><div className="sb-name">{team.name}</div><div className="sb-sub">{engine.isPractice ? 'Practice session' : `Innings ${m.current + 1} · ${engine.match.meta.overs} overs`}</div></div></div>
        <div className="sb-score" key={`${inn.runs}-${inn.wickets}`}><span className="runs pop">{inn.runs}</span><span className="slash">/</span><span className="wk">{inn.wickets}</span></div>
        <div className="sb-overs"><div className="lab">Overs</div><div className="val">{formatOvers(inn.legalBalls)}<span className="dim">/{inn.maxOvers}</span></div></div>
        <div className="sb-overs"><div className="lab">Run rate</div><div className="val">{fmt2(runRate(inn.runs, inn.legalBalls))}</div></div>
        {inn.target != null && (
          <div className="sb-chase">
            <div className="lab">Target {inn.target}</div>
            <div className="val sm">{need === 0 ? 'Target reached' : `${need} from ${left} balls`}</div>
            <div className="lab">Req. rate {rr != null ? fmt2(rr) : '-'}</div>
          </div>
        )}
        {prevInn && inn.target == null && null}
      </div>
      {!compact && (
        <div className="sb-detail">
          <div className="sb-players">
            <div className="row-p strike"><span>▶ {nm(inn.strikerId)}</span><b>{bs?.runs ?? 0}</b><span className="dim">({bs?.balls ?? 0})</span></div>
            <div className="row-p"><span>{nm(inn.nonStrikerId)}</span><b>{bn?.runs ?? 0}</b><span className="dim">({bn?.balls ?? 0})</span></div>
          </div>
          <div className="sb-players">
            <div className="row-p"><span>⚾ {bw ? nm(bw.playerId) : '-'}</span><b>{bw ? `${bw.wickets}-${bw.runs}` : '-'}</b><span className="dim">({bw ? formatOvers(bw.balls) : '0.0'})</span></div>
            <div className="row-p dim"><span>Partnership</span><b>{inn.partnership.runs}</b><span className="dim">({inn.partnership.balls})</span></div>
          </div>
          <div className="sb-recent">
            <div className="lab">Recent</div>
            <div className="chips">{recent.length === 0 ? <span className="dim">No deliveries yet</span> : recent.map((b) => <span key={b.id} className={`chip ${chipClass(b)}`}>{ballChip(b)}</span>)}</div>
            {inn.freeHit && <div className="free-hit">FREE HIT</div>}
          </div>
        </div>
      )}
      <div className="sb-status">{engine.match.finished ? engine.match.result?.text : prevInn && inn.target != null ? `${engine.teamName(prevInn.battingTeamId)} ${prevInn.runs}/${prevInn.wickets} · ${engine.teamName(inn.battingTeamId)} need ${need} from ${left}` : engine.phase === 'ready' ? 'Ready to start' : engine.phase === 'inningsBreak' ? 'Innings break' : engine.phase === 'overBreak' ? 'End of over' : 'Live'}</div>
    </div>
  );
}
