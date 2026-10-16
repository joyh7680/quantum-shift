import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
const tick = (deltas) =>
  page.evaluate((deltas) => {
    const root = window.__movementRoot.getState();
    const render = root.gl.render;
    root.gl.render = () => {};
    const samples = [];
    try {
      for (const dt of deltas) {
        root.advance(root.clock.elapsedTime + dt, true);
        const player = root.scene.getObjectByName("player-visual");
        samples.push({
          position: player.getWorldPosition(player.position.clone()).toArray(),
          facing: player.rotation.y,
          camera: root.camera.position.toArray(),
        });
      }
    } finally {
      root.gl.render = render;
    }
    return samples;
  }, deltas);
const reset = async () => {
  await page.evaluate(() => {
    const game = window.__quantumGame.getState();
    game.patchLab({ checkpoint: [0, 0, -2] });
    game.patch({ panel: null, size: 1, respawn: game.respawn + 1 });
  });
  await page.waitForTimeout(100);
  await tick(Array(60).fill(1 / 60));
};
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5173/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.waitForFunction(
    () => window.__quantumGame?.getState().lab.time > 0.1,
  );
  assert(rendererUrl);
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    window.__movementRoot = _roots.get(
      document.querySelector(".game-canvas canvas"),
    ).store;
    const root = window.__movementRoot.getState();
    root.setDpr(0.5);
    root.gl.shadowMap.enabled = false;
    root.setFrameloop("never");
  }, rendererUrl);
  const results = [];
  for (const fps of [30, 60, 120, 144]) {
    await reset();
    await page.keyboard.down("w");
    await tick(Array(12).fill(1 / fps));
    const samples = await tick(Array(Math.ceil(fps / 2)).fill(1 / fps));
    await page.keyboard.up("w");
    const increments = samples
      .slice(1)
      .map((s, i) => s.position[2] - samples[i].position[2]);
    const maxError = Math.max(
      ...increments.map((delta) => Math.abs(delta - 4 / fps)),
    );
    // Allow Rapier's small ground-contact corrections, while rejecting the
    // repeated zero/full physics-step jumps caused by un-interpolated motion.
    assert(
      maxError < (4 / fps) * 0.1,
      `${fps} Hz: every render frame must advance smoothly, error=${maxError}`,
    );
    results.push({
      fps,
      maxPositionError: maxError,
      stationaryFrames: increments.filter((d) => d < 0.00001).length,
    });
  }
  await reset();
  await page.keyboard.down("w");
  await tick(Array(12).fill(1 / 60));
  const variableDeltas = Array.from(
    { length: 48 },
    (_, i) => [1 / 144, 1 / 30, 1 / 75, 1 / 120][i % 4],
  );
  const variable = await tick(variableDeltas);
  await page.keyboard.up("w");
  for (let i = 1; i < variable.length; i++)
    assert(
      Math.abs(
        variable[i].position[2] -
          variable[i - 1].position[2] -
          4 * variableDeltas[i],
      ) < 4 * variableDeltas[i] * 0.1,
      "irregular frame timing preserves smooth movement",
    );

  await reset();
  await page.keyboard.down("s");
  await page.keyboard.down("a");
  const before = (await tick(Array(60).fill(1 / 144))).at(-1);
  await page.keyboard.up("a");
  await page.keyboard.down("d");
  const turning = await tick(Array(12).fill(1 / 144));
  assert(
    turning[0].facing > before.facing,
    "turn across +/- pi takes the short route",
  );
  assert(
    turning.every((s) => s.facing > 2),
    "turn must not spin through forward",
  );
  await page.keyboard.up("s");
  await page.keyboard.up("d");

  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => window.__quantumGame.getState().panel === "pause",
  );
  const paused = await tick(Array(12).fill(1 / 144));
  assert.deepEqual(
    paused[0].position,
    paused.at(-1).position,
    "pause freezes position",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        rates: results,
        variableTiming: true,
        shortestTurn: true,
        pause: true,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
