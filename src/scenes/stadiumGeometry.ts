import * as THREE from 'three';

/** Sloped elliptical stand segment. off = metres outside the rope ellipse (rx+off, rz+off). Leaves an angular gap (pavilion side) at theta = PI. */
export function makeStandGeometry(rx: number, rz: number, off0: number, off1: number, y0: number, y1: number, seg = 120, gap = 0.45) {
  const pos: number[] = [], idx: number[] = [];
  const cols: number[] = []; let n = 0;
  for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * Math.PI * 2;
    const inGap = Math.abs(Math.atan2(Math.sin(th - Math.PI), Math.cos(th - Math.PI))) < gap;
    void inGap;
    for (const [o, y] of [[off0, y0], [off1, y1]] as const) { pos.push((rx + o) * Math.cos(th), y, (rz + o) * Math.sin(th)); cols.push(1, 1, 1); }
    if (i < seg) {
      const th2 = ((i + 0.5) / seg) * Math.PI * 2;
      const mid = Math.abs(Math.atan2(Math.sin(th2 - Math.PI), Math.cos(th2 - Math.PI)));
      if (mid >= gap) { const a = 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      n++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** Vertical wall strip along an ellipse (advertising boards, back walls) with u running 0..repeat. */
export function makeWallGeometry(rx: number, rz: number, off: number, y0: number, y1: number, repeat = 24, seg = 120, gap = 0.45) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * Math.PI * 2, x = (rx + off) * Math.cos(th), z = (rz + off) * Math.sin(th);
    pos.push(x, y0, z, x, y1, z); uv.push((i / seg) * repeat, 0, (i / seg) * repeat, 1);
    if (i < seg) {
      const th2 = ((i + 0.5) / seg) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(th2 - Math.PI), Math.cos(th2 - Math.PI))) >= gap) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function ellipseCurve(rx: number, rz: number, n = 128) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pts.push(new THREE.Vector3(rx * Math.cos(t), 0.06, rz * Math.sin(t))); }
  return new THREE.CatmullRomCurve3(pts, true);
}
export function stripeTexture(a: string, b: string) {
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(0, i * 16, 8, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function adTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 64; const g = c.getContext('2d')!;
  const names = ['CRICKETVERSE', 'NORTHWIND', 'AURORA TEL', 'BLUE HARBOUR', 'KITE AIR', 'TERRAFIRM'];
  const cols = ['#102a5c', '#0d4d2b', '#5c1021', '#3b2a6b', '#0b4a5c', '#5c3b0b'];
  const w = 1024 / names.length;
  names.forEach((n, i) => { g.fillStyle = cols[i]; g.fillRect(i * w, 0, w, 64); g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, i * w + w / 2, 34); g.fillStyle = '#f2c14e'; g.fillRect(i * w, 58, w, 6); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
