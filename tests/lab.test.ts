import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useGame } from "../src/store.ts";
import {
  commandFailure,
  editCode,
  resetPuzzle,
  startProgram,
  tickProgram,
  updateLab,
} from "../src/stages/lab/gameplay.ts";
import type { Command } from "../src/stages/lab/state.ts";
import type { Vec } from "../src/stages/shared.ts";
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
    ["battery", [-8, 2.8, 7], 1],
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
