import { useMemo, useState } from 'react';
import type { MatchEngine } from '../../game/matchEngine';

export function Commentary({ engine, limit = 40, scroll = true }: { engine: MatchEngine; limit?: number; scroll?: boolean }) {
  const [filter, setFilter] = useState<'all' | 'key'>('all');
  const lines = engine.commentaryLog;
  const shown = useMemo(() => {
    const l = filter === 'key' ? lines.filter((x) => x.kind === 'wicket' || x.kind === 'boundary' || x.kind === 'info') : lines;
    return l.slice(-limit).reverse();
  }, [lines, lines.length, filter, limit]);
  return (
    <div className="commentary glass">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0">Commentary</h6>
        <div className="btn-group btn-group-sm">
          <button className={`btn btn-outline-light ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`btn btn-outline-light ${filter === 'key' ? 'active' : ''}`} onClick={() => setFilter('key')}>Key moments</button>
        </div>
      </div>
      <div className={scroll ? 'cm-list' : ''}>
        {shown.length === 0 && <div className="dim small">Commentary appears here as the match is played.</div>}
        {shown.map((l) => (
          <div key={l.id} className={`cm-line k-${l.kind}`}>
            <span className="cm-ov">{l.kind === 'info' ? '·' : l.overLabel}</span>
            <span className="cm-tx">{l.text}</span>
            {l.score && <span className="cm-sc">{l.score}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
