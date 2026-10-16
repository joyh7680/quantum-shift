import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useGame } from "../src/store.ts";
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
  assert.equal(tickLabTutorial(t, 1, [-4, 0, 18]), t);
  assert.equal(tickLabTutorial(t, 1, [-8, 0, 7]), t);
  assert.equal(tickLabTutorial(t, 1, [-8, 2.6, 4]), t);
  t = tickLabTutorial(t, 1 / 60, [-8, 2.6, 5]);
  assert.equal(t.phase, "success");
  t = tickLabTutorial(t, 1.5, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.phase, "complete");
  t = tickLabTutorial(t, 4.49, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.phase, "complete");
  t = tickLabTutorial(t, 0.02, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.phase, "leaving");
  t = tickLabTutorial(t, 0.35, TUTORIAL_BATTERY_POSITION);
  assert.equal(t.phase, "done");
  assert.equal(tickLabTutorial(t, 60, TUTORIAL_BATTERY_POSITION), t);
});

test("a battery collected before step 3 still completes the tutorial", () => {
  const t = {
    ...createLabTutorial(),
    step: 3 as const,
    phase: "active" as const,
  };
  assert.equal(tickLabTutorial(t, 1 / 60, [0, 0, -2], true).phase, "success");
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
  assert.deepEqual(game().labTutorial, createLabTutorial());
  game().reset();
  game().start("codmos_nova", 1);
  const t = game().labTutorial;
  game().patchLab({ cleared: true });
  game().start("codmos_nova", 2);
  assert.equal(game().labTutorial, t);
});
