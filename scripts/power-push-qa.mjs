import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
const tick = (frames) =>
  page.evaluate((frames) => {
    const s = window.__powerRoot.getState(),
      render = s.gl.render;
    s.gl.render = () => {};
    try {
      for (let i = 0; i < frames; i++)
        s.advance(s.clock.elapsedTime + 1 / 60, true);
    } finally {
      s.gl.render = render;
    }
    s.gl.render(s.scene, s.camera);
  }, frames);
const sample = () =>
  page.evaluate(() => {
    const s = window.__quantumGame.getState();
    const scene = window.__powerRoot.getState().scene;
    const model = scene.getObjectByName("character-model");
    return {
      screen: s.screen,
      lab: JSON.parse(JSON.stringify(s.lab)),
      pos: s.pos,
      facing: model.parent.parent.rotation.y,
      lean: model.rotation.x,
      arms: ["left-arm", "right-arm"].map(
        (name) => model.getObjectByName(name).rotation.x,
      ),
      breaker: scene.getObjectByName("power-breaker").rotation.x,
    };
  });
async function until(predicate, label) {
  for (let i = 0; i < 500; i++) {
    const s = await sample();
    if (predicate(s)) return s;
    assert.notEqual(s.lab.run, "failed", s.lab.feedback);
    await tick(6);
  }
  throw Error(`${label}: ${JSON.stringify(await sample())}`);
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
    window.__powerRoot = _roots.get(
      document.querySelector(".game-canvas canvas"),
    ).store;
    const root = window.__powerRoot.getState();
    root.setDpr(1);
    root.gl.shadowMap.enabled = false;
    root.setFrameloop("never");
    const s = window.__quantumGame.getState();
    s.patchLab({
      chips: ["battery", "power", "vent"],
      code: ["giant", "battery", "normal", "power", "tiny", "vent"],
    });
    s.patch({ panel: "power" });
  }, rendererUrl);
  await page.locator(".run-actions .primary").click();
  await until(
    (s) => s.lab.index === 3 && s.lab.step === 3,
    "reaches breaker with real physics",
  );
  await tick(3);
  const before = await sample();
  assert(
    Math.abs(before.pos[0] - 5) < 0.1 && Math.abs(before.pos[2] - 22.75) < 0.1,
  );
  await until((s) => s.lab.elapsed >= 1.35, "sustained push");
  const pushing = await sample();
  assert(
    pushing.arms.every((angle) => angle < -1.4),
    "both arms reach forward",
  );
  assert(pushing.lean > 0.15, "body leans into breaker");
  assert(
    Math.abs(pushing.facing) < 0.05,
    "faces breaker instead of diagonal approach",
  );
  assert(pushing.breaker > before.breaker + 0.8, "lever moves with hands");
  assert.equal(pushing.lab.power, false, "power remains on until full push");
  // Show the actual game scene from beside the breaker to inspect contact.
  await page.evaluate(() => {
    const r = window.__powerRoot.getState();
    r.camera.position.set(8.5, 2.6, 20.5);
    r.camera.lookAt(5, 1, 23.2);
    r.gl.render(r.scene, r.camera);
  });
  await page.screenshot({ path: "artifacts/power-push.png" });
  await until((s) => s.lab.power, "power cuts at end of push");
  const cut = await sample();
  assert(Math.abs(cut.breaker - 0.65) < 0.001);
  assert(cut.lab.fan > 0 && cut.lab.fan < 1);
  await until((s) => s.lab.elapsed >= 2.6, "releases handle");
  const released = await sample();
  assert(released.arms.every((angle) => Math.abs(angle) < 0.02));
  assert.equal(
    released.breaker,
    cut.breaker,
    "breaker stays off after release",
  );
  await until((s) => s.screen === "clear", "remaining program clears Stage 1");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/power-push-result.json",
    JSON.stringify(
      { passed: true, before, pushing, cut, released, errors },
      null,
      2,
    ),
  );
  console.log(
    "PASS: real approach, facing, two-arm push, lever sync, delayed power cut, release, Stage 1 clear",
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/power-push-failure.png" });
  console.error(await sample().catch(() => null));
  throw error;
} finally {
  await browser.close();
}
