import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const notice = page.getByRole("dialog", { name: "다음 탐험을 기다려 주세요" });
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5173/");
  await page.waitForFunction(() => !!window.__quantumGame);
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.start(s.character, 2);
    if (window.__quantumGame.getState().screen !== "start")
      throw new Error("Stage 2 opened on first visit");
    // Set the successful exit prerequisites, then use the real clear action.
    s.start(s.character, 1);
    s.patchLab({ run: "success", fan: 0, mission: 2, time: 75, deaths: 2 });
    s.patch({ size: 0.25, pos: [0, 0, 29] });
    s.completeLab();
  });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("스테이지 1이 재밌었다면,");
  await expect(notice).toContainText("스테이지 2도 개발해 볼게요!");
  await expect(notice).toContainText("아직 준비 중입니다.");
  await expect(
    page.getByRole("button", { name: /STAGE 2로 이동/ }),
  ).toHaveCount(0);
  await page.screenshot({ path: "artifacts/stage-lock-notice-desktop.png" });

  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.nextStage();
    s.start(s.character, 2);
    if (window.__quantumGame.getState().activeStage !== 1)
      throw new Error("Stage 2 opened after clearing Stage 1");
  });
  await page.keyboard.press("Escape");
  await expect(notice).toHaveCount(0);
  await expect(page.locator(".clear-stats")).toContainText("1:15");
  const reopen = page.getByRole("button", { name: /다음 스테이지 안내/ });
  await reopen.click();
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "클리어 기록 보기" }).click();
  await expect(reopen).toBeFocused();
  await reopen.click();
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await notice.boundingBox();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  assert(bounds.y >= 0 && bounds.y + bounds.height <= 844);
  await page.screenshot({ path: "artifacts/stage-lock-notice-mobile.png" });
  await notice.getByRole("button", { name: /메인 메뉴로/ }).click();
  await expect(page.locator(".city-menu")).toBeVisible();
  await expect(notice).toHaveCount(0);
  await expect(page.locator(".city-system")).toContainText("01 / 05 STAGES");
  await page.getByRole("button", { name: /스테이지 안내/ }).click();
  await page.locator(".route-card").nth(1).click();
  await expect(page.locator(".route-card").nth(1)).toContainText("준비 중");
  await expect(page.locator(".route-card").nth(1)).toHaveClass(/locked/);
  await expect(
    page.getByRole("button", { name: /준비 중 · 진입 불가/ }),
  ).toBeDisabled();
  await page.screenshot({ path: "artifacts/stage-lock-menu-mobile.png" });
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.start(s.character, 2);
    if (window.__quantumGame.getState().screen !== "start")
      throw new Error("Stage 2 opened from the menu after clear");
  });
  await page.locator(".route-card").nth(0).click();
  await page.getByRole("button", { name: /STAGE 1 시작/ }).click();
  await expect(page.locator(".game-canvas canvas")).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "STAGE LOCK PASS: entry blocked before/after clear and menu return; auto notice, Escape, reopen, focus, mobile layout, Stage 1 replay; no browser errors",
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/stage-lock-failure.png" });
  throw error;
} finally {
  await browser.close();
}
