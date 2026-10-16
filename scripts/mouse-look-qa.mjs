import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

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
const rotation = () =>
  page.evaluate(() =>
    window.__mouseLookQaRoot.getState().camera.quaternion.toArray(),
  );
const rotationChange = (before, after) =>
  Math.hypot(...after.map((value, index) => value - before[index]));

try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5181/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.waitForFunction(
    () => window.__quantumGame?.getState().lab.time > 0.1,
  );
  assert(rendererUrl);
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    window.__mouseLookQaRoot = _roots.get(
      document.querySelector(".game-canvas canvas"),
    ).store;
  }, rendererUrl);

  for (const stage of [1, 2]) {
    if (stage === 2) {
      await page.evaluate(() => {
        const state = window.__quantumGame.getState();
        state.patchLab({ cleared: true });
        state.start(state.character, 2);
      });
      await page.waitForFunction(
        () => window.__quantumGame.getState().circuit.time > 0.1,
      );
    }
    await page.waitForTimeout(800);
    await page
      .locator(".game-canvas canvas")
      .click({ position: { x: 700, y: 360 } });
    await page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        window.__quantumGame.getState().cameraCaptured,
    );
    const before = await rotation();
    await page.mouse.move(850, 400, { steps: 6 });
    await page.waitForTimeout(800);
    assert(
      rotationChange(before, await rotation()) > 0.01,
      "mouse look rotates while captured",
    );

    await page.mouse.click(700, 360);
    await page.waitForFunction(
      () =>
        !document.pointerLockElement &&
        !window.__quantumGame.getState().cameraCaptured,
    );
    assert.equal(
      await page.evaluate(() => window.__quantumGame.getState().panel),
      null,
    );
    await page.waitForTimeout(800);
    const released = await rotation();
    await page.mouse.move(500, 300, { steps: 6 });
    await page.waitForTimeout(400);
    assert(
      rotationChange(released, await rotation()) < 0.001,
      "mouse movement no longer rotates after releasing",
    );

    const position = await page.evaluate(
      () => window.__quantumGame.getState().pos,
    );
    await page.keyboard.down("w");
    await page.waitForTimeout(350);
    await page.keyboard.up("w");
    const moved = await page.evaluate(
      () => window.__quantumGame.getState().pos,
    );
    assert(
      Math.hypot(moved[0] - position[0], moved[2] - position[2]) > 0.2,
      "keyboard movement remains available",
    );

    await page
      .locator(".game-canvas canvas")
      .click({ position: { x: 700, y: 360 } });
    await page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        window.__quantumGame.getState().cameraCaptured,
    );
    // A non-click release must still pause, including browser Escape releases.
    await page.evaluate(() => document.exitPointerLock());
    await page.waitForFunction(
      () => window.__quantumGame.getState().panel === "pause",
    );
    await page.getByRole("button", { name: "게임으로 돌아가기" }).click();
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => window.__quantumGame.getState().panel === "pause",
    );
    await page.getByRole("button", { name: "게임으로 돌아가기" }).click();
    console.log(
      `PASS Stage ${stage}: click enables, second click releases without pausing, free cursor stops rotation, movement and recapture work, Escape still pauses`,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
