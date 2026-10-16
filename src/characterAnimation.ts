import { Box3, Group, MathUtils, Matrix4, Mesh, Vector3 } from "three";
import { powerPushPose } from "./stages/lab/powerAnimation.ts";

export type CharacterMotion = {
  /** Ground speed in character-size units per second, after collisions. */
  speed: number;
  airborne: boolean;
  paused: boolean;
  /** Seconds since reaching the Stage 1 breaker; absent outside that action. */
  powerPush?: number;
};

// The catalog shares one body layout, except these two older exports where
// trousers, shoes and decorations are separate siblings. Keep each leg intact.
const layouts: Record<string, number[][]> = {
  basic: [[6, 7, 8], [9, 10, 11], [4], [5]],
  lucy: [[7, 8, 9, 10, 11], [12, 13, 14, 15, 16], [17], [18]],
};

export function createCharacterRig(scene: Group, id: string) {
  // Only transforms are animated; geometry and original materials stay shared.
  const clone = scene.clone(true);
  clone.updateMatrixWorld(true);
  const box = new Box3().setFromObject(clone);
  const dims = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const model = new Group();
  model.name = "character-model";
  clone.position.sub(new Vector3(center.x, box.min.y, center.z));
  model.add(clone);
  model.scale.setScalar(
    Math.min(1.5 / dims.y, 1.05 / Math.max(dims.x, dims.z)),
  );
  model.updateMatrixWorld(true);
  const root = clone.children[0];
  const parts = [...root.children];
  const layout = layouts[id] ?? [[2], [4], [3], [5]];
  const names = ["left-leg", "right-leg", "left-arm", "right-arm"];
  const footBounds: Vector3[][] = [];
  const limbs = layout.map((indices, index) => {
    const bounds = new Box3();
    for (const i of indices) bounds.union(new Box3().setFromObject(parts[i]));
    const pivot = new Group();
    pivot.name = names[index];
    const top = bounds.getCenter(new Vector3());
    top.y = bounds.max.y;
    // The hip/shoulder is over the ankle, rather than over the protruding toe.
    top.z = root.getWorldPosition(new Vector3()).z;
    pivot.position.copy(root.worldToLocal(top));
    root.add(pivot);
    pivot.updateMatrixWorld(true);
    for (const i of indices) pivot.attach(parts[i]);
    if (index < 2) {
      const corners: Vector3[] = [];
      pivot.updateMatrixWorld(true);
      pivot.traverse((part) => {
        if (!(part instanceof Mesh)) return;
        part.geometry.computeBoundingBox();
        const bounds = part.geometry.boundingBox!;
        for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z])
              corners.push(
                pivot.worldToLocal(part.localToWorld(new Vector3(x, y, z))),
              );
      });
      footBounds.push(corners);
    }
    return pivot;
  });
  model.updateMatrixWorld(true);
  const rootToModel = new Matrix4()
    .copy(model.matrixWorld)
    .invert()
    .multiply(root.matrixWorld);
  clone.traverse((o) => {
    if (o instanceof Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return {
    model,
    limbs,
    footBounds,
    rootToModel,
    phase: 0,
    weight: 0,
    point: new Vector3(),
  };
}

export function animateCharacter(
  rig: ReturnType<typeof createCharacterRig>,
  motion: CharacterMotion,
  delta: number,
) {
  if (motion.paused) return;
  const dt = Math.min(delta, 0.25);
  const walking = !motion.airborne && motion.speed > 0.05;
  rig.weight = MathUtils.damp(rig.weight, walking ? 1 : 0, 18, dt);
  // Advance by distance, so shrinking, giant steps and blocked movement do not
  // all play the same clock-driven walk. Limit the tiny character's cadence.
  if (walking)
    rig.phase =
      (rig.phase + Math.min(motion.speed / 1.3, 4) * dt * Math.PI * 2) %
      (Math.PI * 2);
  const settle = 1 - Math.exp(-dt * 22);
  const pushing =
    motion.powerPush === undefined
      ? undefined
      : powerPushPose(motion.powerPush);
  rig.limbs.forEach((limb, index) => {
    const side = index % 2 === 0 ? 1 : -1;
    const swing = Math.sin(rig.phase) * side * rig.weight;
    let target = motion.airborne
      ? index < 2
        ? side * 0.28
        : -0.6
      : swing * (index < 2 ? 0.72 : -0.48);
    if (pushing) {
      const pose = index < 2 ? side * 0.12 : -1.3 - pushing.push * 0.3;
      target = MathUtils.lerp(target, pose, pushing.reach);
    }
    limb.rotation.x = MathUtils.lerp(limb.rotation.x, target, settle);
    limb.rotation.z = MathUtils.lerp(
      limb.rotation.z,
      index >= 2 && pushing ? side * 0.16 * pushing.reach : 0,
      settle,
    );
  });
  rig.model.rotation.x = MathUtils.lerp(
    rig.model.rotation.x,
    pushing ? (0.08 + pushing.push * 0.12) * pushing.reach : 0,
    settle,
  );
  rig.model.position.z = MathUtils.lerp(
    rig.model.position.z,
    pushing ? pushing.push * pushing.reach * 0.12 : 0,
    settle,
  );
  // Keep the supporting shoe on the floor instead of bouncing the whole model.
  // Cached box corners avoid recomputing mesh bounds in every rendered frame.
  let lowest = Infinity;
  for (let i = 0; i < 2; i++) {
    const leg = rig.limbs[i];
    leg.updateMatrix();
    for (const corner of rig.footBounds[i]) {
      rig.point
        .copy(corner)
        .applyMatrix4(leg.matrix)
        .applyMatrix4(rig.rootToModel)
        .applyEuler(rig.model.rotation);
      lowest = Math.min(lowest, rig.point.y);
    }
  }
  rig.model.position.y = motion.airborne ? 0.045 : -lowest * rig.model.scale.y;
}
