import type { BowlStyle, Hand, Player, Role } from '../types/cricket';
import { RNG } from '../utils/rng';

const FIRST = ['Arjun','Karthik','Ravi','Vikram','Siddharth','Naveen','Harish','Dev','Imran','Rohan','Kabir','Tarun','Yash','Anand','Pranav','Mohan','Surya','Nikhil','Aditya','Bharat','Kiran','Lokesh','Manoj','Omkar','Prakash','Rajat','Sanjay','Tushar','Uday','Varun','Zaheer','Faisal','Gautam','Jai','Dhruv','Eshan','Hari','Ishan','Neel','Piyush'];
const LAST = ['Raman','Iyer','Nair','Menon','Patel','Reddy','Shah','Khan','Das','Rao','Verma','Kulkarni','Bose','Pillai','Sethi','Joshi','Mehta','Chopra','Naidu','Gill','Thakur','Bhat','Malik','Sinha','Ghosh','Hegde','Kamath','Pandey','Saxena','Yadav'];

const SLOTS: { role: Role; style: BowlStyle; bat: [number, number]; bowl: [number, number]; field: [number, number] }[] = [
  { role: 'Batter', style: 'medium', bat: [72, 90], bowl: [15, 35], field: [60, 82] },
  { role: 'Batter', style: 'offspin', bat: [70, 88], bowl: [18, 38], field: [60, 85] },
  { role: 'Wicketkeeper', style: 'medium', bat: [64, 84], bowl: [10, 25], field: [72, 90] },
  { role: 'Batter', style: 'medium', bat: [68, 86], bowl: [15, 35], field: [58, 82] },
  { role: 'All-rounder', style: 'medium', bat: [62, 80], bowl: [60, 78], field: [62, 84] },
  { role: 'Batter', style: 'legspin', bat: [60, 80], bowl: [20, 40], field: [60, 80] },
  { role: 'All-rounder', style: 'offspin', bat: [55, 74], bowl: [62, 80], field: [60, 82] },
  { role: 'Bowler', style: 'fast', bat: [30, 52], bowl: [72, 90], field: [55, 78] },
  { role: 'Bowler', style: 'legspin', bat: [25, 46], bowl: [68, 88], field: [52, 76] },
  { role: 'Bowler', style: 'fast', bat: [22, 42], bowl: [70, 90], field: [52, 76] },
  { role: 'Bowler', style: 'offspin', bat: [18, 38], bowl: [66, 86], field: [50, 74] },
];

/** Deterministically generates a fictional squad of 11 for a team id. Batting order = array order. */
export function generateSquad(teamId: string, strength: number): Player[] {
  let seed = 7;
  for (const c of teamId) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rng = new RNG(seed);
  const usedNums = new Set<number>();
  const usedNames = new Set<string>();
  return SLOTS.map((s, i) => {
    let name = '';
    do { name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`; } while (usedNames.has(name));
    usedNames.add(name);
    let number = 0;
    do { number = rng.int(1, 99); } while (usedNums.has(number));
    usedNums.add(number);
    const f = (r: [number, number]) => Math.round(Math.min(97, Math.max(8, rng.range(r[0], r[1]) + strength)));
    const hand: Hand = rng.chance(0.28) ? 'L' : 'R';
    return {
      id: `${teamId}-${i + 1}`, name, teamId, number, role: s.role,
      batting: f(s.bat), bowling: f(s.bowl), fielding: f(s.field),
      speed: +(6.4 + rng.range(0, 1.6) + (s.role === 'Bowler' ? -0.3 : 0.1)).toFixed(2),
      bowlStyle: s.style, hand, skin: rng.int(0, 4),
    };
  });
}
