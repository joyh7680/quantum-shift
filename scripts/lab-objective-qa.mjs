import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const tutorial = page.locator(".lab-tutorial-toast");
const card = page.locator(".mission-card");
const expectStep = async (number, title) => {
  assert.match(await card.innerText(), new RegExp(`STEP 0${number} / 03`));
  assert.equal(await card.locator("h2").innerText(), `STAGE 01. ${title}`);
  assert.equal(await page.locator(".game-location").count(), 0);
  assert.equal(
    await card.locator(".mission-location").innerText(),
    "거인의 연구실",
  );
  assert.equal(await card.locator(".mission-track .done").count(), number - 1);
  assert.equal(await card.locator(".mission-track .active").count(), 1);
};
async function collect(pos, size) {
  await page.evaluate(
    async ({ pos, size }) => {
      const { updateLab } = await import("/src/stages/lab/gameplay.ts");
      updateLab({
        pos,
        size,
        dt: 0,
        runtime: { previous: 1, clearTime: 0 },
        fits: () => true,
        changeSize: () => true,
        die: () => {},
      });
    },
    { pos, size },
  );
}
async function checkBounds() {
  const bounds = await card.boundingBox();
  const toast = await tutorial.boundingBox();
  const viewport = page.viewportSize();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
  assert(toast.x >= 0 && toast.x + toast.width <= viewport.width);
  const label = await card.locator(".mission-label").evaluate((el) => ({
    width: el.clientWidth,
    scroll: el.scrollWidth,
  }));
  assert(label.scroll <= label.width, "stage title and step fit in one row");
  const inventory = await page.locator(".chip-hud").boundingBox();
  assert(
    bounds.y + bounds.height <= inventory.y,
    "objective does not overlap inventory",
  );
}
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5178/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.waitForFunction(
    () => window.__quantumGame?.getState().lab.time > 0.1,
  );
  await expectStep(1, "명령 블록 모으기");
  assert.equal(
    (await tutorial.innerText()).replace("✦\n", "✦"),
    "✦WASD로 이동하고, E를 눌러 명령 블록을 수집하세요!",
  );
  await checkBounds();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/lab-objective-step1.png" });
  await collect([-8, 2.8, 7], 1);
  assert.match(await tutorial.innerText(), /명령 블록 획득! 모은 블록으로/);
  await expectStep(1, "명령 블록 모으기");
  await collect([8, 0, 8], 1);
  await collect([-8, 0, 22], 0.25);
  await expectStep(2, "탈출 프로그램 만들기");
  assert.match(await tutorial.innerText(), /모든 블록을 모았어요!/);
  await checkBounds();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/lab-objective-step2.png" });
  await page.evaluate(async () => {
    window.__quantumGame.getState().patch({ pos: [0, 0, 10] });
    const { interactLab } = await import("/src/stages/lab/gameplay.ts");
    interactLab();
  });
  assert.match(await tutorial.innerText(), /블록을 드래그해 순서대로 배치/);
  for (const label of ["전원 작동", "배터리 연결", "환풍구 이동"])
    await page
      .locator(".escape-palette")
      .getByRole("button", { name: label })
      .click();
  await expectStep(3, "실행하고 탈출하기");
  // The wrong order remains executable: objective assembly must not solve or
  // constrain the existing puzzle, and failure must keep the code editable.
  await page.locator(".run-actions .primary").click();
  await page.waitForFunction(
    () => window.__quantumGame.getState().lab.run === "failed",
  );
  assert.match(
    await tutorial.innerText(),
    /명령 블록의 순서를 확인하고 다시 실행/,
  );
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/lab-objective-failure.png" });
  assert.equal(
    await page.getByRole("button", { name: "1번 블록 삭제" }).isEnabled(),
    true,
  );
  await page.waitForTimeout(5300);
  assert.equal(await tutorial.count(), 0, "tutorial expires automatically");
  await page.locator(".run-actions .primary").click();
  await page.waitForFunction(
    () => window.__quantumGame.getState().lab.run === "failed",
  );
  assert.equal(
    await tutorial.count(),
    0,
    "failure tutorial appears once per attempt session",
  );
  await page.getByRole("button", { name: /탐험으로 돌아가기/ }).click();
  await expectStep(3, "실행하고 탈출하기");
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/lab-objective-step3.png" });
  await page.evaluate(() =>
    window.__quantumGame.getState().patch({ panel: "power" }),
  );
  assert.equal(await tutorial.count(), 0, "console tutorial does not repeat");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() =>
    window.__quantumGame.getState().start("codmos_nova"),
  );
  await page.waitForFunction(
    () => window.__quantumGame.getState().lab.time > 0.1,
  );
  await expectStep(1, "명령 블록 모으기");
  assert.match(await tutorial.innerText(), /WASD로 이동/);
  await checkBounds();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/lab-objective-mobile.png" });
  await collect([-8, 2.8, 7], 1);
  await collect([8, 0, 8], 1);
  await collect([-8, 0, 22], 0.25);
  await expectStep(2, "탈출 프로그램 만들기");
  await checkBounds();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/lab-objective-mobile-step2.png" });
  // Shared HUD applies the same location/title treatment to every playable stage.
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patchLab({ cleared: true });
    s.start("codmos_nova", 2);
  });
  for (const [index, title] of [
    "자동 축소 슈트 개발",
    "레이저 통과",
    "수호자 전투",
  ].entries()) {
    await page.evaluate(
      (mission) => window.__quantumGame.getState().patchCircuit({ mission }),
      index,
    );
    assert.equal(await card.locator("h2").innerText(), `STAGE 02. ${title}`);
    assert.equal(
      await card.locator(".mission-location").innerText(),
      "마이크로 회로",
    );
    assert.equal(await page.locator(".game-location").count(), 0);
  }
  assert.deepEqual(errors, []);
  console.log(
    "OBJECTIVE QA PASS: steps, all five tutorials, expiry/deduplication, retry, restart, desktop/mobile bounds; no browser errors",
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/lab-objective-qa-failure.png" });
  throw error;
} finally {
  await browser.close();
}
