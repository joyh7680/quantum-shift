import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const initial = [
  "giant",
  "battery",
  "normal",
  "battery",
  "power",
  "tiny",
  "vent",
];
const checks = [];
const code = () =>
  page.evaluate(() => [...window.__quantumGame.getState().lab.code]);
const rows = () => page.locator(".escape-code > li:not(.code-drop)");
async function seed(commands = initial) {
  await page.evaluate((commands) => {
    const s = window.__quantumGame.getState();
    s.patchLab({
      code: commands,
      chips: ["battery", "power", "vent"],
      run: "idle",
      index: -1,
    });
  }, commands);
}
// Use real browser mouse input, including the native drag threshold and drop.
async function drag(from, to, half = "bottom", screenshot = false) {
  const source = rows().nth(from);
  const target = rows().nth(to);
  await source.scrollIntoViewIfNeeded();
  const a = await source.boundingBox();
  await page.mouse.move(a.x + 16, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 24, a.y + a.height / 2 + 7, { steps: 4 });
  await target.scrollIntoViewIfNeeded();
  const b = await target.boundingBox();
  await page.mouse.move(
    b.x + 85,
    b.y + b.height * (half === "top" ? 0.2 : 0.8),
    { steps: 16 },
  );
  await page.mouse.move(
    b.x + 86,
    b.y + b.height * (half === "top" ? 0.2 : 0.8),
  );
  if (screenshot) {
    assert.equal(await page.locator(".code-dragging").count(), 1);
    assert((await page.locator(".drop-before, .drop-after").count()) > 0);
    await page.screenshot({ path: "artifacts/code-drag-active.png" });
  }
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator(".code-dragging, .drop-before, .drop-after").count(),
    0,
  );
}
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5178/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.waitForFunction(
    () => window.__quantumGame?.getState().lab.time > 0.1,
  );
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patch({ panel: "power", toast: "" });
  });
  await seed();
  await drag(0, 1, "bottom", true);
  assert.deepEqual(await code(), ["battery", "giant", ...initial.slice(2)]);
  checks.push("adjacent downward drag and visible insertion cue");
  await drag(1, 0, "top");
  assert.deepEqual(await code(), initial);
  checks.push("adjacent upward drag");
  await drag(0, 6);
  assert.deepEqual(await code(), [...initial.slice(1), "giant"]);
  await drag(6, 0, "top");
  assert.deepEqual(await code(), initial);
  checks.push("first to last, last to first, duplicate blocks retained");
  const palette = await page
    .locator(".escape-palette button")
    .filter({ hasText: "거대화" })
    .boundingBox();
  const target = await rows().nth(2).boundingBox();
  await page.mouse.move(palette.x + 60, palette.y + 20);
  await page.mouse.down();
  await page.mouse.move(palette.x + 75, palette.y + 25, { steps: 4 });
  await page.mouse.move(target.x + 80, target.y + 40, { steps: 16 });
  await page.mouse.move(target.x + 81, target.y + 40);
  await page.mouse.up();
  assert.deepEqual(await code(), [
    ...initial.slice(0, 3),
    "giant",
    ...initial.slice(3),
  ]);
  checks.push("palette drag inserts at indicated boundary");
  await seed();
  const a = await rows().nth(0).boundingBox();
  await page.mouse.move(a.x + 18, a.y + 20);
  await page.mouse.down();
  await page.mouse.move(400, 500, { steps: 12 });
  await page.mouse.up();
  assert.deepEqual(await code(), initial);
  assert.equal(
    await page.locator(".code-dragging, .drop-before, .drop-after").count(),
    0,
  );
  checks.push("drop outside cancels cleanly");
  await page
    .getByRole("button", { name: "1번 블록 아래로", exact: true })
    .click();
  assert.deepEqual(await code(), ["battery", "giant", ...initial.slice(2)]);
  await page
    .getByRole("button", { name: "2번 블록 삭제", exact: true })
    .click();
  assert.deepEqual(await code(), initial.slice(1));
  checks.push("arrow and delete buttons remain functional");
  await seed();
  await page.getByRole("button", { name: "실행 ▶", exact: true }).click();
  assert.equal(
    await page.locator('.escape-code > li[draggable="true"]').count(),
    0,
  );
  assert.equal(
    await page.locator(".escape-code button:not(:disabled)").count(),
    0,
  );
  checks.push("editing and drag disabled during execution");
  await page.getByRole("button", { name: "실행 중단", exact: true }).click();
  await drag(0, 1);
  assert.deepEqual(await code(), ["battery", "giant", ...initial.slice(2)]);
  checks.push("drag works after stop");
  await page.setViewportSize({ width: 1280, height: 720 });
  await rows().nth(2).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/code-drag-result.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  checks.push("1280px layout has no horizontal overflow");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/code-drag-result.json",
    JSON.stringify({ passed: true, checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} finally {
  await browser.close();
}
