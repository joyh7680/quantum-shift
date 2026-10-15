import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Box3, Group, Mesh, Vector3 } from "three";
import characters from "./characters.json";
export const CHARACTERS = characters;
export function Character({
  id,
  moving = false,
  airborne = false,
  preview = false,
}: {
  id: string;
  moving?: boolean;
  airborne?: boolean;
  preview?: boolean;
}) {
  const asset = characters.find((c) => c.id === id);
  if (!asset)
    throw new Error("선택한 캐릭터를 에셋 목록에서 찾을 수 없습니다: " + id);
  const { scene } = useGLTF(asset.url);
  const animated = useRef<Group>(null);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateMatrixWorld(true);
    const box = new Box3().setFromObject(clone),
      dims = box.getSize(new Vector3()),
      center = box.getCenter(new Vector3());
    const scale = Math.min(1.5 / dims.y, 1.05 / Math.max(dims.x, dims.z));
    const wrapper = new Group();
    clone.position.sub(new Vector3(center.x, box.min.y, center.z));
    wrapper.add(clone);
    wrapper.scale.setScalar(scale);
    clone.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return wrapper;
  }, [scene]);
  useFrame(({ clock }, dt) => {
    if (!animated.current) return;
    const t = clock.elapsedTime;
    animated.current.position.y = airborne
      ? 0.045
      : moving
        ? Math.abs(Math.sin(t * 12)) * 0.065
        : Math.sin(t * 2) * 0.012;
    animated.current.rotation.z = moving ? Math.sin(t * 12) * 0.045 : 0;
    animated.current.rotation.x = airborne ? -0.13 : moving ? 0.06 : 0;
    if (preview) animated.current.rotation.y += dt * 0.16;
  });
  return (
    <group ref={animated}>
      <primitive object={model} />
    </group>
  );
}
