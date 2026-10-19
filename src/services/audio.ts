// Procedural sound effects (no audio files needed). Respects browser autoplay rules: the context starts on first user gesture.
let ctx: AudioContext | null = null; let master: GainNode | null = null; let amb: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let enabled = true;
const ensure = () => {
  if (!enabled) return null;
  try {
    if (!ctx) { const AC = window.AudioContext || (window as any).webkitAudioContext; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
};
const noise = (c: AudioContext, secs: number) => { const b = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
export const audio = {
  setEnabled(v: boolean) { enabled = v; if (!v) this.stopAmbience(); },
  unlock() { ensure(); },
  bat(power = 1) {
    const c = ensure(); if (!c || !master) return; const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.setValueAtTime(180 + 120 * power, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    g.gain.setValueAtTime(0.4 * power, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g).connect(master); o.start(t); o.stop(t + 0.12);
  },
  cheer(level = 1) {
    const c = ensure(); if (!c || !master) return; const t = c.currentTime, src = c.createBufferSource(); src.buffer = noise(c, 2.5);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6; const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 * level, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 2.5);
  },
  wicket() {
    const c = ensure(); if (!c || !master) return; const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.5);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55); o.connect(g).connect(master); o.start(t); o.stop(t + 0.6); this.cheer(0.9);
  },
  startAmbience() {
    const c = ensure(); if (!c || !master || amb) return; const src = c.createBufferSource(); src.buffer = noise(c, 4); src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; const g = c.createGain(); g.gain.value = 0.05; src.connect(f).connect(g).connect(master!); src.start(); amb = { src, gain: g };
  },
  stopAmbience() { try { amb?.src.stop(); } catch { /* ignore */ } amb = null; },
};
