import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { MatchEngine } from '../../game/matchEngine';
import type { CameraMode } from '../../store/settingsStore';

/** Smoothly blends between camera modes. Changing mode never touches the simulation. */
export function CameraRig({ engine, mode }: { engine: MatchEngine; mode: CameraMode }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 1, 0)), want = useRef(new THREE.Vector3()), wantLook = useRef(new THREE.Vector3());
  const ctrl = useRef<any>(null); const lastDir = useRef(new THREE.Vector3(0, 0, 1)); const prev = useRef<CameraMode>(mode);
  useEffect(() => {
    if (prev.current === 'free' && mode !== 'free') { /* leaving orbit: keep current pose and blend */ }
    if (mode === 'free' && ctrl.current) ctrl.current.target.copy(look.current);
    prev.current = mode;
  }, [mode]);
  useFrame((_, dt0) => {
    if (mode === 'free') { look.current.copy(ctrl.current?.target ?? look.current); return; }
    const dt = Math.min(dt0, 0.05), b = engine.ballPos, st = engine.stadium;
    const live = !!engine.sim && b.visible;
    let m: CameraMode = mode;
    if (m === 'ball' && !(live && engine.sim!.phase !== 'runup')) m = 'broadcast';
    switch (m) {
      case 'aerial': want.current.set(0, 120, 78); wantLook.current.set(0, 0, 0); break;
      case 'broadcast': {
        let lx = 0, ly = 1.2, lz = -2, px = 0, py = 9.5, pz = 40;
        if (live && engine.sim!.phase === 'play' && engine.sim!.batContact) {
          lx = b.x * 0.35; lz = b.z * 0.35 - 2; const far = Math.min(1, Math.hypot(b.x, b.z) / 60); px = b.x * 0.2; py = 9.5 + far * 9; pz = 40 + far * 14;
        }
        want.current.set(px, py, pz); wantLook.current.set(lx, ly, lz); break;
      }
      case 'bowler': want.current.set(0.3, 2.6, 15); wantLook.current.set(0, 1.1, -10); break;
      case 'batsman': want.current.set(1.7, 2.0, -14); wantLook.current.set(0, 1.4, 9); break;
      case 'ball': {
        const s = engine.sim!.ball, sp = Math.hypot(s.vx, s.vz);
        if (sp > 1.5) lastDir.current.lerp(new THREE.Vector3(s.vx / sp, 0, s.vz / sp), 0.1).normalize();
        want.current.set(b.x - lastDir.current.x * 7, Math.max(2.2, b.y + 2.4), b.z - lastDir.current.z * 7); wantLook.current.set(b.x, Math.max(0.5, b.y), b.z); break;
      }
      case 'boundary': want.current.set(st.rx - 4, 6.5, 0); wantLook.current.set(0, 1, live ? b.z * 0.5 : 0); break;
    }
    const k = 1 - Math.exp(-dt * (m === 'ball' ? 6 : 2.6));
    camera.position.lerp(want.current, k); look.current.lerp(wantLook.current, 1 - Math.exp(-dt * 4)); camera.lookAt(look.current);
  });
  return <OrbitControls ref={ctrl} makeDefault enabled={mode === 'free'} enablePan enableZoom maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={220} />;
}
