import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const inventory = page.locator(".chip-hud");
const notice = page.locator(".command-acquisition");
const tooltip = page.getByRole("tooltip");
const hints = {
  battery: "무거운 배터리를 옮기려면 어떤 크기가 필요할까요?",
  power: "전원 버튼은 어떤 크기에서 누르기 쉬울까요?",
  vent: "좁은 환풍구를 지나가려면 어떻게 해야 할까요?",
};
fs.mkdirSync("artifacts/command-inventory", { recursive: true });

async function checkHint(id) {
  const row = inventory.locator(`[data-command="${id}"]`);
  const before = await inventory.boundingBox();
  const bounds = await row.boundingBox();
  // Include both padded edges, the name and the status icon in the hover target.
  for (const x of [2, bounds.width / 2, bounds.width - 2]) {
    await row.hover({ position: { x, y: bounds.height / 2 } });
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(`힌트${hints[id]}`);
    assert.equal(
      await row.getAttribute("aria-describedby"),
      await tooltip.getAttribute("id"),
    );
    assert.deepEqual(
      await inventory.boundingBox(),
      before,
      "hint does not move inventory",
    );
  }
  const hintBounds = await tooltip.boundingBox();
  const viewport = page.viewportSize();
  assert(
    hintBounds.x >= 12 &&
      hintBounds.x + hintBounds.width <= viewport.width - 12,
  );
  assert(
    hintBounds.y >= 12 &&
      hintBounds.y + hintBounds.height <= viewport.height - 12,
  );
  await page.mouse.move(viewport.width - 2, viewport.height - 2);
  await expect(tooltip).toHaveCount(0);
}

async function collect(id) {
  await page.evaluate(async (id) => {
    const { updateLab } = await import("/src/stages/lab/gameplay.ts");
    const locations = {
      battery: { pos: [-8, 2.8, 7], size: 1 },
      power: { pos: [8, 0, 8], size: 1 },
      vent: { pos: [-8, 0, 22], size: 0.25 },
    };
    updateLab({
      ...locations[id],
      dt: 0,
      runtime: { previous: 1, clearTime: 0 },
      fits: () => true,
      changeSize: () => true,
      die: () => {},
    });
  }, id);
  await expect(inventory.locator(`[data-command="${id}"]`)).toHaveClass(
    "found",
  );
}
async function checkLayout() {
  const bounds = await inventory.boundingBox();
  const objective = await page.locator(".mission-card").boundingBox();
  const scale = await page.locator(".size-control").boundingBox();
  const { width, height } = page.viewportSize();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
  assert(
    bounds.y >= objective.y + objective.height,
    `inventory clears objective: ${JSON.stringify({ bounds, objective, width, height })}`,
  );
  assert(
    bounds.y - (objective.y + objective.height) <= 16,
    "inventory sits directly below stage guide",
  );
  assert.equal(bounds.x, objective.x, "inventory aligns with stage guide");
  assert.equal(await page.locator(".pause-button").count(), 0);
  const controls = await page.locator(".game-controls").boundingBox();
  assert(
    controls && controls.x > width / 2 && controls.y < 50,
    "key guide is visible at the top right",
  );
  assert(bounds.y + bounds.height <= height);
  assert(
    bounds.x + bounds.width <= scale.x || bounds.y + bounds.height <= scale.y,
    "inventory clears size control",
  );
  const rows = await inventory.locator("li").evaluateAll((rows) =>
    rows.map((row) => {
      const bounds = row.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, height: bounds.height };
    }),
  );
  assert(rows.every((row) => row.x === rows[0].x));
  assert(rows[1].y >= rows[0].y + rows[0].height);
  assert(rows[2].y >= rows[1].y + rows[1].height);
}
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5180/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.waitForFunction(
    () => window.__quantumGame?.getState().lab.time > 0.1,
  );
  // Stop world updates so layout and notification timings are deterministic.
  await page.evaluate(() =>
    window.__quantumGame.getState().patch({ panel: "pause" }),
  );
  await page
    .locator(".pause-scrim")
    .evaluate((el) => (el.style.display = "none"));
  assert.match(
    await inventory.innerText(),
    /COMMAND BLOCK INVENTORY\n명령 블록 수집함 0\/3/,
  );
  assert.equal(await inventory.locator(".locked").count(), 3);
  assert.equal(await inventory.locator("li svg").count(), 6);
  await expect(inventory.locator(".chip-hud-help")).toHaveText(
    "각 블록에 마우스를 올리면 힌트를 볼 수 있어요.",
  );
  for (const id of Object.keys(hints)) await checkHint(id);
  await inventory.locator('[data-command="battery"]').click();
  await expect(inventory.locator(".locked")).toHaveCount(3);
  await expect(notice).toHaveCount(0);
  await page.mouse.move(1278, 718);
  await expect(tooltip).toHaveCount(0);
  await page
    .locator(":focus")
    .evaluateAll((elements) => elements.forEach((el) => el.blur()));
  await checkLayout();
  await page.screenshot({ path: "artifacts/command-inventory/empty.png" });

  await collect("power");
  await notice.waitFor();
  assert.match(await notice.innerText(), /명령 블록 획득!\n전원 작동 \(1\/3\)/);
  const power = inventory.locator('[data-command="power"]');
  assert.equal(await power.getAttribute("class"), "found");
  assert.equal(await power.getAttribute("aria-label"), "전원 작동: 수집 완료");
  assert.equal(
    await power.evaluate((el) => getComputedStyle(el).color),
    "rgb(255, 148, 199)",
  );
  assert.equal(
    await power.evaluate((el) => getComputedStyle(el).animationName),
    "chipActivate",
  );
  await page.waitForTimeout(2800);
  assert.equal(await notice.count(), 0, "acquisition expires within 3 seconds");
  await collect("power");
  assert.equal(await notice.count(), 0, "same item cannot notify twice");

  await page.evaluate(async () => {
    const { interactLab } = await import("/src/stages/lab/gameplay.ts");
    window.__quantumGame.getState().patch({ panel: null, pos: [0, 0, 10] });
    interactLab();
  });
  await expect(inventory).toBeHidden();
  assert.equal(
    await page.getByRole("heading", { name: "블록 보관함" }).isVisible(),
    true,
  );
  assert.equal(
    await page
      .locator(".escape-palette")
      .getByRole("button", { name: "전원 작동" })
      .isEnabled(),
    true,
  );
  await page.getByRole("button", { name: /탐험으로 돌아가기/ }).click();
  await expect(inventory).toBeVisible();
  assert.match(await inventory.innerText(), /명령 블록 수집함 1\/3/);
  assert.equal(
    await notice.count(),
    0,
    "returning to exploration does not replay acquisition",
  );

  await collect("battery");
  assert.match(await notice.innerText(), /배터리 연결 \(2\/3\)/);
  assert.equal(
    await inventory
      .locator('[data-command="battery"]')
      .evaluate((el) => getComputedStyle(el).color),
    "rgb(255, 218, 117)",
  );
  await collect("vent");
  assert.match(await notice.innerText(), /환풍구 이동 \(3\/3\)/);
  assert.match(await notice.innerText(), /3\/3 완료! 탈출 콘솔로 이동하세요\./);
  assert.equal(await page.locator(".collection-complete").count(), 1);
  assert.equal(await inventory.locator(".found").count(), 3);
  for (const id of Object.keys(hints)) {
    await checkHint(id);
    assert.equal(
      await inventory
        .locator(`[data-command="${id}"] .chip-status-icon`)
        .evaluate((el) => getComputedStyle(el).color),
      "rgb(112, 242, 205)",
    );
  }
  assert.equal(
    await inventory
      .locator('[data-command="vent"]')
      .evaluate((el) => getComputedStyle(el).color),
    "rgb(112, 242, 205)",
  );
  assert.match(await page.locator(".mission-card").innerText(), /STEP 02/);
  await page.screenshot({
    path: "artifacts/command-inventory/complete.png",
    animations: "disabled",
  });
  await page.waitForTimeout(3100);
  await expect(notice).toHaveCount(0);

  await page.evaluate(() =>
    window.__quantumGame.getState().patch({ panel: "power" }),
  );
  await expect(inventory).toBeHidden();
  await expect(tooltip).toHaveCount(0);
  await page.screenshot({ path: "artifacts/command-inventory/coding.png" });
  await page.getByRole("button", { name: /탐험으로 돌아가기/ }).click();
  assert.equal(await inventory.locator(".found").count(), 3);
  assert.equal(await notice.count(), 0);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 900, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    await checkLayout();
    for (const id of Object.keys(hints)) await checkHint(id);
    await inventory.locator('[data-command="vent"]').hover();
    await page.screenshot({
      path: `artifacts/command-inventory/layout-${viewport.width}.png`,
      animations: "disabled",
    });
    await page.mouse.move(viewport.width - 2, viewport.height - 2);
  }
  const focusedRow = inventory.locator('[data-command="battery"]');
  await page.keyboard.press("Tab");
  await focusedRow.focus();
  await expect(tooltip).toHaveText(`힌트${hints.battery}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(
      async () =>
        (await tooltip.boundingBox()).x + (await tooltip.boundingBox()).width,
    )
    .toBeLessThanOrEqual(378);
  await focusedRow.evaluate((el) => el.blur());
  await expect(tooltip).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await power.evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.evaluate(() =>
    window.__quantumGame.getState().start("codmos_nova"),
  );
  await expect(inventory.locator(".locked")).toHaveCount(3);
  assert.equal(await notice.count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: collection, SVG/color/lock/check states, all-row hints before/after collection, no click-to-collect, viewport positioning, keyboard focus, expiry, completion/STEP 02, panel persistence, desktop/mobile layout, reduced motion and restart; no browser errors",
  );
} catch (error) {
  await page
    .screenshot({
      path: "artifacts/command-inventory/failure.png",
      animations: "disabled",
    })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
