import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MatchEngine } from '../../game/matchEngine';
import { KITS } from '../../data/teams';
import { applyPose, buildRig, computePose, Rig } from './playerRig';

/** Renders all 22 players from the engine's entity state every frame (no React state per frame). */
export function Players({ engine }: { engine: MatchEngine }) {
  const group = useRef<THREE.Group>(null);
  const rigs = useMemo(() => {
    const m = new Map<string, Rig>(); let i = 0;
    for (const e of engine.entities.values()) { const r = buildRig(KITS[e.side], engine.players.get(e.id)!.skin, e.hand === 'L', i++); m.set(e.id, r); }
    return m;
  }, [engine]);
  const rings = useMemo(() => {
    const mk = (c: string) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 24), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; return m; };
    return { striker: mk('#f2c14e'), bowler: mk('#ffffff') };
  }, []);
  useEffect(() => {
    const g = group.current!; rigs.forEach((r) => g.add(r.root)); g.add(rings.striker, rings.bowler);
    return () => { rigs.forEach((r) => g.remove(r.root)); g.remove(rings.striker, rings.bowler); };
  }, [rigs, rings]);
  const t = useRef(0);
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05); t.current += dt;
    const inn = engine.inn, keeper = engine.keeperId, bowler = inn.bowlerId ?? inn.lastBowlerId;
    for (const e of engine.entities.values()) {
      const r = rigs.get(e.id)!;
      const batting = e.id === inn.strikerId || e.id === inn.nonStrikerId;
      const fieldingSide = engine.sideOf(inn.bowlingTeamId) === e.side;
      const isKeeper = fieldingSide && e.id === keeper;
      r.root.position.set(e.x, 0, e.z); r.root.rotation.y = e.heading;
      r.bat.visible = batting && e.action !== 'sit'; r.helmet.visible = batting || isKeeper; r.cap.visible = !batting && !isKeeper;
      r.padL.visible = r.padR.visible = batting || isKeeper; r.gloves.forEach((g) => (g.visible = batting || isKeeper));
      applyPose(r, computePose(e, r, t.current, dt), dt);
    }
    const s = engine.entities.get(inn.strikerId)!, b = bowler ? engine.entities.get(bowler)! : null;
    rings.striker.position.set(s.x, 0.04, s.z); rings.bowler.visible = !!b && engine.phase !== 'inningsBreak'; if (b) rings.bowler.position.set(b.x, 0.04, b.z);
  });
  return <group ref={group} />;
}
