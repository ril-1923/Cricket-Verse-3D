import { useEffect, useState } from 'react';
/** Forces a re-render every `ms` milliseconds (for live meters that read mutable engine state). */
export function useTick(ms = 100, active = true) {
  const [, set] = useState(0);
  useEffect(() => { if (!active) return; const id = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(id); }, [ms, active]);
}
