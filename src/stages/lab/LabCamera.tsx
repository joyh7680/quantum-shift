import { useLayoutEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useGame } from "../../store";
import { useLabCamera } from "./cameraState";

export function LabCamera() {
  const { camera, scene } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const revision = useLabCamera((state) => state.revision);
  const focus = useRef(new Vector3());
  const shift = useRef(new Vector3());
  const direction = useRef(new Vector3());
  const ray = useRef(new Raycaster());

  function followTarget() {
    const state = useGame.getState();
    return focus.current.set(
      state.pos[0],
      state.pos[1] + Math.max(0.6, state.size * 0.8),
      state.pos[2],
    );
  }

  useLayoutEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    orbit.enableDamping = false;
    orbit.update();
    const target = followTarget();
    orbit.target.copy(target);
    camera.position.copy(target).add(new Vector3(1, 16, -10));
    // Clear residual damping as well as restoring the overview.
    orbit.saveState();
    orbit.reset();
    orbit.enableDamping = true;
  }, [camera, revision]);

  useFrame((_, dt) => {
    const orbit = controls.current;
    if (!orbit) return;
    // Move the orbit centre with the character without overwriting the angle
    // or zoom selected by the student.
    shift.current
      .subVectors(followTarget(), orbit.target)
      .multiplyScalar(1 - Math.exp(-dt * 6));
    orbit.target.add(shift.current);
    camera.position.add(shift.current);

    direction.current.subVectors(camera.position, orbit.target);
    const distance = direction.current.length();
    if (!distance) return;
    direction.current.divideScalar(distance);
    ray.current.set(orbit.target, direction.current);
    ray.current.far = distance;
    const hit = ray.current
      .intersectObjects(scene.children, true)
      .find(
        (entry) => entry.object.userData.cameraSolid && entry.distance > 0.1,
      );
    if (hit)
      camera.position
        .copy(orbit.target)
        .addScaledVector(
          direction.current,
          Math.max(0.25, hit.distance - 0.25),
        );
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.65}
      zoomSpeed={0.8}
      minDistance={3}
      maxDistance={28}
      minPolarAngle={0.2}
      maxPolarAngle={1.25}
    />
  );
}
