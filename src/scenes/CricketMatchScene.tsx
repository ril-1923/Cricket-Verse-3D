import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MatchEngine } from '../game/matchEngine';
import { StadiumScene, BoardData } from './StadiumScene';
import { Players } from '../components/players/Players';
import { CameraRig } from '../components/camera/CameraRig';
import type { CameraMode, Graphics } from '../store/settingsStore';

function Ball({ engine, graphics }: { engine: MatchEngine; graphics: Graphics }) {
  const mesh = useRef<THREE.Mesh>(null), shadow = useRef<THREE.Mesh>(null);
  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry(); const pts = new Float32Array(24 * 3); g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0 })); l.frustumCulled = false; return l;
  }, []);
  const hist = useRef<THREE.Vector3[]>([]);
  useFrame(() => {
    const b = engine.ballPos; const m = mesh.current!;
    m.visible = b.visible; m.position.set(b.x, b.y, b.z);
    const sh = shadow.current!; sh.visible = b.visible; sh.position.set(b.x, 0.03, b.z); const s = Math.max(0.3, 1 - b.y * 0.12); sh.scale.setScalar(s);
    if (graphics === 'low') { (trail.material as THREE.LineBasicMaterial).opacity = 0; return; }
    const h = hist.current; h.unshift(new THREE.Vector3(b.x, b.y, b.z)); if (h.length > 24) h.pop();
    const arr = (trail.geometry.getAttribute('position') as THREE.BufferAttribute);
    for (let i = 0; i < 24; i++) { const p = h[Math.min(i, h.length - 1)]; arr.setXYZ(i, p.x, p.y, p.z); }
    arr.needsUpdate = true;
    const hit = !!engine.sim && engine.sim.batContact && engine.sim.mode === 'free';
    (trail.material as THREE.LineBasicMaterial).opacity = hit ? Math.min(1, Math.max(0, (b.speed - 20) / 8)) : 0;
  });
  return (
    <>
      <mesh ref={mesh} castShadow><sphereGeometry args={[0.075, 14, 10]} /><meshStandardMaterial color="#c4221b" emissive="#5a0a07" emissiveIntensity={0.4} roughness={0.5} /></mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.14, 12]} /><meshBasicMaterial color="#000" transparent opacity={0.4} /></mesh>
      <primitive object={trail} />
    </>
  );
}

function Driver({ engine, onTick }: { engine: MatchEngine; onTick?: () => void }) {
  useFrame((_, dt) => { engine.update(dt); onTick?.(); });
  return null;
}

export function CricketMatchScene({ engine, camera, graphics, night, board, excite, drive = true }: {
  engine: MatchEngine; camera: CameraMode; graphics: Graphics; night: boolean; board: BoardData; excite: React.MutableRefObject<number>; drive?: boolean;
}) {
  useEffect(() => { /* scene mount */ }, []);
  return (
    <>
      {drive && <Driver engine={engine} />}
      <StadiumScene st={engine.stadium} night={night} graphics={graphics} board={board} excite={excite} />
      <Players engine={engine} />
      <Ball engine={engine} graphics={graphics} />
      <CameraRig engine={engine} mode={camera} />
    </>
  );
}
