import type { Team } from '../types/cricket';
import { generateSquad } from './players';

// All teams and players are fictional. Colours here are team identity (UI); on-pitch kits are by side (see KITS).
const defs: [string, string, string, string, string, number][] = [
  ['chennai-strikers', 'Chennai Strikers', 'CHS', '#f2c14e', '#1b1f3b', 2],
  ['mumbai-falcons', 'Mumbai Falcons', 'MUF', '#3b82f6', '#0b1e44', 1],
  ['bengaluru-blazers', 'Bengaluru Blazers', 'BEB', '#ef4444', '#2a0d12', 0],
  ['delhi-warriors', 'Delhi Warriors', 'DEW', '#60a5fa', '#10223f', -1],
  ['kolkata-tigers', 'Kolkata Tigers', 'KOT', '#a855f7', '#1d1038', 1],
  ['hyderabad-hawks', 'Hyderabad Hawks', 'HYH', '#fb923c', '#2b1608', 0],
  ['rajasthan-royals-xi', 'Rajasthan Royals XI', 'RRX', '#ec4899', '#2a0e20', -2],
  ['punjab-panthers', 'Punjab Panthers', 'PUP', '#34d399', '#0b2a20', 0],
];
export const TEAMS: Team[] = defs.map(([id, name, short, primary, accent, strength]) => ({
  id, name, short, primary, accent, trousers: '#1a1d29', players: generateSquad(id, strength * 2),
}));
export const getTeam = (id: string): Team => TEAMS.find((t) => t.id === id) ?? TEAMS[0];
export const findPlayer = (id: string) => { for (const t of TEAMS) { const p = t.players.find((x) => x.id === id); if (p) return p; } return undefined; };

/** On-pitch kits by side. Side A: blue + gold. Side B: green + red. Dark trousers for both. */
export const KITS = {
  A: { shirt: '#1f56d6', accent: '#f2c14e', trousers: '#171b2b', css: '#3b82f6' },
  B: { shirt: '#1f9d55', accent: '#e23b3b', trousers: '#171b2b', css: '#22c55e' },
};
export const SKINS = ['#f1c6a0', '#d9a27a', '#b9784f', '#8d5a3b', '#6b4229'];
