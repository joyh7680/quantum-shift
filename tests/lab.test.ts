import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useGame } from "../src/store.ts";
import {
  commandFailure,
  editCode,
  labPrompt,
  resetPuzzle,
  startProgram,
  tickProgram,
  updateLab,
} from "../src/stages/lab/gameplay.ts";
import type { Command } from "../src/stages/lab/state.ts";
import type { Vec } from "../src/stages/shared.ts";
import {
  POWER_FAN_STOP,
  POWER_PUSH_END,
  POWER_STAND,
  powerActionElapsed,
  powerPushPose,
} from "../src/stages/lab/powerAnimation.ts";
const game = () => useGame.getState();
beforeEach(() => {
  useGame.setState(useGame.getInitialState(), true);
  game().start("alien");
});
const actionFrame = () => ({
  pos: game().pos,
  size: game().size,
  dt: 1 / 60,
  runtime: { previous: 1 as const, clearTime: 0 },
  fits: () => true,
  changeSize: (size: 0.25 | 1 | 2.5) => {
    game().patch({ size });
    return true;
  },
  die: (reason: string) => game().die(reason),
  moveTo: (pos: Vec) => {
    game().patch({ pos });
    return true;
  },
});
const execute = (code: Command[]) => {
  game().patchLab({ chips: ["battery", "power", "vent"], code });
  startProgram();
  for (let i = 0; i < 2000 && game().lab.run === "running"; i++)
    tickProgram(actionFrame());
};
test("conditions reject the failing action and do not reveal a next command", () => {
  for (const [command, size, message] of [
    ["battery", 1, "배터리가 너무 무거워요."],
    ["power", 1, "배터리가 연결되지 않았어요."],
    ["vent", 0.25, "팬이 돌아가고 있어 통과할 수 없어요."],
  ] as const)
    assert.equal(commandFailure(command, size, game().lab), message);
  assert.match(
    commandFailure("power", 2.5, {
      battery: "installed",
      power: false,
      fan: 1,
    }),
    /손이 너무 커/,
  );
  assert.match(
    commandFailure("power", 0.25, {
      battery: "installed",
      power: false,
      fan: 1,
    }),
    /손이 닿지/,
  );
  assert.match(
    commandFailure("vent", 1, { battery: "installed", power: true, fan: 0 }),
    /입구가 좁아/,
  );
  execute(["tiny", "power", "giant"]);
  assert.equal(game().lab.run, "failed");
  assert.equal(game().lab.index, 1);
  assert.equal(game().size, 0.25);
});
test("extra and repeated blocks succeed by device state, not exact sequence", () => {
  execute([
    "tiny",
    "normal",
    "giant",
    "battery",
    "battery",
    "normal",
    "power",
    "power",
    "tiny",
    "vent",
  ]);
  assert.equal(game().screen, "clear");
  assert.equal(game().lab.run, "success");
  assert.equal(game().lab.fan, 0);
  assert(game().pos[2] > 28);
  assert.equal(game().character, "alien");
});

test("power cuts only after the breaker push, then waits for the fan to stop", () => {
  game().patchLab({
    code: ["power", "tiny", "vent"],
    run: "running",
    index: 0,
    battery: "installed",
  });
  assert.equal(
    powerActionElapsed(game().lab),
    undefined,
    "no pushing on approach",
  );
  for (let i = 0; i < 3; i++) tickProgram(actionFrame());
  assert.deepEqual(game().pos, POWER_STAND);
  assert.equal(powerActionElapsed(game().lab), 0);
  while (game().lab.elapsed < POWER_PUSH_END - 1 / 60)
    tickProgram(actionFrame());
  assert.equal(game().lab.power, false);
  assert.equal(game().lab.fan, 1);
  assert(powerPushPose(game().lab.elapsed).push > 0.99);
  tickProgram(actionFrame());
  tickProgram(actionFrame());
  assert.equal(game().lab.power, true);
  assert(game().lab.fan > 0);
  while (game().lab.index === 0) tickProgram(actionFrame());
  assert.equal(game().lab.fan, 0);
  assert.equal(powerActionElapsed(game().lab), undefined);
  assert.equal(
    powerPushPose(POWER_FAN_STOP).reach,
    0,
    "arms released before next block",
  );
});
test("stop and exploration reset devices but retain inventory and code", () => {
  const code: Command[] = ["giant", "battery"];
  execute(code);
  assert.equal(game().lab.run, "failed");
  assert.equal(game().lab.battery, "installed");
  resetPuzzle("중단", true);
  assert.deepEqual(game().lab.code, code);
  assert.equal(game().lab.chips.length, 3);
  assert.equal(game().lab.battery, "floor");
  assert.equal(game().lab.power, false);
  assert.equal(game().lab.fan, 1);
  assert.equal(game().size, 1);
  assert.equal(game().panel, null);
  assert.deepEqual(game().pos, [0, 0.03, 13]);
});
test("execution requires all chips, rejects code changes while running, and cannot clear by power alone", () => {
  editCode(["giant"]);
  startProgram();
  assert.equal(game().lab.run, "idle");
  game().patchLab({ chips: ["battery", "power", "vent"] });
  startProgram();
  editCode(["vent"]);
  assert.deepEqual(game().lab.code, ["giant"]);
  game().patchLab({ power: true });
  game().completeLab();
  assert.equal(game().screen, "game");
});
test("chips unlock only commands, persist on death, and can be collected in any order", () => {
  const base = actionFrame();
  for (const [id, pos, size] of [
    ["power", [8, 0, 8], 1],
    ["vent", [-8, 0, 22], 0.25],
    ["battery", [-8, 2.8, 7], 2.5],
  ] as const) {
    updateLab({ ...base, pos: [...pos], size });
    assert(game().lab.chips.includes(id));
    assert.equal(game().lab.battery, "floor");
    assert.equal(game().lab.power, false);
  }
  game().die("test");
  assert.equal(game().lab.chips.length, 3);
  assert.equal(game().lab.code.length, 0);
});

test("vent guidance appears near the low passage sign instead of the chip", () => {
  const message = "아래 통로에 뭔가가 있는 것 같다!";
  assert.equal(labPrompt([-8, 0, 11.5]), message);
  assert.equal(labPrompt([-6, 0, 13]), message);
  assert.equal(labPrompt([-8, 0, 10]), "");
  assert.equal(labPrompt([-8, 0, 18]), "");
  assert.equal(labPrompt([-8, 0, 22]), "");
  assert.equal(
    labPrompt([-8, 0, 7]),
    "ϟ 배터리 연결 블록 · 책과 연필 발판 위 · 3번 거대 크기로 획득",
  );

  const frame = {
    ...actionFrame(),
    pos: [-8, 0, 13] as Vec,
    size: 0.25 as const,
  };
  updateLab(frame);
  assert.deepEqual(game().lab.chips, []);
  updateLab({ ...frame, pos: [-8, 0, 22] });
  assert.deepEqual(game().lab.chips, ["vent"]);
  assert.equal(labPrompt([-8, 0, 13]), "");
});

test("power guidance appears near the emergency sign and disappears after collection", () => {
  const message = "바닥 건너편에 뭔가가 있는 것 같다!";
  // Show the sign guidance on approach, before a giant enters the corridor.
  assert.equal(labPrompt([8, 0, -6.5]), message);
  assert.equal(labPrompt([8, 0, -5.5]), message);
  assert.equal(labPrompt([6.5, 0, -5.5]), message);
  assert.equal(labPrompt([8, 0, -4.5]), message);
  assert.equal(labPrompt([6, 0, -2]), message);
  assert.equal(labPrompt([8, 0, 0.5]), message);
  assert.equal(labPrompt([8, 0, -7]), "");
  assert.equal(labPrompt([8, 0, 3]), "");
  assert.equal(labPrompt([8, 0, 8]), "");

  const frame = { ...actionFrame(), pos: [8, 0, -2] as Vec, size: 1 as const };
  updateLab(frame);
  assert.deepEqual(game().lab.chips, []);
  updateLab({ ...frame, pos: [8, 0, 8] });
  assert.deepEqual(game().lab.chips, ["power"]);
  assert.equal(labPrompt([8, 0, -2]), "");
});

test("the stair battery awards its block only at giant size", () => {
  const base = actionFrame();
  for (const size of [0.25, 1] as const) {
    // Include positions that met the old centre-based pickup condition.
    for (const foot of [3.5 - 0.75 * size, 2.8])
      updateLab({ ...base, pos: [-8, foot, 7], size });
    assert.deepEqual(game().lab.chips, []);
    assert.equal(game().lab.collectedAt, 0);
    assert.equal(game().lab.mission, 0);
    assert.equal(game().toast, "");
  }
  updateLab({ ...base, pos: [-8, 2.8, 10], size: 2.5 });
  updateLab({ ...base, pos: [-8, 5, 7], size: 2.5 });
  assert.deepEqual(game().lab.chips, []);
  updateLab({ ...base, pos: [-8, 2.8, 7], size: 2.5 });
  assert.deepEqual(game().lab.chips, ["battery"]);
  assert.match(game().toast, /명령 블록 획득! 배터리 연결/);
  const collectedAt = game().lab.collectedAt;
  updateLab({ ...base, pos: [-8, 2.8, 7], size: 2.5 });
  assert.deepEqual(game().lab.chips, ["battery"]);
  assert.equal(game().lab.collectedAt, collectedAt);
});

test("the power item awards its block only at normal size", () => {
  game().patchLab({ chips: ["battery", "vent"] });
  const base = actionFrame();
  for (const size of [0.25, 2.5] as const) {
    // Align the character centre with the item to isolate the size restriction
    // from the existing distance and height requirements.
    for (const foot of [0, 0.7 - 0.75 * size])
      updateLab({ ...base, pos: [8, foot, 8], size });
    assert.deepEqual(game().lab.chips, ["battery", "vent"]);
    assert.equal(game().lab.collectedAt, 0);
    assert.equal(game().lab.mission, 0);
    assert.equal(game().toast, "");
  }
  updateLab({ ...base, pos: [8, 0, 6], size: 1 });
  assert.deepEqual(game().lab.chips, ["battery", "vent"]);
  updateLab({ ...base, pos: [8, 0, 8], size: 1 });
  assert.deepEqual(game().lab.chips, ["battery", "vent", "power"]);
  assert.equal(game().lab.mission, 1);
  assert.equal(game().lab.power, false);
  assert.match(game().toast, /명령 블록 획득! 전원 차단/);
  const collectedAt = game().lab.collectedAt;
  updateLab({ ...base, pos: [8, 0, 8], size: 1 });
  assert.deepEqual(game().lab.chips, ["battery", "vent", "power"]);
  assert.equal(game().lab.collectedAt, collectedAt);
});
