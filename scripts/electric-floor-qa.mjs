import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [],
  results = [];
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

const tick = (frames, holdTime) =>
  page.evaluate(
    ({ frames, holdTime }) => {
      const root = window.__electricRoot.getState(),
        render = root.gl.render;
      root.gl.render = () => {};
      try {
        for (let i = 0; i < frames; i++) {
          if (holdTime !== undefined)
            window.__quantumGame.getState().patchLab({ time: holdTime });
          root.advance(root.clock.elapsedTime + 1 / 60, true);
        }
      } finally {
        root.gl.render = render;
      }
      root.gl.render(root.scene, root.camera);
    },
    { frames, holdTime },
  );
const sample = () =>
  page.evaluate(() => {
    const s = window.__quantumGame.getState();
    const model = window.__electricRoot
      .getState()
      .scene.getObjectByName("character-model").parent.parent;
    return {
      size: s.size,
      pos: s.pos,
      deaths: s.lab.deaths,
      scale: model.scale.x,
      modelPos: model.position.toArray(),
      time: s.lab.time,
    };
  });

async function place(z, time) {
  await page.evaluate(
    ({ z, time }) => {
      const s = window.__quantumGame.getState();
      s.patchLab({ checkpoint: [8, 0, z], time });
      s.patch({
        panel: null,
        respawn: s.respawn + 1,
        labTutorial: { ...s.labTutorial, phase: "skipped" },
      });
    },
    { z, time },
  );
  await tick(15);
  await page.evaluate(
    (time) =>
      window.__quantumGame
        .getState()
        .patchLab({ checkpoint: [8, 0, -3], time }),
    time,
  );
}

try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5177/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.waitForFunction(
    () => window.__quantumGame?.getState().lab.time > 0.1,
  );
  assert(rendererUrl);
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    window.__electricRoot = _roots.get(
      document.querySelector(".game-canvas canvas"),
    ).store;
    const root = window.__electricRoot.getState();
    root.setDpr(0.5);
    root.gl.shadowMap.enabled = false;
    root.setFrameloop("never");
  }, rendererUrl);

  for (const [key, size] of [
    ["Digit1", 0.25],
    ["Digit2", 1],
    ["Digit3", 2.5],
  ]) {
    await place(-3, 0);
    await page.keyboard.press(key);
    await tick(30);
    assert.equal((await sample()).size, size, "real size selection");

    // Walk through the first tile while it is mint.
    await place(-1.5, 0);
    const safeStart = await sample();
    await page.keyboard.down("w");
    await tick(65);
    await page.keyboard.up("w");
    const safeEnd = await sample();
    assert.equal(safeEnd.deaths, safeStart.deaths, `mint allows size ${size}`);
    assert(safeEnd.pos[2] > 1.2, `mint actually crossed at size ${size}`);
    results.push({ case: "mint crossing", size, ...safeEnd });

    // Hold the last tile yellow to isolate waiting-state collision behavior.
    await place(6.5, 1.5);
    const waitingStart = await sample();
    await page.keyboard.down("s");
    await tick(75, 1.5);
    await page.keyboard.up("s");
    const waitingEnd = await sample();
    assert.equal(
      waitingEnd.deaths,
      waitingStart.deaths,
      `yellow allows size ${size}`,
    );
    assert(waitingEnd.pos[2] < 3.3, `yellow actually crossed at size ${size}`);
    results.push({ case: "yellow waiting crossing", size, ...waitingEnd });

    for (const [label, startZ, key, jump] of [
      ["purple walking", -1.5, "w", false],
      ["purple jumping", -1.5, "w", true],
      ["purple return from item", 6.5, "s", false],
    ]) {
      await place(startZ, 3.5);
      const before = await sample();
      if (jump) await page.keyboard.press("Space");
      await page.keyboard.down(key);
      for (let i = 0; i < 20 && (await sample()).deaths === before.deaths; i++)
        await tick(3);
      await page.keyboard.up(key);
      await tick(30);
      const after = await sample();
      assert.equal(after.deaths, before.deaths + 1, `${label}, size ${size}`);
      assert.equal(after.size, size, "selection survives knockback");
      assert(
        Math.abs(after.scale - size) < 0.001,
        "rendered body keeps selected size",
      );
      assert(
        Math.abs(after.pos[2] + 3) < 0.05,
        "returned to entrance checkpoint",
      );
      assert(
        Math.abs(after.pos[1]) < 0.08,
        "capsule remains grounded at selected size",
      );
      results.push({ case: label, size, ...after });
    }
  }

  // Turn purple while a giant is already above the tile in mid-jump.
  await place(0.5, 0);
  await page.keyboard.press("Space");
  await tick(12);
  const airborne = await sample();
  assert(airborne.pos[1] > 0.28, "jump is above the old hazard threshold");
  await page.evaluate(() =>
    window.__quantumGame.getState().patchLab({ time: 3.39 }),
  );
  await tick(1);
  await tick(30);
  const switched = await sample();
  assert.equal(
    switched.deaths,
    airborne.deaths + 1,
    "phase change ejects midair player",
  );
  assert.equal(switched.size, 2.5);
  assert(Math.abs(switched.pos[2] + 3) < 0.05);
  results.push({ case: "turning purple midair", ...switched });
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "artifacts/electric-floor-qa.png" });
  fs.writeFileSync(
    "artifacts/electric-floor-qa-result.json",
    JSON.stringify({ passed: true, results, errors }, null, 2),
  );
  console.log(
    `PASS: ${results.length} real-physics cases; mint/yellow crossing, purple walking/jumping/return, size preservation, midair phase change`,
  );
} catch (error) {
  console.error(await sample().catch(() => null));
  await page.screenshot({ path: "artifacts/electric-floor-qa-failure.png" });
  throw error;
} finally {
  await browser.close();
}
