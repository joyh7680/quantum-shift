import test from "node:test";
import assert from "node:assert/strict";
import { useGame } from "../src/store.ts";
import {
  editCode,
  resetPuzzle,
  startProgram,
  tickProgram,
} from "../src/stages/lab/gameplay.ts";
import { labObjectiveStep } from "../src/stages/lab/objective.ts";

test("objective follows collection, assembly and failed attempts without changing gameplay", () => {
  useGame.setState(useGame.getInitialState(), true);
  useGame.getState().start("alien");
  const step = () => labObjectiveStep(useGame.getState().lab);
  assert.equal(step(), 0);
  // Early console editing must not skip the collection objective.
  editCode(["giant", "battery", "power", "vent"]);
  assert.equal(step(), 0);
  useGame.getState().patchLab({ chips: ["power", "vent"] });
  assert.equal(step(), 0);
  editCode([]);
  useGame
    .getState()
    .patchLab({ chips: ["power", "vent", "battery"], mission: 1 });
  assert.equal(step(), 1);
  editCode(["tiny", "battery", "power"]);
  assert.equal(step(), 1);
  // Assembly is separate from correctness; a wrong order can still be run.
  editCode(["power", "battery", "vent"]);
  assert.equal(step(), 2);
  assert.equal(
    useGame.getState().lab.mission,
    1,
    "UI does not write mission state",
  );
  editCode(["power"]);
  assert.equal(step(), 1, "incomplete unexecuted draft returns to assembly");
  startProgram();
  assert.equal(step(), 2);
  tickProgram({
    pos: [0, 0.03, 13],
    size: 1,
    dt: 1 / 60,
    runtime: { previous: 1, clearTime: 0 },
    fits: () => true,
    changeSize: () => true,
    die: () => {},
    moveTo: () => true,
  });
  assert.equal(useGame.getState().lab.run, "failed");
  assert.equal(step(), 2);
  editCode([]);
  resetPuzzle("", true);
  assert.equal(step(), 2, "retry and exploration keep execution objective");
  assert.equal(useGame.getState().lab.chips.length, 3);
  useGame.getState().start("alien");
  assert.equal(step(), 0, "stage restart resets the objective");
});
