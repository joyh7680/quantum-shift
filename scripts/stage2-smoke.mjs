import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Development fixtures isolate Stage 2 from collection-route changes. Optional
// transition mode runs the real Stage 1 program and verifies its release gate.
// Only development fixtures below enter the unreleased Stage 2 scene.
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const url = process.env.QC_QA_URL || "http://127.0.0.1:5173/";
const transition = process.env.QC_QA_STAGE1_TRANSITION === "1";
page.on("pageerror", (error) => errors.push(error.message));
const state = () =>
  page.evaluate(() => {
    const s = window.__quantumGame.getState();
    return JSON.parse(JSON.stringify(s));
  });
async function waitFor(predicate, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const s = await state();
    if (predicate(s)) return s;
    await page.waitForTimeout(80);
  }
  throw new Error(`${label}: ${JSON.stringify(await state())}`);
}
async function move(x, z) {
  const deadline = Date.now() + 30000;
  let held = [];
  try {
    while (Date.now() < deadline) {
      const s = await state();
      if (s.screen === "clear") return;
      assert.equal(s.panel, null);
      const dx = x - s.pos[0],
        dz = z - s.pos[2];
      if (Math.hypot(dx, dz) < 0.3) return;
      const next = [];
      if (Math.abs(dx) > 0.16) next.push(dx > 0 ? "KeyA" : "KeyD");
      if (Math.abs(dz) > 0.16) next.push(dz > 0 ? "KeyW" : "KeyS");
      for (const key of held)
        if (!next.includes(key)) await page.keyboard.up(key);
      for (const key of next)
        if (!held.includes(key)) await page.keyboard.down(key);
      held = next;
      await page.waitForTimeout(60);
    }
    throw new Error(`Movement stuck: ${JSON.stringify(await state())}`);
  } finally {
    for (const key of held) await page.keyboard.up(key);
  }
}
try {
  await page.goto(url);
  await page.waitForFunction(() => !!window.__quantumGame);
  if (transition) {
    await page.evaluate(() => {
      const s = window.__quantumGame.getState();
      s.start(s.character, 1);
      s.patchLab({
        chips: ["battery", "power", "vent"],
        code: ["giant", "battery", "normal", "power", "tiny", "vent"],
        time: 75,
        deaths: 2,
      });
      s.patch({ panel: "power" });
    });
    await page.locator(".run-actions .primary").click();
    await waitFor(
      (s) => s.screen === "clear" && s.lab.cleared,
      "Real Stage 1 program clear",
      90000,
    );
    assert.equal((await state()).activeStage, 1);
    assert.equal((await state()).lab.run, "success");
    assert.equal((await state()).circuit.time, 0);
    await page.getByRole("button", { name: "클리어 기록 보기" }).click();
    await page.evaluate(() => window.__quantumGame.getState().nextStage());
    assert.equal((await state()).activeStage, 1, "Stage 2 remains locked");
  } else {
    await page.evaluate(() => {
      const s = window.__quantumGame.getState();
      s.patchLab({ cleared: true, time: 75, deaths: 2 });
    });
  }
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patch({
      activeStage: 2,
      screen: "game",
      size: 1,
      pos: [0, 0, 32],
      panel: null,
    });
  });
  await waitFor((s) => s.circuit.time > 0.5, "Stage 2 ready");
  const lab = JSON.stringify((await state()).lab);
  assert.equal((await state()).circuit.mission, 0);
  assert.equal(await page.locator(".ability-card").count(), 1);
  await page.screenshot({ path: "artifacts/stage2-start.png" });
  // The suit gate stays shut before development and testing.
  await move(0, 39);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(800);
  await page.keyboard.up("KeyW");
  assert.ok((await state()).pos[2] < 40);
  await move(-2, 34);
  await page.keyboard.press("KeyE");
  await page.getByRole("dialog", { name: "슈트 개발" }).waitFor();
  const generate = page.getByRole("button", { name: "능력 생성하기" });
  const equip = page.getByRole("button", { name: "슈트에 장착" });
  assert.equal(await generate.isDisabled(), true);
  await page
    .getByPlaceholder("명령어를 입력해보세요")
    .fill("레이저가 오면 작아지고 원래 크기로 돌아와");
  await generate.click();
  assert.equal(await equip.isDisabled(), true);
  const paused = (await state()).circuit.time;
  await page.getByRole("button", { name: /능력 테스트/ }).click();
  await waitFor((s) => s.circuit.tested, "Suit test");
  assert.equal((await state()).circuit.time, paused);
  await equip.click();
  assert.equal((await state()).circuit.mission, 1);
  await move(0, 38);
  await page.keyboard.press("KeyQ");
  await page.keyboard.down("KeyW");
  await waitFor((s) => s.circuit.deaths === 1, "Laser hit");
  await page.keyboard.up("KeyW");
  await waitFor((s) => Math.abs(s.pos[2] - 38) < 0.4, "Independent checkpoint");
  assert.equal((await state()).size, 1);
  assert.equal((await state()).circuit.equipped, true);
  await page.keyboard.press("KeyQ");
  await move(0, 44);
  assert.equal((await state()).size, 0.25);
  await move(0, 55.8);
  await waitFor((s) => s.circuit.pendingRestore, "Wait below ceiling");
  assert.equal((await state()).size, 0.25);
  await move(0, 58);
  await waitFor((s) => !s.circuit.automatic, "Restore when safe");
  assert.equal((await state()).size, 1);
  assert.equal((await state()).circuit.mission, 2);
  await move(0, 62);
  for (let hp = 3; hp > 0; hp--) {
    await waitFor(
      (s) => s.circuit.bossPhase === "weak" && !s.circuit.automatic,
      `Weak point ${hp}`,
    );
    await page.keyboard.press("Digit3");
    await page.keyboard.press("KeyE");
    await waitFor((s) => s.circuit.bossHP === hp - 1, `Hit ${hp}`);
  }
  assert.equal((await state()).circuit.cleared, false);
  await move(4.5, 65);
  await move(4.5, 71.5);
  await move(0, 72);
  await move(0, 76);
  await waitFor((s) => s.screen === "clear", "Stage 2 clear");
  assert.equal((await state()).circuit.cleared, true);
  assert.equal(JSON.stringify((await state()).lab), lab);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/stage2-result.json",
    JSON.stringify(
      { passed: true, url, transition, errors, state: await state() },
      null,
      2,
    ),
  );
  console.log(
    "STAGE 2 PASS: development, test/equip gate, laser death/checkpoint, shrink/wait/restore, three guardian hits, independent clear/stats",
  );
} catch (error) {
  await page
    .screenshot({ path: "artifacts/stage2-failure.png" })
    .catch(() => {});
  console.error(error);
  if (errors.length) console.error("Browser errors:", errors);
  fs.writeFileSync(
    "artifacts/stage2-result.json",
    JSON.stringify(
      {
        passed: false,
        url,
        transition,
        error: String(error),
        errors,
        state: await state().catch(() => null),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
