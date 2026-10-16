import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const inventory = page.locator(".chip-hud");
const notice = page.locator(".command-acquisition");
const tooltip = page.getByRole("tooltip");
const hints = {
  battery: "무거운 배터리를 정지 장치에 연결하려면 어떤 크기가 필요할까요?",
  power: "정지 장치의 전원 차단 버튼은 어떤 크기에서 누르기 쉬울까요?",
  vent: "전원이 차단되어 팬이 멈추면 어떤 크기로 환풍구를 통과할까요?",
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
      battery: { pos: [-8, 2.8, 7], size: 2.5 },
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
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patch({
      panel: "pause",
      labTutorial: { ...s.labTutorial, phase: "done" },
    });
  });
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
  console.log("PASS: empty inventory, hover hints and layout");

  await collect("power");
  console.log("PASS: power block collection");
  await notice.waitFor();
  assert.match(await notice.innerText(), /명령 블록 획득!\n전원 차단 \(1\/3\)/);
  const power = inventory.locator('[data-command="power"]');
  assert.equal(await power.getAttribute("class"), "found");
  assert.equal(await power.getAttribute("aria-label"), "전원 차단: 수집 완료");
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
  await expect(inventory).toBeVisible();
  await expect(page.locator(".escape-editor")).toHaveCount(0);
  assert.equal(
    await page.evaluate(() => window.__quantumGame.getState().panel),
    null,
    "console requires all three blocks",
  );
  // Pause the world again while checking collection and notifications.
  await page.evaluate(() =>
    window.__quantumGame.getState().patch({ panel: "pause" }),
  );
  await page
    .locator(".pause-scrim")
    .evaluate((el) => (el.style.display = "none"));
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
  console.log("PASS: all three blocks collected");
  assert.match(await notice.innerText(), /환풍기 멈춤 \(3\/3\)/);
  assert.match(await notice.innerText(), /3\/3 완료! 탈출 콘솔로 이동하세요\./);
  assert.equal(await page.locator(".collection-complete").count(), 1);
  assert.equal(await inventory.locator(".found").count(), 3);
  for (const id of Object.keys(hints)) {
    await checkHint(id);
    assert.equal(
      await inventory
        .locator(`[data-command="${id}"] .chip-status-icon`)
        .evaluate((el) => getComputedStyle(el).color),
      await inventory
        .locator(`[data-command="${id}"]`)
        .evaluate((el) => getComputedStyle(el).color),
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

  await page.evaluate(async () => {
    const { interactLab } = await import("/src/stages/lab/gameplay.ts");
    window.__quantumGame.getState().patch({ panel: null, pos: [0, 0, 10] });
    interactLab();
  });
  await expect(inventory).toBeVisible();
  await expect(tooltip).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "블록 보관함" }),
  ).toBeVisible();
  const palette = page.locator(".escape-palette");
  const labels = ["배터리 연결", "전원 차단", "환풍기 멈춤"];
  for (const label of labels) {
    const block = palette.getByRole("button", { name: label, exact: true });
    await expect(block).toBeEnabled();
    // Exercise native palette drag/drop and click insertion with the same IDs.
    if (label === "배터리 연결") await block.dragTo(page.locator(".code-drop"));
    else await block.click();
  }
  await expect(page.locator(".escape-code li b")).toHaveText(labels);
  console.log("PASS: renamed palette and code labels, original drag/drop IDs");
  assert.deepEqual(
    await page.evaluate(() => window.__quantumGame.getState().lab.code),
    ["battery", "power", "vent"],
  );
  const codeBlocks = page.locator(".command-code-block");
  // Dispatch the code drag events explicitly: native headless dragging can
  // lose its drop target when this scrollable list moves during the gesture.
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await codeBlocks
    .nth(0)
    .dispatchEvent("dragstart", { dataTransfer: transfer });
  await page
    .locator(".code-drop")
    .dispatchEvent("dragover", { dataTransfer: transfer });
  await page
    .locator(".code-drop")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await codeBlocks.nth(2).dispatchEvent("dragend", { dataTransfer: transfer });
  await transfer.dispose();
  await expect(page.locator(".escape-code li b")).toHaveText([
    "전원 차단",
    "환풍기 멈춤",
    "배터리 연결",
  ]);
  await page.locator(".run-actions .primary").click();
  await expect(page.locator(".run-feedback")).toHaveText(
    "배터리가 연결되지 않았어요.",
  );
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  for (const label of [
    "거대화",
    "배터리 연결",
    "일반 크기로 변환",
    "전원 차단",
    "초소형으로 변환",
    "환풍기 멈춤",
  ])
    await palette.getByRole("button", { name: label }).click();
  await expect(page.locator(".escape-objective")).toContainText(
    "환풍기 전원을 차단",
  );
  await page.screenshot({ path: "artifacts/command-inventory/coding.png" });
  console.log("PASS: code reorder, failed sequence and mission guidance");
  await page.getByRole("button", { name: /탐험으로 돌아가기/ }).click();
  assert.equal(await inventory.locator(".found").count(), 3);
  assert.equal(await notice.count(), 0);

  // Execute the same IDs through real movement, fan deceleration and vent exit.
  await page.evaluate(() =>
    window.__quantumGame.getState().patch({ panel: "power" }),
  );
  await page.locator(".run-actions .primary").click();
  await page.waitForFunction(
    () => {
      const { lab } = window.__quantumGame.getState();
      return lab.power && lab.fan > 0 && lab.fan < 1;
    },
    null,
    { timeout: 90000 },
  );
  await expect(page.locator(".run-feedback")).toHaveText(
    "전원 차단 완료 · 환풍기 팬이 감속하고 있어요.",
  );
  await page.waitForFunction(
    () => window.__quantumGame.getState().lab.run === "success",
    null,
    { timeout: 90000 },
  );
  const escaped = await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    return {
      battery: s.lab.battery,
      power: s.lab.power,
      fan: s.lab.fan,
      size: s.size,
      z: s.pos[2],
    };
  });
  assert.equal(escaped.battery, "installed");
  assert.equal(escaped.power, true);
  assert.equal(escaped.fan, 0);
  assert.equal(escaped.size, 0.25);
  assert(escaped.z > 28);
  await page.screenshot({ path: "artifacts/command-inventory/escaped.png" });
  console.log("PASS: real program execution and tiny vent escape");
  // Restore only the UI for responsive inventory checks after the successful run.
  await page.evaluate(() =>
    window.__quantumGame.getState().patch({ screen: "game", panel: "pause" }),
  );
  await page
    .locator(".pause-scrim")
    .evaluate((el) => (el.style.display = "none"));
  await page.waitForTimeout(500);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 900, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(500);
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
