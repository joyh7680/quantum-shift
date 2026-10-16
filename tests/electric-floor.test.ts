import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useGame } from "../src/store.ts";
import { updateLab } from "../src/stages/lab/gameplay.ts";
import {
  crossesUnsafeElectricFloor,
  electricPhase,
  ELECTRIC_TILES,
} from "../src/stages/lab/electricFloor.ts";
import type { StageFrame, Vec } from "../src/stages/shared.ts";

const game = () => useGame.getState();
beforeEach(() => {
  useGame.setState(useGame.getInitialState(), true);
  game().start("alien");
});

test("electric knockback preserves every selected size and collected chip", () => {
  for (const size of [0.25, 1, 2.5] as const) {
    game().patch({ size });
    game().patchLab({ time: 4, chips: ["battery"] });
    const deaths = game().lab.deaths;
    const respawn = game().respawn;
    const frame: StageFrame = {
      pos: [8, 0, 0.5],
      size,
      dt: 1 / 60,
      runtime: { previous: size, clearTime: 0 },
      fits: () => true,
      changeSize: () => {
        throw Error("knockback must not change size");
      },
      die: (reason) => game().die(reason),
    };
    assert.equal(updateLab(frame), false);
    assert.equal(game().size, size);
    assert.equal(game().lab.deaths, deaths + 1);
    assert.equal(game().respawn, respawn + 1);
    assert.deepEqual(game().lab.checkpoint, [8, 0, -3]);
    assert.deepEqual(game().lab.chips, ["battery"]);
  }
});

test("every purple tile rejects walking, jumping and a full swept crossing", () => {
  for (const size of [0.25, 1, 2.5] as const)
    for (const z of ELECTRIC_TILES)
      for (const height of [0, 0.3, 1.2]) {
        const pos: Vec = [8, height, z];
        assert(crossesUnsafeElectricFloor(pos, pos, size, 4));
        assert(
          crossesUnsafeElectricFloor([8, height, -2], [8, height, 7], size, 4),
        );
        assert(
          crossesUnsafeElectricFloor([8, height, 7], [8, height, -2], size, 4),
        );
      }
});

test("mint and yellow tiles allow crossing for all sizes", () => {
  for (const size of [0.25, 1, 2.5] as const) {
    assert.equal(
      crossesUnsafeElectricFloor([8, 0, -2], [8, 1, 7], size, 0),
      false,
    );
    for (const [lane, z] of ELECTRIC_TILES.entries()) {
      const time = 2.7 - lane * 0.6;
      assert.equal(electricPhase(time, lane), "waiting");
      assert.equal(
        crossesUnsafeElectricFloor([8, 1, z], [8, 1, z], size, time),
        false,
      );
    }
  }
});

test("yellow allows standing and crossing in either direction at every size", () => {
  for (const size of [0.25, 1, 2.5] as const) {
    // The last tile is yellow; earlier tiles are mint, so no purple overlaps.
    assert.equal(electricPhase(1.5, 2), "waiting");
    for (const [from, to] of [
      [
        [8, 0, 4.5],
        [8, 0, 4.5],
      ],
      [
        [8, 0, 3.2],
        [8, 0, 6.5],
      ],
      [
        [8, 0, 6.5],
        [8, 0, 3.2],
      ],
    ] as [Vec, Vec][])
      assert.equal(crossesUnsafeElectricFloor(from, to, size, 1.5), false);
    const deaths = game().lab.deaths;
    const respawn = game().respawn;
    game().patch({ size });
    game().patchLab({ time: 1.5 });
    assert.notEqual(
      updateLab({
        pos: [8, 0, 4.5],
        size,
        dt: 1 / 60,
        runtime: { previous: size, clearTime: 0 },
        fits: () => true,
        changeSize: () => true,
        die: (reason) => game().die(reason),
      }),
      false,
    );
    assert.equal(game().lab.deaths, deaths);
    assert.equal(game().respawn, respawn);
    assert.equal(game().size, size);
    assert.deepEqual(game().lab.checkpoint, [8, 0, -3]);
  }
});

test("body edges trigger before the centre enters; adjacent gaps and workbench remain safe", () => {
  assert(crossesUnsafeElectricFloor([8, 0, -0.8], [8, 0, -0.8], 2.5, 4));
  assert(crossesUnsafeElectricFloor([6, 0, 0.5], [6, 0, 0.5], 1, 4));
  for (const pos of [
    [8, 0, -3],
    [8, 0, 8],
    [8, 0, 1.5],
    [0, 0, 0.5],
    [8, 8, 0.5],
  ] as Vec[])
    assert.equal(crossesUnsafeElectricFloor(pos, pos, 0.25, 4), false);
});

test("turning purple ejects an airborne player in the same simulation tick", () => {
  game().patch({ size: 2.5 });
  game().patchLab({ time: 3.39 });
  assert.equal(electricPhase(game().lab.time), "waiting");
  assert.equal(
    updateLab({
      pos: [8, 1, 0.5],
      size: 2.5,
      dt: 1 / 60,
      runtime: { previous: 2.5, clearTime: 0 },
      fits: () => true,
      changeSize: () => true,
      die: (reason) => game().die(reason),
    }),
    false,
  );
  assert.equal(electricPhase(game().lab.time), "live");
  assert.equal(game().lab.deaths, 1);
  assert.equal(game().size, 2.5);
});
