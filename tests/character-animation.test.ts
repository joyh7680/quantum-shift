import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Box3, Matrix4, Mesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  animateCharacter,
  createCharacterRig,
} from "../src/characterAnimation.ts";

const catalog = JSON.parse(fs.readFileSync("src/characters.json", "utf8"));
async function load(id: string) {
  const asset = catalog.find((a: { id: string }) => a.id === id);
  const bytes = fs.readFileSync(`public${asset.url}`);
  return (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    )
  ).scene;
}
const walk = { speed: 4, airborne: false, paused: false };
const close = (a: number, b: number) =>
  assert(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);

test("all 47 original characters retain every mesh and material when limbs are rigged", async () => {
  assert.equal(catalog.length, 47);
  for (const { id } of catalog) {
    const source = await load(id);
    source.updateMatrixWorld(true);
    const box = new Box3().setFromObject(source);
    const size = box.getSize(new Vector3()),
      center = box.getCenter(new Vector3());
    const scale = Math.min(1.5 / size.y, 1.05 / Math.max(size.x, size.z));
    const normalize = new Matrix4()
      .makeScale(scale, scale, scale)
      .multiply(
        new Matrix4().makeTranslation(-center.x, -box.min.y, -center.z),
      );
    const original: Mesh[] = [],
      copy: Mesh[] = [];
    source.traverse((o) => {
      if (o instanceof Mesh) original.push(o);
    });
    const rig = createCharacterRig(source, id);
    rig.model.updateMatrixWorld(true);
    rig.model.traverse((o) => {
      if (o instanceof Mesh) copy.push(o);
    });
    assert.equal(copy.length, original.length, id);
    for (const mesh of original) {
      const cloned = copy.find(
        (o) => o.geometry === mesh.geometry && o.material === mesh.material,
      );
      assert(cloned, `${id}: source mesh retained`);
      const expected = normalize.clone().multiply(mesh.matrixWorld);
      expected.elements.forEach((v, i) =>
        close(v, cloned.matrixWorld.elements[i]),
      );
    }
    for (const limb of rig.limbs)
      assert(limb.children.length > 0, `${id}: limb populated`);
    assert.equal(
      source.getObjectByName("left-leg"),
      undefined,
      "cached GLB stays unchanged",
    );
    animateCharacter(rig, walk, 1 / 60);
    assert(
      rig.limbs[0].rotation.x * rig.limbs[1].rotation.x < 0,
      `${id}: alternate legs`,
    );
    assert(
      rig.limbs[0].rotation.x * rig.limbs[2].rotation.x < 0,
      `${id}: opposing arm`,
    );
    rig.model.updateMatrixWorld(true);
    const feet = new Box3()
      .setFromObject(rig.limbs[0])
      .union(new Box3().setFromObject(rig.limbs[1]));
    close(feet.min.y, 0);
  }
});

test("walk settles at rest, suspends in air and freezes on pause without changing another instance", async () => {
  const source = await load("codmos_nova");
  const rig = createCharacterRig(source, "codmos_nova");
  const other = createCharacterRig(source, "codmos_nova");
  for (let i = 0; i < 15; i++) animateCharacter(rig, walk, 1 / 60);
  assert.equal(other.phase, 0);
  assert(other.limbs.every((limb) => limb.rotation.x === 0));
  const phase = rig.phase;
  const angles = rig.limbs.map((limb) => limb.rotation.x);
  animateCharacter(rig, { ...walk, paused: true }, 1);
  assert.equal(rig.phase, phase);
  assert.deepEqual(
    rig.limbs.map((limb) => limb.rotation.x),
    angles,
  );
  for (let i = 0; i < 60; i++)
    animateCharacter(rig, { ...walk, airborne: true }, 1 / 60);
  assert.equal(rig.phase, phase, "no stepping in midair");
  close(rig.limbs[2].rotation.x, -0.6);
  for (let i = 0; i < 120; i++)
    animateCharacter(rig, { ...walk, speed: 0 }, 1 / 60);
  assert.equal(rig.phase, phase, "no stepping when blocked or idle");
  for (const limb of rig.limbs) close(limb.rotation.x, 0);
});

test("stride phase follows distance independently of render frame rate", async () => {
  const source = await load("basic");
  const a = createCharacterRig(source, "basic"),
    b = createCharacterRig(source, "basic");
  for (let i = 0; i < 60; i++)
    animateCharacter(a, { ...walk, speed: 2 }, 1 / 60);
  for (let i = 0; i < 30; i++)
    animateCharacter(b, { ...walk, speed: 2 }, 1 / 30);
  close(a.phase, b.phase);
});

test("breaker push reaches with both arms, leans forward, freezes and returns to idle", async () => {
  for (const id of ["basic", "lucy", "codmos_nova"]) {
    const rig = createCharacterRig(await load(id), id);
    const idle = { speed: 0, airborne: false, paused: false };
    for (let i = 0; i < 90; i++)
      animateCharacter(rig, { ...idle, powerPush: i / 60 }, 1 / 60);
    assert(
      rig.limbs.slice(2).every((arm) => arm.rotation.x < -1.4),
      id,
    );
    assert(rig.model.rotation.x > 0.15, `${id}: leans into the push`);
    assert(rig.model.position.z > 0.08, `${id}: follows through`);
    rig.model.updateMatrixWorld(true);
    close(
      new Box3()
        .setFromObject(rig.limbs[0])
        .union(new Box3().setFromObject(rig.limbs[1])).min.y,
      0,
    );
    const angle = rig.limbs[2].rotation.x;
    animateCharacter(rig, { ...idle, powerPush: 2, paused: true }, 1);
    close(rig.limbs[2].rotation.x, angle);
    for (let i = 0; i < 120; i++) animateCharacter(rig, idle, 1 / 60);
    for (const limb of rig.limbs) {
      close(limb.rotation.x, 0);
      close(limb.rotation.z, 0);
    }
    close(rig.model.rotation.x, 0);
    close(rig.model.position.z, 0);
  }
});
