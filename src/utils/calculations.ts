import type { Innings } from '../types/cricket';
export const runRate = (runs: number, balls: number) => (balls > 0 ? (runs * 6) / balls : 0);
export const strikeRate = (runs: number, balls: number) => (balls > 0 ? (runs * 100) / balls : 0);
export const economy = (runs: number, balls: number) => (balls > 0 ? (runs * 6) / balls : 0);
export const requiredRate = (inn: Innings) => {
  if (inn.target == null) return null;
  const left = inn.maxOvers * 6 - inn.legalBalls;
  return left > 0 ? ((inn.target - inn.runs) * 6) / left : null;
};
/** Net run rate from totals: (runs for / balls faced) - (runs against / balls bowled), per over. */
export const netRunRate = (rf: number, bf: number, ra: number, bb: number) =>
  (bf > 0 ? (rf * 6) / bf : 0) - (bb > 0 ? (ra * 6) / bb : 0);
export const fmt2 = (n: number) => (isFinite(n) ? n.toFixed(2) : '0.00');
