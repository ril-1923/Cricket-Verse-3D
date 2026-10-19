import { create } from 'zustand';
import type { MatchConfig, MatchRecord } from '../types/cricket';
import { MatchEngine } from '../game/matchEngine';
import { KEYS, load, save } from '../services/persistence';
import { useHistory } from './historyStore';
import { useTournament } from './tournamentStore';

export const DEFAULT_CONFIG: MatchConfig = {
  teamAId: 'chennai-strikers', teamBId: 'mumbai-falcons', format: 'short', overs: 6, stadiumId: 'marina', night: false, mode: 'auto', controlTeam: 'A',
  difficulty: 'normal', speed: 1, tossWinner: 'A', battingFirst: 'A', seed: 1, practiceKind: 'batting',
};
const validCfg = (v: unknown) => !!v && typeof v === 'object' && typeof (v as MatchConfig).teamAId === 'string';

interface M {
  engine: MatchEngine | null; v: number; lastRecord: MatchRecord | null;
  savedConfig: MatchConfig;
  saveConfig: (c: MatchConfig) => void;
  startMatch: (cfg: MatchConfig) => MatchEngine;
  restart: () => void;
  exit: () => void;
}
export const useMatch = create<M>((set, get) => ({
  engine: null, v: 0, lastRecord: null,
  savedConfig: { ...DEFAULT_CONFIG, ...load<MatchConfig>(KEYS.setup, DEFAULT_CONFIG, validCfg) },
  saveConfig: (c) => { save(KEYS.setup, c); set({ savedConfig: c }); },
  startMatch: (cfg) => {
    const engine = new MatchEngine({ ...cfg });
    engine.onChange = () => set((s) => ({ v: s.v + 1 }));
    engine.onFinish = (rec) => {
      if (engine.isPractice) return;
      useHistory.getState().add(rec);
      if (rec.tournamentMatchId) useTournament.getState().record(rec.tournamentMatchId, rec, false);
      set({ lastRecord: rec });
    };
    set({ engine, lastRecord: null, v: 0 });
    return engine;
  },
  restart: () => { const e = get().engine; if (e) { e.reset(); set((s) => ({ v: s.v + 1 })); } },
  exit: () => { get().engine?.pause(); set({ engine: null }); },
}));
