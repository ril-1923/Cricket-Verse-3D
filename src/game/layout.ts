import type { Stadium } from '../data/stadiums';
import type { TeamSide } from '../types/cricket';
/** Dugout bench seat (metres) for a team side; shared by the engine (positions) and the 3D stadium (building). */
export function dugoutSeat(st: Stadium, side: TeamSide, idx: number) {
  const z = (side === 'A' ? -1 : 1) * (13 + idx * 0.95);
  const bx = st.rx * Math.sqrt(Math.max(0, 1 - (z / st.rz) ** 2));
  return { x: -(bx + 3.4), z };
}
