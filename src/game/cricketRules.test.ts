import { describe, expect, it } from 'vitest';
import { applyDelivery, applyMatchDelivery, createInnings, createMatch, setBowler, canBowl } from './cricketRules';
import type { DeliveryResult } from '../types/cricket';

const spec = { style: 'fast' as const, pace: 30, lineOff: 0, length: 5, turn: 0, label: 'test' };
let id = 0;
const d = (o: Partial<DeliveryResult> = {}): DeliveryResult => ({
  id: ++id, extra: null, batContact: true, bodyHit: false, runsRan: 0, boundary: null, wicket: null,
  shot: 'drive', contact: 'clean', spec, ...o,
});
const order = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i + 1}`);
const fresh = (overs = 2, target: number | null = null) =>
  setBowler(createInnings({ battingTeamId: 'A', bowlingTeamId: 'B', battingOrder: order('a'), maxOvers: overs, target }), 'b1');

describe('cricket rules', () => {
  it('counts dot balls and legal deliveries', () => {
    let i = fresh(); i = applyDelivery(i, d({ batContact: false }));
    expect(i.runs).toBe(0); expect(i.legalBalls).toBe(1); expect(i.bowl.b1.dots).toBe(1);
  });
  it('rotates strike on odd runs only', () => {
    let i = fresh(); i = applyDelivery(i, d({ runsRan: 1 }));
    expect(i.strikerId).toBe('a2'); i = applyDelivery(i, d({ runsRan: 2 }));
    expect(i.strikerId).toBe('a2'); i = applyDelivery(i, d({ runsRan: 3 }));
    expect(i.strikerId).toBe('a1'); expect(i.runs).toBe(6);
  });
  it('scores fours and sixes off the bat without rotating strike', () => {
    let i = fresh(); i = applyDelivery(i, d({ boundary: 4, runsRan: 1 })); i = applyDelivery(i, d({ boundary: 6 }));
    expect(i.runs).toBe(10); expect(i.bat.a1.fours).toBe(1); expect(i.bat.a1.sixes).toBe(1); expect(i.strikerId).toBe('a1');
  });
  it('wides and no-balls are not legal balls and add a penalty run', () => {
    let i = fresh(); i = applyDelivery(i, d({ extra: 'wide', batContact: false }));
    expect(i.runs).toBe(1); expect(i.legalBalls).toBe(0); expect(i.bat.a1.balls).toBe(0);
    i = applyDelivery(i, d({ extra: 'noball', boundary: 4 }));
    expect(i.runs).toBe(6); expect(i.legalBalls).toBe(0); expect(i.bat.a1.runs).toBe(4); expect(i.freeHit).toBe(true);
  });
  it('free hit: only run-outs dismiss', () => {
    let i = fresh(); i = applyDelivery(i, d({ extra: 'noball' }));
    i = applyDelivery(i, d({ wicket: { kind: 'bowled', batterId: 'a1' } }));
    expect(i.wickets).toBe(0); expect(i.freeHit).toBe(false);
  });
  it('byes and leg-byes are extras not charged to the bowler', () => {
    let i = fresh(); i = applyDelivery(i, d({ batContact: false, runsRan: 2 })); i = applyDelivery(i, d({ batContact: false, bodyHit: true, runsRan: 1 }));
    expect(i.extras.byes).toBe(2); expect(i.extras.legbyes).toBe(1); expect(i.bowl.b1.runs).toBe(0); expect(i.runs).toBe(3);
  });
  it('completes the over, swaps strike and requires a new bowler', () => {
    let i = fresh(); for (let k = 0; k < 6; k++) i = applyDelivery(i, d({ batContact: false }));
    expect(i.legalBalls).toBe(6); expect(i.bowlerId).toBeNull(); expect(i.strikerId).toBe('a2'); expect(i.bowl.b1.maidens).toBe(1);
    expect(canBowl(i, 'b1')).toBe(false); expect(() => setBowler(i, 'b1')).toThrow();
    expect(() => applyDelivery(i, d())).toThrow();
  });
  it('replaces a dismissed batter and never lets him bat again', () => {
    let i = fresh(); i = applyDelivery(i, d({ batContact: false, wicket: { kind: 'bowled', batterId: 'a1' } }));
    expect(i.wickets).toBe(1); expect(i.strikerId).toBe('a3'); expect(i.bat.a1.out).toBe(true); expect(i.bowl.b1.wickets).toBe(1);
    expect(i.fallOfWickets).toHaveLength(1);
  });
  it('run-out credits no wicket to the bowler and replaces the right batter', () => {
    let i = fresh(); i = applyDelivery(i, d({ runsRan: 1, wicket: { kind: 'runout', batterId: 'a2', fielderId: 'b5' } }));
    // after one completed run they crossed: a2 is striker, a1 non-striker; a2 out -> a3 takes striker slot
    expect(i.wickets).toBe(1); expect(i.bowl.b1.wickets).toBe(0); expect(i.strikerId).toBe('a3'); expect(i.nonStrikerId).toBe('a1');
  });
  it('never exceeds 10 wickets: innings ends all out', () => {
    let i = fresh(20);
    for (let k = 0; k < 14; k++) {
      if (i.bowlerId === null) i = setBowler(i, i.lastBowlerId === 'b1' ? 'b2' : 'b1');
      i = applyDelivery(i, d({ batContact: false, wicket: { kind: 'bowled', batterId: i.strikerId } }));
    }
    expect(i.wickets).toBe(10); expect(i.completed).toBe(true); expect(i.endReason).toBe('allout');
  });
  it('ignores duplicate delivery ids (no double scoring)', () => {
    const x = d({ boundary: 4 }); let i = fresh(); i = applyDelivery(i, x); const again = applyDelivery(i, x);
    expect(again.runs).toBe(4); expect(again.balls).toHaveLength(1);
  });
  it('never produces negative scores', () => {
    let i = fresh(); i = applyDelivery(i, d({ runsRan: -3, batContact: true })); expect(i.runs).toBe(0);
  });
  it('chase ends on reaching target and a finished match stops scoring', () => {
    const m0 = createMatch({ overs: 1, first: { teamId: 'A', order: order('a') }, second: { teamId: 'B', order: order('b') } });
    let m = m0; const nm = (t: string) => t;
    m = { ...m, innings: [setBowler(m.innings[0], 'b1')] };
    for (let k = 0; k < 6; k++) m = applyMatchDelivery(m, d({ boundary: 4 }), nm);
    expect(m.current).toBe(1); expect(m.innings[1].target).toBe(25);
    m = { ...m, innings: [m.innings[0], setBowler(m.innings[1], 'a1')] };
    for (let k = 0; k < 6 && !m.finished; k++) m = applyMatchDelivery(m, d({ boundary: 6 }), nm);
    expect(m.finished).toBe(true); expect(m.result?.winnerTeamId).toBe('B');
    const after = applyMatchDelivery(m, d({ boundary: 6 }), nm); expect(after).toBe(m);
  });
  it('detects ties and defended totals', () => {
    const nm = (t: string) => t;
    let m = createMatch({ overs: 1, first: { teamId: 'A', order: order('a') }, second: { teamId: 'B', order: order('b') } });
    m = { ...m, innings: [setBowler(m.innings[0], 'b1')] };
    for (let k = 0; k < 6; k++) m = applyMatchDelivery(m, d({ runsRan: 1 }), nm);
    m = { ...m, innings: [m.innings[0], setBowler(m.innings[1], 'a1')] };
    for (let k = 0; k < 6; k++) m = applyMatchDelivery(m, d({ runsRan: 1 }), nm);
    expect(m.finished).toBe(true); expect(m.result?.tied).toBe(true);
  });
});
