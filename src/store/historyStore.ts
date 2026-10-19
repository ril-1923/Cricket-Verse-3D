import { create } from 'zustand';
import type { MatchRecord } from '../types/cricket';
import { KEYS, load, save, remove } from '../services/persistence';

const MAX = 40;
const valid = (v: unknown) => Array.isArray(v) && v.every((r) => r && typeof r === 'object' && Array.isArray((r as MatchRecord).innings) && (r as MatchRecord).result);
interface H { records: MatchRecord[]; add: (r: MatchRecord) => void; clear: () => void; remove: (id: string) => void }
export const useHistory = create<H>((set, get) => ({
  records: load<MatchRecord[]>(KEYS.history, [], valid),
  add: (r) => {
    if (get().records.some((x) => x.id === r.id)) return;
    let next = [r, ...get().records].slice(0, MAX);
    // if storage quota is hit, keep fewer records rather than failing silently
    while (next.length > 1 && !save(KEYS.history, next)) next = next.slice(0, Math.max(1, Math.floor(next.length / 2)));
    set({ records: next });
  },
  remove: (id) => { const next = get().records.filter((r) => r.id !== id); save(KEYS.history, next); set({ records: next }); },
  clear: () => { remove(KEYS.history); set({ records: [] }); },
}));
