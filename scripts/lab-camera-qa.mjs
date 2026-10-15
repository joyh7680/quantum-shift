import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
let rendererUrl;
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (
    /(@react-three_fiber|@react-three\/fiber\/dist\/react-three-fiber).*\.js/.test(
      response.url(),
    )
  )
    rendererUrl = response.url();
});
const program = ["giant", "battery", "normal", "power", "tiny", "vent"];
const checks = [];
const camera = () =>
  page.evaluate(() => {
    const root = window.__cameraQaRoot;
    const state = root.getState();
    return {
      angle: state.controls.getAzimuthalAngle(),
      pitch: state.controls.getPolarAngle(),
      distance: state.camera.position.distanceTo(state.controls.target),
      target: state.controls.target.toArray(),
      locked: !!document.pointerLockElement,
    };
  });
const game = () =>
  page.evaluate(() => {
    const s = window.__quantumGame.getState();
    return {
      pos: s.pos,
      size: s.size,
      code: s.lab.code,
      run: s.lab.run,
      index: s.lab.index,
      step: s.lab.step,
    };
  });
async function rotate() {
  await page.mouse.move(390, 340);
  await page.mouse.down();
  await page.mouse.move(510, 365, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5180/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.waitForFunction(
    () => window.__quantumGame?.getState().lab.time > 0.1,
  );
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patchLab({
      checkpoint: [0, 0.03, 13],
      chips: ["battery", "power", "vent"],
    });
    s.patch({
      panel: "power",
      pos: [0, 0.03, 13],
      respawn: s.respawn + 1,
      toast: "",
    });
  });
  assert(rendererUrl);
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    window.__cameraQaRoot = _roots.get(
      document.querySelector(".game-canvas canvas"),
    ).store;
  }, rendererUrl);
  await page.waitForFunction(
    () => !!window.__cameraQaRoot.getState().controls?.target,
  );
  await page.waitForTimeout(500);
  const before = await camera();
  const idle = await game();
  await rotate();
  const turned = await camera();
  assert(Math.abs(turned.angle - before.angle) > 0.15);
  assert.equal(turned.locked, false);
  assert.deepEqual(await game(), idle);
  checks.push(
    "idle drag rotates camera without moving player or changing code",
  );
  await page.mouse.move(450, 340);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(400);
  assert((await camera()).distance < turned.distance - 0.5);
  checks.push("canvas wheel zooms");
  await page.screenshot({ path: "artifacts/lab-camera-orbit.png" });
  await page
    .getByRole("button", { name: "↻ 시점 초기화", exact: true })
    .click();
  await page.waitForTimeout(400);
  const reset = await camera();
  assert(Math.abs(reset.angle - before.angle) < 0.02);
  assert(Math.abs(reset.distance - before.distance) < 0.1);
  checks.push("reset restores overview");
  await page.mouse.move(1080, 390);
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(300);
  assert(Math.abs((await camera()).distance - reset.distance) < 0.05);
  checks.push("editor scrolling does not zoom camera");

  console.log("PASS: idle orbit, zoom, reset and editor scroll isolation");
  const lockProgram = Array(100).fill("giant");
  await page.evaluate(
    (code) => window.__quantumGame.getState().patchLab({ code }),
    lockProgram,
  );
  await page.getByRole("button", { name: "실행 ▶", exact: true }).click();
  await page.waitForFunction(
    () => window.__quantumGame.getState().lab.index === 1,
  );
  const runStart = await camera();
  await rotate();
  const runTurned = await camera();
  assert(Math.abs(runTurned.angle - runStart.angle) > 0.15);
  await page.mouse.move(440, 350);
  await page.mouse.wheel(0, -180);
  await page.keyboard.down("w");
  await page.keyboard.press("Space");
  await page.keyboard.press("1");
  await page.waitForTimeout(400);
  await page.keyboard.up("w");
  const executing = await game();
  assert.equal(executing.run, "running");
  assert.equal(executing.size, 2.5);
  assert.deepEqual(executing.code, lockProgram);
  assert(Math.hypot(executing.pos[0], executing.pos[2] - 13) < 0.1);
  assert.equal(
    await page.locator('.escape-code > li[draggable="true"]').count(),
    0,
  );
  assert.equal((await camera()).locked, false);
  checks.push(
    "running drag and zoom work while manual size, movement and code editing stay locked",
  );
  console.log("PASS: camera and manual input lock during execution");
  await page
    .getByRole("button", { name: "↻ 시점 초기화", exact: true })
    .click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "artifacts/lab-camera-running.png" });
  await page.getByRole("button", { name: "실행 중단", exact: true }).click();
  assert.equal((await game()).run, "idle");
  assert.equal((await game()).size, 1);
  assert.deepEqual((await game()).code, lockProgram);
  await rotate();
  checks.push("stop resets the puzzle, retains code and leaves camera usable");
  console.log("PASS: stop and camera reuse");
  await page
    .getByRole("button", { name: "← 탐험으로 돌아가기", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => !!window.__cameraQaRoot.getState().controls),
    false,
  );
  await page
    .locator(".game-canvas canvas")
    .click({ position: { x: 410, y: 330 } });
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.waitForTimeout(300);
  const explorationAngle = await page.evaluate(() =>
    window.__cameraQaRoot.getState().camera.quaternion.toArray(),
  );
  await page.mouse.move(600, 400, { steps: 6 });
  await page.waitForTimeout(300);
  const rotatedExploration = await page.evaluate(() =>
    window.__cameraQaRoot.getState().camera.quaternion.toArray(),
  );
  assert.notDeepEqual(rotatedExploration, explorationAngle);
  await page.evaluate(() => document.exitPointerLock());
  checks.push("return to exploration restores pointer-lock mouse look");
  console.log("PASS: exploration mouse look");
  await page.evaluate((code) => {
    const s = window.__quantumGame.getState();
    s.patch({ panel: "power" });
    s.patchLab({ code });
  }, program);
  await page.getByRole("button", { name: "실행 ▶", exact: true }).click();
  await rotate();
  console.log("Waiting for real escape program to clear");
  await page.waitForFunction(
    () => window.__quantumGame.getState().lab.cleared,
    null,
    { timeout: 120000 },
  );
  assert.equal(
    await page.evaluate(() => !!window.__cameraQaRoot.getState().controls),
    false,
  );
  checks.push(
    "program reaches Stage 1 clear after camera interaction and orbit controls detach",
  );
  await page.screenshot({ path: "artifacts/lab-camera-clear.png" });
  assert.deepEqual(errors, []);
  const result = { passed: true, checks, errors };
  fs.writeFileSync(
    "artifacts/lab-camera-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log("Failure state:", await game());
  await page.screenshot({ path: "artifacts/lab-camera-failure.png" });
  throw error;
} finally {
  await browser.close();
}
