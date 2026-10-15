import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const wait = async (fn, label, ms = 60000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const s = await page.evaluate(() => window.__quantumGame.getState());
    if (fn(s)) return s;
    await page.waitForTimeout(100);
  }
  throw Error(
    label +
      " " +
      JSON.stringify(
        await page.evaluate(() => window.__quantumGame.getState()),
      ),
  );
};
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5177/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await wait((s) => s.lab.time > 0.1, "ready");
  // Place the character at the exit only to isolate the physical bypass guard.
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patchLab({ checkpoint: [0, 0, 25] });
    s.patch({ respawn: s.respawn + 1 });
  });
  await wait((s) => Math.abs(s.pos[2] - 25) < 0.2, "exit guard fixture");
  for (const key of ["Digit2", "Digit1"]) {
    await page.keyboard.press(key);
    await page.keyboard.down("KeyW");
    await page.keyboard.press("Space");
    await page.waitForTimeout(900);
    await page.keyboard.up("KeyW");
    const s = await page.evaluate(() => window.__quantumGame.getState());
    // Gate front is z=26.91; a tiny capsule stops at about z=26.81.
    assert(s.pos[2] < 26.95 && !s.lab.cleared, "manual vent bypass blocked");
  }
  // Fixture isolates runtime and editor QA; full collection is tested separately.
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patchLab({
      chips: ["vent", "power", "battery"],
      code: ["tiny", "giant", "battery", "normal", "power", "tiny", "vent"],
    });
    s.patch({ panel: "power" });
  });
  const first = page.locator(".escape-code li").nth(0),
    third = page.locator(".escape-code li").nth(2);
  await first.dragTo(third);
  assert.deepEqual(
    (await page.evaluate(() => window.__quantumGame.getState().lab.code)).slice(
      0,
      3,
    ),
    ["giant", "tiny", "battery"],
  );
  await page
    .locator(".escape-code li")
    .nth(1)
    .dragTo(page.locator(".escape-code li").nth(0));
  assert.deepEqual(
    (await page.evaluate(() => window.__quantumGame.getState().lab.code)).slice(
      0,
      3,
    ),
    ["tiny", "giant", "battery"],
  );
  await page.screenshot({ path: "artifacts/lab-runtime-start.png" });
  await page.locator(".run-actions .primary").click();
  await wait(
    (s) => s.lab.battery === "carried" || s.lab.run === "failed",
    "carry",
  );
  console.log(
    "CARRY",
    JSON.stringify(
      await page.evaluate(() => ({
        lab: window.__quantumGame.getState().lab,
        pos: window.__quantumGame.getState().pos,
      })),
    ),
  );
  await wait(
    (s) =>
      (s.lab.power && s.lab.fan < 1 && s.lab.fan > 0) || s.lab.run === "failed",
    "fan slowing",
  );
  await page.screenshot({ path: "artifacts/lab-runtime-fan.png" });
  assert((await page.locator(".lab-live-caption").boundingBox()).width <= 301);
  const executing = await page.locator(".escape-code .executing").boundingBox();
  const footer = await page.locator(".escape-editor footer").boundingBox();
  assert(executing && executing.y + executing.height <= footer.y + 1, "current block scrolled into view");
  await wait((s) => s.screen === "clear" || s.lab.run === "failed", "clear");
  const state = await page.evaluate(() => window.__quantumGame.getState());
  assert.equal(state.screen, "clear");
  assert.equal(state.lab.run, "success");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/lab-runtime-result.json",
    JSON.stringify(
      {
        passed: true,
        fixture: "Focused runtime QA supplies an exit checkpoint and chips/code; all movement and devices use real physics. Full collection is verified separately without fixtures.",
        errors,
        state,
      },
      null,
      2,
    ),
  );
  console.log("RUNTIME PASS");
} catch (e) {
  console.error(e);
  await page.screenshot({ path: "artifacts/lab-runtime-failure.png" });
  fs.writeFileSync(
    "artifacts/lab-runtime-result.json",
    JSON.stringify(
      {
        passed: false,
        error: String(e),
        errors,
        state: await page
          .evaluate(() => window.__quantumGame.getState())
          .catch(() => null),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}

