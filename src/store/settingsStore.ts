import { create } from 'zustand';
import { KEYS, load, save, remove } from '../services/persistence';

export type Graphics = 'low' | 'medium' | 'high';
export type CameraMode = 'aerial' | 'broadcast' | 'bowler' | 'batsman' | 'ball' | 'boundary' | 'free';
export interface Settings { graphics: Graphics; sound: boolean; camera: CameraMode; speed: 0.5 | 1 | 2; night: boolean; compact: boolean; reducedMotion: boolean }
export const DEFAULT_SETTINGS: Settings = { graphics: 'medium', sound: true, camera: 'broadcast', speed: 1, night: false, compact: false, reducedMotion: false };
const valid = (v: unknown) => !!v && typeof v === 'object' && ['low', 'medium', 'high'].includes((v as Settings).graphics);

interface S extends Settings { set: (p: Partial<Settings>) => void; reset: () => void }
export const useSettings = create<S>((set, get) => ({
  ...{ ...DEFAULT_SETTINGS, ...load<Settings>(KEYS.settings, DEFAULT_SETTINGS, valid) },
  set: (p) => { set(p); const { set: _s, reset: _r, ...rest } = get(); save(KEYS.settings, rest); },
  reset: () => { remove(KEYS.settings); set({ ...DEFAULT_SETTINGS }); },
}));
