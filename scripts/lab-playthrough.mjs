import assert from "node:assert/strict";
import { crossElectric, touchLiveTile } from "./lab-electric-control.mjs";
export async function runLab(page, { extended = true } = {}) {
  const state = () =>
    page.evaluate(() => {
      const s = window.__quantumGame.getState();
      return JSON.parse(JSON.stringify(s));
    });
  const wait = async (fn, label, timeout = 45000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const s = await state();
      if (fn(s)) return s;
      await page.waitForTimeout(75);
    }
    throw Error(`Timeout ${label}: ${JSON.stringify(await state())}`);
  };
  const move = async (x, z, tolerance = 0.3) => {
    console.log("MOVE", x, z);
    await page.evaluate(
      ([x, z, tolerance]) =>
        new Promise((resolve, reject) => {
          const store = window.__quantumGame;
          let held = [];
          const send = (type, key) =>
            window.dispatchEvent(
              new KeyboardEvent(type, { code: key, key, bubbles: true }),
            );
          const release = () => {
            for (const key of held) send("keyup", key);
            held = [];
          };
          let unsubscribe = () => {};
          const timer = setTimeout(() => {
            unsubscribe();
            release();
            reject(Error("Movement stuck " + JSON.stringify(store.getState())));
          }, 45000);
          const update = (s) => {
            if (s.panel) {
              clearTimeout(timer);
              unsubscribe();
              release();
              reject(Error("Unexpected panel " + s.panel));
              return;
            }
            const dx = x - s.pos[0],
              dz = z - s.pos[2];
            if (Math.hypot(dx, dz) < tolerance) {
              clearTimeout(timer);
              unsubscribe();
              release();
              resolve();
              return;
            }
            const next = [];
            if (Math.abs(dx) > 0.08) next.push(dx > 0 ? "KeyA" : "KeyD");
            if (Math.abs(dz) > 0.08) next.push(dz > 0 ? "KeyW" : "KeyS");
            for (const key of held) if (!next.includes(key)) send("keyup", key);
            // Reassert movement after checkpoint effects clear the game's key set.
            for (const key of next) send("keydown", key);
            held = next;
          };
          unsubscribe = store.subscribe((s, old) => {
            if (s.pos !== old.pos) update(s);
          });
          update(store.getState());
        }),
      [x, z, tolerance],
    );
  };
  const add = async (label) =>
    page
      .locator(".escape-palette")
      .getByRole("button", { name: label, exact: false })
      .click();
  const run = () => page.locator(".run-actions .primary").click();
  const clear = () =>
    page.getByRole("button", { name: "초기화", exact: true }).click();
  const back = () =>
    page.getByRole("button", { name: /탐험으로 돌아가기/ }).click();
  const open = async () => {
    const s = await state();
    await move(0, s.pos[2] > 10 ? 12 : 8);
    await page.keyboard.press("KeyE");
    await page.locator(".escape-editor").waitFor();
  };
  await wait((s) => s.lab.time > 0.3, "lab ready");
  assert.equal((await state()).activeStage, 1);
  const originalCharacter = (await state()).character;
  assert.equal(await page.locator(".ability-card").count(), 0);
  await page.screenshot({ path: "artifacts/lab-exploration.png" });
  await open();
  assert.equal((await state()).lab.code.length, 0);
  assert(await page.locator(".run-actions .primary").isDisabled());
  await add("거대화");
  await add("거대화");
  assert.equal((await state()).lab.code.length, 2, "repeat blocks");
  await page
    .getByRole("button", { name: "1번 블록 삭제", exact: true })
    .click();
  await clear();
  await back();
  // Walk through the low passage first: collecting order is independent of code.
  await move(-4, 13);
  await move(-8, 13);
  await page.keyboard.press("Digit2");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyW");
  assert(
    (await state()).pos[2] < 14,
    "normal collider blocked by low equipment",
  );
  await page.keyboard.press("Digit1");
  await move(-8, 18);
  await page.keyboard.press("Digit3");
  assert.equal((await state()).size, 0.25, "growth prevented under equipment");
  await page.screenshot({ path: "artifacts/lab-tiny-collision.png" });
  await move(-8, 22);
  await wait((s) => s.lab.chips.includes("vent"), "vent chip");
  console.log("COLLECTED vent");
  assert.equal((await state()).lab.power, false);
  await move(-8, 12.8);
  await page.keyboard.press("Digit2");
  await move(-4, 12);
  await move(-4, -4);
  await move(-8, -4);
  // Real jumps from one oversized book to the next, with landing checks.
  for (const [z, top] of [
    [-1.6, 0.65],
    [0.5, 1.3],
    [2.6, 1.95],
    [4.7, 2.6],
    [7, 2.8],
  ]) {
    await page.keyboard.press("Space");
    await move(-8, z, 0.35);
    await wait(
      (s) => Math.abs(s.pos[1] - top) < 0.12 && !s.airborne,
      "book landing " + z,
    );
  }
  await wait((s) => s.lab.chips.includes("battery"), "battery chip");
  console.log("COLLECTED battery");
  await page.screenshot({ path: "artifacts/lab-books-chip.png" });
  await move(-4, 7);
  await move(-4, -5.5);
  await move(8, -5.5);
  await move(8, -3);
  // Intentionally touch a live tile, verify checkpoint and retained chips.
  if (extended) {
    const before = (await state()).lab.deaths;
    await move(8, -0.5);
    await touchLiveTile(page);
    await wait((s) => Math.abs(s.pos[2] + 3) < 0.3, "electric checkpoint");
    assert.equal((await state()).lab.chips.length, 2);
  }
  await move(8, -0.6);
  await crossElectric(page);
  await move(8, 8);
  await wait((s) => s.lab.chips.length === 3, "all chips");
  console.log("COLLECTED all");
  assert.equal((await state()).lab.battery, "floor");
  assert.equal((await state()).lab.power, false);
  await page.screenshot({ path: "artifacts/lab-three-chips.png" });
  await move(8, -5.5);
  await move(3, -5.5);
  await open();
  await add("전원 작동");
  await run();
  await wait((s) => s.lab.run === "failed", "wrong order");
  assert.equal((await state()).lab.index, 0);
  assert.equal((await state()).lab.feedback, "배터리가 연결되지 않았어요.");
  await page.screenshot({ path: "artifacts/lab-wrong-order.png" });
  await clear();
  await add("거대화");
  await add("배터리 연결");
  await run();
  await wait((s) => s.lab.battery === "carried", "battery carry");
  assert(
    await page
      .getByRole("button", { name: "초기화", exact: true })
      .isDisabled(),
  );
  assert(await page.locator(".escape-palette button").first().isDisabled());
  await page.keyboard.press("Digit1");
  assert.equal((await state()).size, 2.5, "manual size locked while running");
  await page.getByRole("button", { name: "실행 중단", exact: true }).click();
  await wait(
    (s) => s.lab.run === "idle" && Math.abs(s.pos[2] - 13) < 0.3,
    "stop restoration",
  );
  assert.equal((await state()).lab.battery, "floor");
  assert.equal((await state()).lab.power, false);
  assert.equal((await state()).lab.fan, 1);
  assert.equal((await state()).size, 1);
  assert.equal((await state()).lab.chips.length, 3);
  assert.equal((await state()).lab.code.length, 2);
  await back();
  await open();
  assert.equal((await state()).lab.code.length, 2, "code survives exploration");
  await clear();
  // An extra harmless transform verifies condition execution, not exact array matching.
  for (const label of [
    "초소형으로 변환",
    "거대화",
    "배터리 연결",
    "일반 크기로 변환",
    "전원 작동",
    "초소형으로 변환",
    "환풍구 이동",
  ])
    await add(label);
  // Reordering via accessible controls and actual drag/drop.
  await page
    .getByRole("button", { name: "1번 블록 아래로", exact: true })
    .click();
  await page
    .getByRole("button", { name: "2번 블록 위로", exact: true })
    .click();
  const first = page.locator(".escape-code li").nth(0),
    second = page.locator(".escape-code li").nth(1);
  await first.dragTo(second); // adjacent insertion leaves it before the same neighbour
  assert.equal((await state()).lab.code[0], "tiny");
  await page.screenshot({ path: "artifacts/lab-code-desktop.png" });
  if (extended) {
    for (const [width, height] of [
      [1280, 720],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(400);
      for (const selector of [
        ".escape-editor",
        ".escape-editor footer",
        ".game-canvas",
      ]) {
        const b = await page.locator(selector).boundingBox();
        assert(
          b.x >= -1 &&
            b.y >= -1 &&
            b.x + b.width <= width + 1 &&
            b.y + b.height <= height + 1,
          selector + " fits " + width,
        );
      }
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no horizontal overflow",
      );
      await page.screenshot({ path: `artifacts/lab-code-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 960 });
  }
  await run();
  await wait(
    (s) => s.lab.power && s.lab.fan > 0 && s.lab.fan < 1,
    "fan slows",
    90000,
  );
  await page.screenshot({ path: "artifacts/lab-maintenance.png" });
  await wait((s) => s.screen === "clear", "escape clear", 90000);
  const result = await state();
  assert.equal(result.character, originalCharacter);
  assert.equal(result.lab.run, "success");
  assert.equal(result.lab.fan, 0);
  assert.equal(result.size, 0.25);
  assert(result.pos[2] > 28, "real character reached exit");
  assert.equal(result.circuit.equipped, false);
  assert.equal(result.circuit.time, 0);
  await page.screenshot({ path: "artifacts/lab-escape-clear.png" });
  return result;
}


