import type { DeliveryResult, DeliverySpec, Player } from '../types/cricket';

export const lengthWord = (s: DeliverySpec) =>
  s.length < 0.6 ? 'full toss' : s.length < 1.7 ? 'yorker' : s.length < 3.6 ? 'full length' : s.length < 6.2 ? 'good length' : s.length < 7.6 ? 'short of a length' : 'short, rising';
export const lineWord = (s: DeliverySpec) =>
  s.lineOff > 1.0 ? 'well outside off stump' : s.lineOff > 0.5 ? 'outside off stump' : s.lineOff > -0.15 ? 'on the stumps' : s.lineOff > -0.6 ? 'on the pads' : 'down the leg side';
export const styleWord = (s: DeliverySpec) => ({ fast: 'Fast', medium: 'Medium-pace', offspin: 'Off-spin', legspin: 'Leg-spin' }[s.style]);
export function regionWord(deg: number): string {
  const a = Math.abs(deg), off = deg >= 0;
  if (a < 14) return 'straight down the ground';
  if (off) return a < 50 ? 'through the covers' : a < 80 ? 'through point' : a < 112 ? 'behind point' : a < 150 ? 'down to third man' : 'past the keeper';
  return a < 50 ? 'through midwicket' : a < 80 ? 'over square leg' : a < 120 ? 'behind square' : a < 160 ? 'fine leg way' : 'off the pads past the keeper';
}
const shotName: Record<string, string> = { leave: 'Left alone', defend: 'Defended', drive: 'Driven', cut: 'Cut', pull: 'Pulled', sweep: 'Swept', glance: 'Glanced', loft: 'Lofted' };

/** Generates ball-by-ball commentary strictly from the delivery result. */
export function commentary(r: DeliveryResult, o: { bowler: Player; striker: Player; nameOf: (id: string) => string }): string {
  const d = `${lengthWord(r.spec)[0].toUpperCase()}${lengthWord(r.spec).slice(1)} ${lineWord(r.spec)}. `;
  const where = r.dirDeg != null ? regionWord(r.dirDeg) : '';
  const fielder = r.stoppedBy ? o.nameOf(r.stoppedBy) : '';
  const w = r.wicket;
  if (w) {
    if (w.kind === 'bowled') return `${d}BOWLED! ${o.striker.name} is beaten and the stumps are shattered.`;
    if (w.kind === 'caught') return `${d}${shotName[r.shot]} ${where || 'in the air'}... OUT! ${o.nameOf(w.fielderId!)} completes the catch${r.contact === 'edge' ? ' off the edge' : ''}.`;
    return `${d}Sent back... RUN OUT! ${w.fielderId ? o.nameOf(w.fielderId) : 'The fielder'} gets the throw in and the batter is short.`;
  }
  if (r.extra === 'wide') return `${d}Wide! ${r.boundary ? 'And it races away to the rope.' : r.runsRan ? `They scamper ${r.runsRan} more.` : 'The umpire signals the extra.'}`;
  if (r.extra === 'noball') return `${d}No-ball! ${r.contact === 'clean' && r.boundary ? `${shotName[r.shot]} ${where} for ${r.boundary}. ` : ''}Free hit coming up.`;
  const drop = r.dropped ? ` Dropped! ${o.nameOf(r.dropped)} puts down a chance.` : '';
  if (r.boundary === 6) return `${d}${shotName[r.shot]} ${where} — SIX! Into the stands.${drop}`;
  if (r.boundary === 4) return `${d}${shotName[r.shot]} ${where} for FOUR!${drop}`;
  if (r.contact === 'miss') return `${d}Swings and misses! Beaten by the ${r.spec.style === 'fast' || r.spec.style === 'medium' ? 'pace and bounce' : 'turn'}.${r.runsRan ? ` They run ${r.runsRan} bye${r.runsRan > 1 ? 's' : ''}.` : ''}`;
  if (r.contact === 'pad') return `${d}Hits the pad. ${r.runsRan ? `${r.runsRan} leg-bye${r.runsRan > 1 ? 's' : ''}.` : 'No run.'}`;
  if (r.contact === 'none') return `${d}${o.striker.name} leaves it alone.${r.keeperTook ? ' The keeper collects cleanly.' : ''}${r.runsRan ? ` ${r.runsRan} bye${r.runsRan > 1 ? 's' : ''}.` : ''}`;
  const edge = r.contact === 'edge' ? 'Edged! ' : '';
  if (r.runsRan > 0) return `${d}${edge}${shotName[r.shot]} ${where}. ${r.runsRan === 1 ? 'A single taken. The strike rotates.' : `${r.runsRan} runs, good running between the wickets.`}${drop}`;
  if (fielder) return `${d}${edge}${shotName[r.shot]} ${where}. ${fielder} moves quickly and stops the ball. No run.${drop}`;
  return `${d}${edge}${shotName[r.shot]} ${where}. No run.${drop}`;
}
export function timingFeedback(r: DeliveryResult): string {
  if (r.contact === 'none' || r.shot === 'leave') return 'No shot played';
  const t = r.timing ?? 0;
  if (r.contact === 'miss') return t < 0 ? 'Missed — too early' : 'Missed — too late';
  const a = Math.abs(t);
  return a < 0.04 ? 'Perfect timing' : a < 0.09 ? 'Good timing' : t < 0 ? 'Early' : 'Late';
}
