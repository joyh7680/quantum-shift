import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useGame } from "../src/store.ts";
import { updateLab } from "../src/stages/lab/gameplay.ts";
import {
  TUTORIAL_BATTERY_POSITION,
  createLabTutorial,
  tickLabTutorial,
  tutorialMovement,
  tutorialSizeChanged,
} from "../src/stages/lab/tutorialState.ts";

beforeEach(() => useGame.setState(useGame.getInitialState(), true));
const game = () => useGame.getState();

test("tutorial progresses in order with actual movement and a 1.5 second success hold", () => {
  game().start("codmos_nova");
  let t = game().labTutorial;
  assert.equal(t.phase, "active");
  assert.equal(tutorialSizeChanged(t), t);
  assert.equal(tutorialMovement(t, 0), t);
  t = tutorialMovement(t, 0.1);
  assert.equal(t.phase, "active");
  t = tutorialMovement(t, 0.16);
  assert.equal(t.phase, "success");
  t = tickLabTutorial(t, 1.49, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.step, 1);
  t = tickLabTutorial(t, 0.02, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.step, 2);
  assert.equal(t.phase, "active");
  assert.equal(tickLabTutorial(t, 10, TUTORIAL_BATTERY_POSITION), t);
  t = tutorialSizeChanged(t);
  assert.equal(t.phase, "success");
  t = tickLabTutorial(t, 1.5, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.step, 3);
  assert.equal(t.phase, "active");
  assert.equal(tutorialSizeChanged(t), t);
  assert.equal(tutorialMovement(t, 10), t);
});

test("battery arrival targets the stair collectible, rejecting the heavy device and ground below", () => {
  let t = {
    ...createLabTutorial(),
    step: 3 as const,
    phase: "active" as const,
  } as ReturnType<typeof createLabTutorial>;
  assert.equal(tickLabTutorial(t, 1, [-4, 0, 18], 2.5), t);
  assert.equal(tickLabTutorial(t, 1, [-8, 0, 7], 2.5), t);
  assert.equal(tickLabTutorial(t, 1, [-8, 2.6, 4], 2.5), t);
  for (const size of [0.25, 1] as const)
    assert.equal(tickLabTutorial(t, 1, TUTORIAL_BATTERY_POSITION, size), t);
  t = tickLabTutorial(t, 1 / 60, [-8, 2.6, 5], 2.5);
  assert.equal(t.phase, "complete");
  t = tickLabTutorial(t, 1.99, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.phase, "complete");
  t = tickLabTutorial(t, 0.02, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.phase, "handoff");
  t = tickLabTutorial(t, 2.99, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.phase, "handoff");
  t = tickLabTutorial(t, 0.02, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.phase, "leaving");
  t = tickLabTutorial(t, 0.35, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.phase, "done");
  assert.equal(tickLabTutorial(t, 60, TUTORIAL_BATTERY_POSITION), t);
});

test("giant arrival completes the real collection task once and preserves later missions", () => {
  game().start("codmos_nova");
  game().patch({
    labTutorial: { ...createLabTutorial(), step: 3, phase: "active" },
  });
  // Tutorial arrival has a wider guidance radius than normal pickup.
  game().advanceLabTutorial(1 / 60, [-8, 2.6, 5], 2.5);
  assert.equal(game().labTutorial.phase, "complete");
  assert.deepEqual(game().lab.chips, ["battery"]);
  assert.equal(game().lab.mission, 0); // Still collect power and vent.
  assert.equal(game().lab.battery, "floor"); // Runtime device is unchanged.
  const collectedAt = game().lab.collectedAt;
  const toastId = game().toastId;
  game().advanceLabTutorial(2, TUTORIAL_BATTERY_POSITION, 2.5);
  updateLab({
    pos: [-8, 2.8, 7],
    size: 2.5,
    dt: 1 / 60,
    runtime: { previous: 1, clearTime: 0 },
    fits: () => true,
    changeSize: () => true,
    die: () => assert.fail("unexpected death"),
  });
  assert.deepEqual(game().lab.chips, ["battery"]);
  assert.equal(game().lab.collectedAt, collectedAt);
  assert.equal(game().toastId, toastId);
  game().die("test");
  assert.deepEqual(game().lab.chips, ["battery"]);
});

test("a battery collected during an earlier step completes the task without a repeat visit", () => {
  game().start("codmos_nova");
  game().patchLab({ chips: ["battery", "power"], collectedAt: 123 });
  const t = {
    ...createLabTutorial(),
    step: 3 as const,
    phase: "active" as const,
  };
  game().patch({ labTutorial: t });
  game().advanceLabTutorial(1 / 60, [0, 0, -2], 1);
  assert.equal(game().labTutorial.phase, "complete");
  assert.deepEqual(game().lab.chips, ["battery", "power"]);
  assert.equal(game().lab.collectedAt, 123);
});

test("tutorial arrival of the last block preserves the existing console mission", () => {
  game().start("codmos_nova");
  game().patchLab({ chips: ["power", "vent"] });
  game().patch({
    labTutorial: { ...createLabTutorial(), step: 3, phase: "active" },
  });
  game().advanceLabTutorial(1 / 60, TUTORIAL_BATTERY_POSITION, 2.5);
  assert.deepEqual(game().lab.chips, ["power", "vent", "battery"]);
  assert.equal(game().lab.mission, 1);
});

test("skipping keeps normal collection available and pause freezes the handoff", () => {
  game().start("codmos_nova");
  game().patch({ labTutorial: { ...game().labTutorial, phase: "done" } });
  game().advanceLabTutorial(10, TUTORIAL_BATTERY_POSITION, 2.5);
  assert.deepEqual(game().lab.chips, []);
  updateLab({
    pos: [-8, 2.8, 7],
    size: 2.5,
    dt: 1 / 60,
    runtime: { previous: 1, clearTime: 0 },
    fits: () => true,
    changeSize: () => true,
    die: () => assert.fail("unexpected death"),
  });
  assert.deepEqual(game().lab.chips, ["battery"]);
  const labTutorial = { ...game().labTutorial, phase: "handoff" as const };
  game().patch({ labTutorial, panel: "pause" });
  game().advanceLabTutorial(10, TUTORIAL_BATTERY_POSITION, 2.5);
  assert.equal(game().labTutorial, labTutorial);
});

test("completed or skipped tutorial stays dismissed across death, menu return and stage replay", () => {
  game().start("codmos_nova");
  game().patch({ labTutorial: { ...game().labTutorial, phase: "done" } });
  game().die("test");
  game().reset();
  game().start("codmos_nova");
  assert.equal(game().labTutorial.phase, "done");
  game().patch({
    labTutorial: { ...game().labTutorial, step: 3, phase: "complete" },
  });
  game().reset();
  game().start("codmos_nova");
  assert.equal(game().labTutorial.phase, "done");
});

test("Stage 2 never starts the tutorial or changes its progress", () => {
  game().patchLab({ cleared: true });
  game().start("codmos_nova", 2);
  game().advanceLabTutorial(10, TUTORIAL_BATTERY_POSITION, 2.5);
  assert.deepEqual(game().labTutorial, createLabTutorial());
  game().reset();
  game().start("codmos_nova", 1);
  const t = game().labTutorial;
  game().patchLab({ cleared: true });
  game().start("codmos_nova", 2);
  assert.equal(game().labTutorial, t);
});
