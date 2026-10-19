import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { Stadium } from '../data/stadiums';
import type { Graphics } from '../store/settingsStore';
import { RNG } from '../utils/rng';
import { adTexture, ellipseCurve, makeStandGeometry, makeWallGeometry, stripeTexture } from './stadiumGeometry';
import { dugoutSeat } from '../game/layout';
import { KITS } from '../data/teams';

export interface BoardData { lines: string[]; sub?: string }
const CROWD_COUNT: Record<Graphics, number> = { low: 1200, medium: 4200, high: 9000 };

function Crowd({ st, graphics, excite }: { st: Stadium; graphics: Graphics; excite: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const uniforms = useRef({ uTime: { value: 0 }, uAmp: { value: 0.03 } });
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.current.uTime; sh.uniforms.uAmp = uniforms.current.uAmp;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uAmp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed.y += max(0.0, sin(uTime*6.0 + instanceMatrix[3].x*0.9 + instanceMatrix[3].z*0.6)) * uAmp * (0.4 + position.y);\n#endif');
    };
    return m;
  }, []);
  useEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const rng = new RNG(4242), palette = [KITS.A.shirt, KITS.B.shirt, '#f4f4f4', '#d9d9d9', '#f2c14e', '#c0392b', '#2c3e50', '#8e44ad', '#e67e22'].map((c) => new THREE.Color(c));
    const cand: [number, number, number, number][] = [];
    for (const [o0, o1, y0, y1] of [[4, 18, 0.8, 9], [20, 34, 12, 22]] as const) {
      const rows = Math.round((o1 - o0) / 1.1);
      for (let r = 0; r < rows; r++) {
        const k = (r + 0.5) / rows, off = o0 + k * (o1 - o0), y = y0 + k * (y1 - y0) + 0.5;
        const per = Math.PI * ((st.rx + off) + (st.rz + off)); const cnt = Math.floor(per / 0.85);
        for (let i = 0; i < cnt; i++) {
          const th = (i / cnt) * Math.PI * 2 + (r % 2) * 0.004;
          if (Math.abs(Math.atan2(Math.sin(th - Math.PI), Math.cos(th - Math.PI))) < 0.45) continue;
          cand.push([(st.rx + off) * Math.cos(th), y, (st.rz + off) * Math.sin(th), th]);
        }
      }
    }
    const keep = Math.min(1, CROWD_COUNT[graphics] / Math.max(1, cand.length));
    const picked = cand.filter(() => rng.next() < keep).slice(0, CROWD_COUNT[graphics]);
    mesh.count = picked.length;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), e = new THREE.Euler();
    picked.forEach(([x, y, z], i) => {
      e.set(0, Math.atan2(-x, -z), 0); q.setFromEuler(e); p.set(x, y, z); s.set(1, 0.85 + rng.next() * 0.3, 1);
      m.compose(p, q, s); mesh.setMatrixAt(i, m); mesh.setColorAt(i, palette[Math.floor(rng.next() * palette.length)]);
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [st, graphics]);
  useFrame((_, dt) => {
    uniforms.current.uTime.value += dt;
    excite.current = Math.max(0, excite.current - dt * 0.35);
    uniforms.current.uAmp.value = 0.03 + excite.current * 0.35;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, 9100]} material={mat} frustumCulled={false}><boxGeometry args={[0.42, 0.8, 0.32]} /></instancedMesh>;
}

function Scoreboard({ st, board }: { st: Stadium; board: BoardData }) {
  const { canvas, tex } = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 384;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { canvas: c, tex: t };
  }, []);
  useEffect(() => {
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#071226'; g.fillRect(0, 0, 1024, 384); g.strokeStyle = '#f2c14e'; g.lineWidth = 8; g.strokeRect(6, 6, 1012, 372);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 62px sans-serif';
    board.lines.slice(0, 3).forEach((l, i) => { g.fillStyle = i === 0 ? '#ffffff' : '#7ee0a0'; g.font = i === 0 ? 'bold 76px sans-serif' : 'bold 54px sans-serif'; g.fillText(l, 512, 110 + i * 100); });
    if (board.sub) { g.fillStyle = '#f2c14e'; g.font = 'bold 40px sans-serif'; g.fillText(board.sub, 512, 350); }
    tex.needsUpdate = true;
  }, [board, canvas, tex]);
  return (
    <group position={[0, 17, -(st.rz + 15.5)]}>
      <mesh><boxGeometry args={[26, 10, 0.6]} /><meshStandardMaterial color="#10151f" /></mesh>
      <mesh position={[0, 0, 0.35]}><planeGeometry args={[25, 9.4]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  );
}

function Floodlights({ st, night }: { st: Stadium; night: boolean }) {
  const towers = useMemo(() => [0.6, 2.5, 3.8, 5.7].map((a) => [(st.rx + 40) * Math.cos(a), (st.rz + 40) * Math.sin(a)] as [number, number]).concat([[ -(st.rx + 38), 30 ], [ -(st.rx + 38), -30 ]]), [st]);
  return (
    <group>
      {towers.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, Math.atan2(-x, -z), 0]}>
          <mesh position={[0, 20, 0]}><cylinderGeometry args={[0.5, 0.9, 40, 8]} /><meshStandardMaterial color="#9aa3b2" /></mesh>
          <mesh position={[0, 41, 0.5]}><boxGeometry args={[9, 5, 1]} /><meshStandardMaterial color="#222" emissive={night ? '#fff6d8' : '#333'} emissiveIntensity={night ? 2.2 : 0.1} /></mesh>
          {night && i < 4 && <spotLight position={[0, 40, 1]} target-position={[-x * 0.9, 0, -z * 0.9]} angle={0.55} penumbra={0.6} intensity={9000} decay={1.7} color="#fff3dc" />}
        </group>
      ))}
    </group>
  );
}

export function StadiumScene({ st, night, graphics, board, excite }: { st: Stadium; night: boolean; graphics: Graphics; board: BoardData; excite: React.MutableRefObject<number> }) {
  const grass = useMemo(() => { const t = stripeTexture(st.grassA, st.grassB); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); return t; }, [st]);
  const ads = useMemo(() => { const t = adTexture(); t.repeat.set(3, 1); return t; }, []);
  const tier1 = useMemo(() => makeStandGeometry(st.rx, st.rz, 4, 18, 0.8, 9), [st]);
  const tier2 = useMemo(() => makeStandGeometry(st.rx, st.rz, 20, 34, 12, 22), [st]);
  const roof = useMemo(() => makeStandGeometry(st.rx, st.rz, 6, 40, 25, 30), [st]);
  const walls = useMemo(() => [makeWallGeometry(st.rx, st.rz, 18, 0.8, 12, 30), makeWallGeometry(st.rx, st.rz, 34, 12, 25, 30)], [st]);
  const board1 = useMemo(() => makeWallGeometry(st.rx, st.rz, 2.2, 0, 1.0, 1), [st]);
  const rope = useMemo(() => new THREE.TubeGeometry(ellipseCurve(st.rx, st.rz), 160, 0.07, 6, true), [st]);
  const high = graphics === 'high';
  return (
    <group>
      {night ? <><color attach="background" args={['#050a1c']} /><fog attach="fog" args={['#050a1c', 120, 420]} /><Stars radius={300} depth={50} count={2500} factor={5} fade /><ambientLight intensity={0.22} /><hemisphereLight args={['#6f86c9', '#0d1a10', 0.45]} /></>
        : <><Sky distance={450000} sunPosition={[120, 70, -60]} turbidity={6} rayleigh={1.2} /><fog attach="fog" args={['#bcd3ea', 200, 600]} /><hemisphereLight args={['#dbe9ff', '#3d5a2a', 1.15]} /><directionalLight position={[60, 90, 40]} intensity={2.4} castShadow={high} shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={70} shadow-camera-bottom={-70} shadow-camera-far={260} /></>}
      {night && <directionalLight position={[0, 80, 30]} intensity={0.35} />}
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow><circleGeometry args={[(st.rx + 40), 64]} /><meshStandardMaterial color="#6d737d" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[st.rx + 3, st.rz + 3, 1]} receiveShadow><circleGeometry args={[1, 96]} /><meshStandardMaterial map={grass} roughness={1} /></mesh>
      {/* pitch + creases */}
      <mesh position={[0, 0.012, 0]} receiveShadow><boxGeometry args={[3.05, 0.02, 22.4]} /><meshStandardMaterial color="#c8b27c" roughness={1} /></mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0, 0.025, s * 8.84]}><boxGeometry args={[2.64, 0.005, 0.05]} /><meshBasicMaterial color="#fff" /></mesh>
          <mesh position={[0, 0.025, s * 10.06]}><boxGeometry args={[2.64, 0.005, 0.05]} /><meshBasicMaterial color="#fff" /></mesh>
          {[-1.32, 1.32].map((x) => <mesh key={x} position={[x, 0.025, s * 9.9]}><boxGeometry args={[0.05, 0.005, 2.8]} /><meshBasicMaterial color="#fff" /></mesh>)}
          {[-0.1, 0, 0.1].map((x) => <mesh key={x} position={[x, 0.36, s * 10.06]} castShadow><cylinderGeometry args={[0.02, 0.02, 0.71, 8]} /><meshStandardMaterial color="#f5ecd0" /></mesh>)}
          {[-0.05, 0.05].map((x) => <mesh key={x} position={[x, 0.72, s * 10.06]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, 0.1, 6]} /><meshStandardMaterial color="#e8d9a8" /></mesh>)}
        </group>
      ))}
      <mesh geometry={rope}><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.25} /></mesh>
      {/* ad boards */}
      <mesh geometry={board1}><meshBasicMaterial map={ads} side={THREE.DoubleSide} toneMapped={false} /></mesh>
      {/* stands */}
      <mesh geometry={tier1}><meshStandardMaterial color={st.stand} side={THREE.DoubleSide} roughness={0.95} /></mesh>
      <mesh geometry={tier2}><meshStandardMaterial color={st.stand} side={THREE.DoubleSide} roughness={0.95} /></mesh>
      {walls.map((w, i) => <mesh key={i} geometry={w}><meshStandardMaterial color="#2b3144" side={THREE.DoubleSide} /></mesh>)}
      {graphics !== 'low' && <mesh geometry={roof}><meshStandardMaterial color="#d9dee8" side={THREE.DoubleSide} transparent opacity={0.92} /></mesh>}
      <Crowd st={st} graphics={graphics} excite={excite} />
      <Scoreboard st={st} board={board} />
      <Floodlights st={st} night={night} />
      {/* sight screens */}
      {[-1, 1].map((s) => <mesh key={s} position={[0, 3.2, s * (st.rz + 1.2)]}><boxGeometry args={[16, 6.4, 0.4]} /><meshStandardMaterial color={s < 0 ? '#f2f2f2' : '#1b1f2b'} /></mesh>)}
      {/* pavilion on the west side, tunnel entrances, dugouts */}
      <group position={[-(st.rx + 17), 0, 0]}>
        <mesh position={[0, 6, 0]}><boxGeometry args={[14, 12, 52]} /><meshStandardMaterial color="#e9edf5" /></mesh>
        <mesh position={[7.1, 7.4, 0]}><boxGeometry args={[0.3, 3.2, 46]} /><meshStandardMaterial color="#6fb6ff" emissive={night ? '#9fd0ff' : '#000'} emissiveIntensity={night ? 0.8 : 0} metalness={0.5} roughness={0.2} /></mesh>
        <mesh position={[0, 12.8, 0]}><boxGeometry args={[16, 1.2, 54]} /><meshStandardMaterial color={st.accent} /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[7.1, 1.6, s * 4]}><boxGeometry args={[0.4, 3.2, 3]} /><meshStandardMaterial color="#05070c" /></mesh>)}
      </group>
      {(['A', 'B'] as const).map((side) => {
        const a = dugoutSeat(st, side, 0), b = dugoutSeat(st, side, 10), zc = (a.z + b.z) / 2, len = Math.abs(a.z - b.z) + 2;
        return (
          <group key={side} position={[a.x - 1.1, 0, zc]}>
            <mesh position={[-0.8, 1.2, 0]}><boxGeometry args={[0.2, 2.4, len]} /><meshStandardMaterial color="#1b2234" /></mesh>
            <mesh position={[0.4, 2.55, 0]}><boxGeometry args={[3.2, 0.15, len]} /><meshStandardMaterial color={KITS[side].shirt} /></mesh>
            <mesh position={[0.25, 0.35, 0]}><boxGeometry args={[0.7, 0.1, len - 1]} /><meshStandardMaterial color="#3a3f4d" /></mesh>
          </group>
        );
      })}
    </group>
  );
}
