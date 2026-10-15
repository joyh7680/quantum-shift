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
  assert.match(
    await page.locator(".route-card").nth(4).innerText(),
    /거대 로봇 보스/,
  );
  assert.match(
    await page.locator(".route-card").nth(0).innerText(),
    /플레이 가능/,
  );
  for (let i = 1; i < 5; i++) {
    const card = page.locator(".route-card").nth(i);
    assert.equal(await card.isEnabled(), true);
    assert.match(await card.innerText(), /준비 중/);
    await card.click();
    assert.equal(await card.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page
        .getByRole("button", { name: /준비 중 · 진입 불가/ })
        .isDisabled(),
      true,
    );
    const details = await page.locator(".stage-details").innerText();
    if (i < 4) {
      const expected = [
        [
          "마이크로 회로",
          "초소형으로 변신해 컴퓨터 내부를 탐험하고 회로를 복구.",
          "슈트에 자동 장애물 회피 기능 제작",
          "바이브 코딩 · 조건문",
        ],
        [
          "폭주한 공장",
          "움직이는 컨베이어와 거대한 기계 사이를 통과.",
          "잘못된 자동 크기 변환 코드를 수정",
          "디버깅 · 조건문",
        ],
        [
          "퀀텀 월드",
          "크기와 중력의 규칙이 달라지는 공간에서 탈출.",
          "변수로 크기를 조절하고 이동 경로 설계",
          "변수 · 비교 연산자",
        ],
      ][i - 1];
      assert.ok((await card.innerText()).includes(expected[0]));
      assert.ok((await card.innerText()).includes(expected[1]));
      for (const text of [
        expected[0],
        "미션",
        expected[2],
        "학습 요소",
        expected[3],
      ])
        assert.ok(details.includes(text), text);
    } else {
      assert.match(details, /추후 공개/);
      assert.match(details, /목표/);
      assert.match(details, /주요 플레이/);
    }
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
