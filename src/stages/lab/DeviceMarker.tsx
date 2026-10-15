import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, EdgesGeometry, Group } from "three";
import type { Chip } from "./state";
import type { Vec } from "../shared";

export function DeviceMarker({
  device,
  position,
  size,
}: {
  device: Chip;
  position: Vec;
  size: Vec;
}) {
  const pulse = useRef<Group>(null);
  const [x, y, z] = size;
  const edges = useMemo(() => {
    const box = new BoxGeometry(x, y, z);
    const geometry = new EdgesGeometry(box);
    box.dispose();
    return geometry;
  }, [x, y, z]);
  useEffect(() => () => edges.dispose(), [edges]);
  useFrame(({ clock }) =>
    pulse.current?.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3) * 0.025),
  );
  return (
    <group
      position={position}
      ref={pulse}
      userData={{ deviceGuideTarget: device }}
    >
      <lineSegments geometry={edges} renderOrder={20}>
        <lineBasicMaterial
          color="#a2f4ff"
          transparent
          opacity={0.95}
          depthTest={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}
