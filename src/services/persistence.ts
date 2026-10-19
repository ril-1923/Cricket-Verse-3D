// Safe LocalStorage access: corrupted / missing / unavailable storage never throws.
const PREFIX = 'cv3d.';
export function load<T>(key: string, fallback: T, validate?: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    if (validate && !validate(v)) return fallback;
    return v as T;
  } catch { return fallback; }
}
export function save(key: string, value: unknown): boolean {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}
export function remove(key: string) { try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ } }
export const KEYS = { settings: 'settings', history: 'history', tournament: 'tournament', setup: 'setup' };
