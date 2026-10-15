import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useGame } from "../src/store.ts";
import { createLabState } from "../src/stages/lab/state.ts";
import {
  createCircuitState,
  laserPosition,
} from "../src/stages/circuit/state.ts";
import { interactLab, updateLab } from "../src/stages/lab/gameplay.ts";
import {
  interactCircuit,
  updateCircuit,
} from "../src/stages/circuit/gameplay.ts";
import { compileRequest } from "../src/rules.ts";
import type { StageFrame } from "../src/stages/shared.ts";

const game = () => useGame.getState();
beforeEach(() => {
  useGame.setState(useGame.getInitialState(), true);
});
function enterCircuit() {
  game().start("codmos_nova");
  game().patchLab({ power: true, mission: 2, run: "success", fan: 0 });
  game().patch({ size: 0.25, pos: [0, 0, 29] });
  game().completeLab();
  game().nextStage();
}
function equippedCircuit() {
  enterCircuit();
  game().patchCircuit({
    program: compileRequest("레이저 감지 시 초소형, 이후 원래 크기로 복귀")
      .program!,
    tested: true,
    equipped: true,
    ability: true,
    mission: 1,
  });
}
function frame(overrides: Partial<StageFrame> = {}): StageFrame {
  return {
    pos: [0, 0, 32],
    size: 1,
    dt: 1 / 60,
    runtime: { previous: 1, clearTime: 0 },
    fits: () => true,
    changeSize: (size) => {
      game().patch({ size });
      return true;
    },
    die: (reason) => game().die(reason),
    ...overrides,
  };
}
test("Stage 2 entry and transitions require Stage 1 completion", () => {
  game().start("codmos_nova", 2);
  assert.equal(game().screen, "start");
  game().start("codmos_nova");
  game().completeLab();
  game().nextStage();
  assert.equal(game().activeStage, 1);
  assert.equal(game().screen, "game");
  assert.equal(game().lab.cleared, false);
  assert.equal(game().circuit.cleared, false);
});
test("Stage 1 exploration cannot bypass coding or progress Stage 2", () => {
  game().start("codmos_nova");
  updateLab(frame({ pos: [0, 0, 4] }));
  assert.equal(game().lab.mission, 0);
  updateLab(frame({ pos: [0, 0, 14] }));
  assert.equal(game().lab.mission, 0);
  assert.equal(game().lab.cleared, false);
  updateCircuit(frame({ pos: [0, 0, 76] }));
  game().patch({ pos: [-4, 0, 35] });
  interactCircuit();
  assert.equal(game().panel, null);
  assert.deepEqual(game().circuit, createCircuitState());
});
test("Stage 1 clear freezes its stats and initializes Stage 2 independently", () => {
  game().start("alien");
  game().patchLab({
    power: true,
    battery: "installed",
    mission: 2,
    deaths: 2,
    time: 75,
    run: "success",
    fan: 0,
  });
  game().patch({ size: 0.25, pos: [0, 0, 29] });
  game().completeLab();
  const lab = structuredClone(game().lab);
  assert.equal(game().screen, "clear");
  game().nextStage();
  assert.equal(game().activeStage, 2);
  assert.equal(game().character, "alien");
  assert.deepEqual(game().pos, [0, 0, 32]);
  assert.deepEqual(game().circuit, createCircuitState());
  updateCircuit(frame());
  updateLab(frame({ pos: [0, 0, 14] }));
  interactLab();
  assert.deepEqual(game().lab, lab);
});
test("death updates only the active stage and preserves its completed work", () => {
  equippedCircuit();
  const lab = structuredClone(game().lab);
  game().patchCircuit({
    bossHP: 1,
    checkpoint: [0, 0, 58],
    automatic: true,
    pendingRestore: true,
  });
  game().die("레이저에 맞았습니다");
  assert.equal(game().circuit.deaths, 1);
  assert.equal(game().circuit.bossHP, 1);
  assert.equal(game().circuit.equipped, true);
  assert.equal(game().circuit.automatic, false);
  assert.equal(game().circuit.pendingRestore, false);
  assert.deepEqual(game().circuit.checkpoint, [0, 0, 58]);
  assert.deepEqual(game().lab, lab);
});
test("Stage 2 uses the developed program for corridor shrink, waiting and restoration", () => {
  equippedCircuit();
  const lab = structuredClone(game().lab);
  const f = frame({ pos: [0, 0, laserPosition(44, 1 / 60)], size: 2.5 });
  updateCircuit(f);
  assert.equal(game().size, 0.25);
  assert.equal(game().circuit.automatic, true);
  assert.equal(game().circuit.deaths, 0);
  f.pos = [0, 0, 55.8];
  f.size = 0.25;
  f.dt = 0.4;
  f.fits = () => false;
  updateCircuit(f);
  assert.equal(game().circuit.pendingRestore, true);
  assert.equal(game().size, 0.25);
  f.pos = [0, 0, 58];
  f.fits = () => true;
  updateCircuit(f);
  assert.equal(game().size, 2.5);
  assert.equal(game().circuit.automatic, false);
  assert.equal(game().circuit.mission, 2);
  assert.deepEqual(game().lab, lab);
});
test("guardian requires automatic dodge and three separate giant weak-point hits", () => {
  equippedCircuit();
  game().patchCircuit({ mission: 2 });
  game().patch({ pos: [0, 0, 62], size: 2.5 });
  interactCircuit();
  assert.equal(game().circuit.bossHP, 3);
  for (let hp = 3; hp > 0; hp--) {
    game().patchCircuit({ bossTime: 2.5, bossDodged: false, automatic: false });
    const f = frame({ pos: [0, 0, 62], size: 2.5 });
    updateCircuit(f);
    assert.equal(game().circuit.bossDodged, true);
    f.size = 0.25;
    f.dt = 1.6;
    updateCircuit(f);
    assert.equal(game().circuit.bossPhase, "weak");
    game().patch({ size: 1 });
    interactCircuit();
    assert.equal(
      game().circuit.bossHP,
      hp,
      "normal size cannot damage the core",
    );
    game().patch({ size: 2.5 });
    interactCircuit();
    interactCircuit();
    assert.equal(game().circuit.bossHP, hp - 1, "one hit per dodge window");
  }
  assert.equal(game().circuit.bossPhase, "defeated");
  assert.equal(game().circuit.cleared, false);
  updateCircuit(frame({ pos: [0, 0, 76] }));
  assert.equal(game().circuit.cleared, true);
  assert.equal(game().screen, "clear");
});
test("guardian without the ability never exposes its weak point", () => {
  equippedCircuit();
  game().patchCircuit({ mission: 2, ability: false, bossTime: 2.5 });
  updateCircuit(frame({ pos: [0, 0, 62] }));
  assert.equal(game().circuit.deaths, 1);
  assert.equal(game().circuit.bossDodged, false);
  game().patchCircuit({ bossTime: 4.5 });
  updateCircuit(frame({ pos: [0, 0, 62] }));
  assert.equal(game().circuit.bossPhase, "shield");
});
test("menu return and Stage 2 replay preserve Stage 1 progress", () => {
  enterCircuit();
  const lab = structuredClone(game().lab);
  game().patchCircuit({ time: 30, deaths: 3, bossHP: 1 });
  game().reset();
  assert.equal(game().screen, "start");
  assert.deepEqual(game().lab, lab);
  game().start(game().character, 2);
  assert.deepEqual(game().circuit, createCircuitState());
  assert.deepEqual(game().lab, lab);
  game().reset();
  game().start(game().character, 1);
  assert.deepEqual(game().lab, createLabState());
});
