import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";

const url = process.env.QC_QA_URL || "http://127.0.0.1:5173/";
const production = process.env.QC_QA_PRODUCTION === "1";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const failedRequests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
});
const state = () =>
  page.evaluate(() => {
    const s = window.__quantumGame?.getState();
    return s
      ? {
          screen: s.screen,
          character: s.character,
          time: s.time,
          size: s.size,
          pos: s.pos,
          panel: s.panel,
        }
      : null;
  });
const menu = () =>
  page.getByRole("button", { name: "스테이지 안내", exact: false });
const dialog = () => page.getByRole("dialog", { name: "스테이지 안내" });
try {
  const response = await page.goto(url);
  assert.equal(response.status(), 200);
  await page
    .getByRole("heading", { level: 1, name: /QUANTUM.*CITY/ })
    .waitFor();
  await page.waitForTimeout(2200);
  assert.equal(
    await page.locator(".game-canvas").count(),
    0,
    "game must not be mounted at first visit",
  );
  await page
    .locator(".title-scene canvas")
    .click({ position: { x: 900, y: 600 } });
  await page.keyboard.press("Digit3");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyW");
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  if (!production) {
    const s = await state();
    assert.equal(s.screen, "start");
    assert.equal(s.size, 1);
    assert.equal(s.time, 0);
  }
  await page.screenshot({ path: "artifacts/quantum-city-menu.png" });

  await menu().click();
  await dialog().waitFor();
  assert.equal(await page.locator(".route-card").count(), 5);
  assert.match(await page.locator(".route-card").nth(4).innerText(), /거대 로봇 보스/);
  assert.match(
    await page.locator(".route-card").nth(0).innerText(),
    /플레이 가능/,
  );
  for (let i = 1; i < 5; i++) {
    await page.locator(".route-card").nth(i).click();
    assert.equal(
      await page
        .getByRole("button", { name: /준비 중 · 진입 불가/ })
        .isDisabled(),
      true,
    );
    assert.match(await page.locator(".stage-details").innerText(), /추후 공개/);
  }
  await page.screenshot({ path: "artifacts/quantum-city-stages.png" });
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  assert.equal(await dialog().count(), 0);
  assert.equal(
    await menu().evaluate((b) => b === document.activeElement),
    true,
    "restore focus",
  );
  await menu().click();
  await page.keyboard.press("Escape");
  assert.equal(await dialog().count(), 0);
  await menu().click();
  await page.mouse.click(5, 5);
  assert.equal(await dialog().count(), 0, "backdrop closes dialog");

  await page.getByRole("button", { name: /캐릭터 선택/, exact: false }).click();
  assert.equal(await page.locator(".explorer-grid button").count(), 47);
  await page.getByRole("button", { name: "M254 선택", exact: true }).click();
  await page.getByRole("button", { name: /선택 완료/ }).click();
  assert.match(await page.locator(".hero-readout").innerText(), /M254/);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.locator(".game-canvas canvas").waitFor();
  await page.waitForTimeout(2200);
  assert.equal(await page.locator(".city-menu").count(), 0);
  if (!production) {
    await page.waitForFunction(
      () => window.__quantumGame.getState().time > 0.5,
    );
    const s = await state();
    assert.equal(s.screen, "game");
    assert.equal(s.character, "alien");
    await page.keyboard.down("KeyW");
    try {
      await page.waitForFunction(
        (position) =>
          Math.hypot(
            window.__quantumGame.getState().pos[0] - position[0],
            window.__quantumGame.getState().pos[2] - position[2],
          ) > 0.1,
        s.pos,
      );
    } finally {
      await page.keyboard.up("KeyW");
    }
    const moved = await state();
    assert.notDeepEqual(moved.pos, s.pos, "game movement enabled");
  }
  await page
    .locator(".game-canvas canvas")
    .click({ position: { x: 850, y: 500 } });
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.keyboard.press("Digit3");
  if (!production) assert.equal((await state()).size, 2.5);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "일시정지" }).waitFor();
  await page.getByRole("button", { name: "메인 메뉴로", exact: true }).click();
  await page.locator(".city-menu").waitFor();
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  assert.equal(await page.locator(".game-canvas").count(), 0);
  assert.match(await page.locator(".hero-readout").innerText(), /M254/);

  await menu().click();
  await page.getByRole("button", { name: /STAGE 1 시작/ }).click();
  await page.locator(".game-canvas canvas").waitFor();
  await page.reload();
  await page.locator(".city-menu").waitFor();
  assert.equal(
    await page.locator(".game-canvas").count(),
    0,
    "refresh always returns to title",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "artifacts/quantum-city-mobile.png" });
  for (const selector of [".city-intro", ".city-actions", ".city-footer"]) {
    const bounds = await page.locator(selector).boundingBox();
    assert(
      bounds.x >= 0 &&
        bounds.y >= 0 &&
        bounds.x + bounds.width <= 391 &&
        bounds.y + bounds.height <= 845,
      `${selector} fits mobile screen`,
    );
  }
  await menu().click();
  await page.screenshot({ path: "artifacts/quantum-city-stages-mobile.png" });
  await page.keyboard.press("Escape");
  assert.equal(await dialog().count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  const result = {
    passed: true,
    production,
    url,
    checks: [
      "main first visit and refresh",
      "menu input disabled",
      "5 stage cards and unavailable entry blocked",
      "close button / Escape / backdrop and focus return",
      "47 characters and selection applied",
      "Stage 1 launch / movement / scale / pointer lock",
      "pause → main menu and selection retained",
      "Stage 1 entry from stage modal",
      "mobile menu and dialog",
    ],
    errors,
    failedRequests,
  };
  fs.writeFileSync(
    `artifacts/${production ? "production-menu-result" : "menu-result"}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: "artifacts/menu-qa-failure.png" });
  throw error;
} finally {
  await browser.close();
}
