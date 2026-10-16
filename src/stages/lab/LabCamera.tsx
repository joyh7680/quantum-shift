import { useLayoutEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { createCameraCollision } from "../../cameraCollision";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useGame } from "../../store";
import { useLabCamera } from "./cameraState";
import {
  POWER_RELEASE_END,
  POWER_STAND,
  powerActionElapsed,
} from "./powerAnimation";

export function LabCamera() {
  const { camera, scene } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const revision = useLabCamera((state) => state.revision);
  const focus = useRef(new Vector3());
  const shift = useRef(new Vector3());
  const direction = useRef(new Vector3());
  const cameraCollision = useRef(createCameraCollision());
  const breakerShot = useRef(false);
  const overviewOffset = useRef(new Vector3());
  const shotTarget = useRef(new Vector3());
  const shotPosition = useRef(new Vector3());
  const restoring = useRef(false);

  function followTarget() {
    const state = useGame.getState();
    const player = scene.getObjectByName("player-visual");
    if (player) {
      player.getWorldPosition(focus.current);
      focus.current.y += Math.max(0.6, state.size * 0.8);
      return focus.current;
    }
    return focus.current.set(
      state.pos[0],
      state.pos[1] + Math.max(0.6, state.size * 0.8),
      state.pos[2],
    );
  }

  useLayoutEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    breakerShot.current = false;
    restoring.current = false;
    orbit.enabled = true;
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
    const state = useGame.getState();
    const elapsed = powerActionElapsed(state.lab);
    const showBreaker =
      elapsed !== undefined && elapsed <= POWER_RELEASE_END + 0.25;
    if (showBreaker && !breakerShot.current) {
      overviewOffset.current.subVectors(camera.position, orbit.target);
      breakerShot.current = true;
      restoring.current = false;
      orbit.enabled = false;
      // Flush any orbit damping before the close-up starts.
      orbit.enableDamping = false;
      orbit.update();
    }
    if (showBreaker) {
      // A low side view keeps the head from hiding the hands and breaker.
      shotTarget.current.set(POWER_STAND[0], 0.8, POWER_STAND[2] + 0.35);
      shotPosition.current
        .copy(shotTarget.current)
        .add(new Vector3(2.8, 1.45, -2.1));
      const blend = 1 - Math.exp(-dt * 7);
      orbit.target.lerp(shotTarget.current, blend);
      camera.position.lerp(shotPosition.current, blend);
      orbit.update();
      return;
    }
    if (breakerShot.current) {
      breakerShot.current = false;
      restoring.current = true;
    }
    if (restoring.current) {
      const target = followTarget();
      shotPosition.current.copy(target).add(overviewOffset.current);
      const blend = 1 - Math.exp(-dt * 7);
      orbit.target.lerp(target, blend);
      camera.position.lerp(shotPosition.current, blend);
      orbit.update();
      if (camera.position.distanceTo(shotPosition.current) < 0.04) {
        restoring.current = false;
        orbit.enableDamping = true;
        orbit.enabled = true;
      }
      return;
    }
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
    const hit = cameraCollision.current(
      scene,
      orbit.target,
      direction.current,
      distance,
    );
    if (hit !== undefined)
      camera.position
        .copy(orbit.target)
        .addScaledVector(direction.current, Math.max(0.25, hit - 0.25));
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
