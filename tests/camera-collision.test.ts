import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { createCameraCollision } from "../src/cameraCollision.ts";

test("camera tests only solid meshes and sees gates added or removed at runtime", () => {
  const scene = new Group();
  const decoration = new Mesh();
  decoration.raycast = () =>
    assert.fail("decorations must not run triangle tests");
  scene.add(decoration);
  const gate = new Mesh(new BoxGeometry(2, 2, 1), new MeshBasicMaterial());
  gate.position.z = 5;
  gate.userData.cameraSolid = true;
  scene.add(gate);
  scene.updateMatrixWorld(true);
  const collision = createCameraCollision();
  const origin = new Vector3(),
    direction = new Vector3(0, 0, 1);
  assert.equal(collision(scene, origin, direction, 10), 4.5);
  assert.equal(collision(scene, origin, direction, 4), undefined);
  scene.remove(gate);
  assert.equal(collision(scene, origin, direction, 10), undefined);
  scene.add(gate);
  assert.equal(collision(scene, origin, direction, 10), 4.5);
  gate.geometry.dispose();
  (gate.material as MeshBasicMaterial).dispose();
});
