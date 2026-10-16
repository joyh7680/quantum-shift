import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import { Group } from "three";
import characters from "./characters.json";
import { animateCharacter, createCharacterRig } from "./characterAnimation";
import type { CharacterMotion } from "./characterAnimation";
export const CHARACTERS = characters;
export function Character({
  id,
  motion,
  preview = false,
}: {
  id: string;
  motion?: RefObject<CharacterMotion>;
  preview?: boolean;
}) {
  const asset = characters.find((c) => c.id === id);
  if (!asset)
    throw new Error("선택한 캐릭터를 에셋 목록에서 찾을 수 없습니다: " + id);
  const { scene } = useGLTF(asset.url);
  const animated = useRef<Group>(null);
  const rig = useMemo(() => createCharacterRig(scene, id), [scene, id]);
  useFrame((_, dt) => {
    if (!animated.current) return;
    const state = motion?.current ?? {
      speed: 0,
      airborne: false,
      paused: false,
    };
    animateCharacter(rig, state, dt);
    if (state.paused) return;
    animated.current.rotation.z = Math.sin(rig.phase) * rig.weight * 0.012;
    if (preview) animated.current.rotation.y += dt * 0.16;
  });
  return (
    <group ref={animated}>
      <primitive object={rig.model} />
    </group>
  );
}
