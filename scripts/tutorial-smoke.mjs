import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const url = process.env.QC_QA_URL || "http://127.0.0.1:5173/";
const state = () =>
  page.evaluate(() => {
    const s = window.__quantumGame.getState();
    return {
      tutorial: s.labTutorial,
      pos: s.pos,
      size: s.size,
      panel: s.panel,
      time: s.lab.time,
      chips: s.lab.chips,
      mission: s.lab.mission,
    };
  });
async function waitFor(fn, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (fn(await state())) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label}: ${JSON.stringify(await state())}`);
}
async function move(x, z, stopOnArrival = false) {
  const deadline = Date.now() + 90000;
  let held = [];
  try {
    while (Date.now() < deadline) {
      const { pos, panel, tutorial } = await state();
      assert.equal(panel, null);
      if (stopOnArrival && tutorial.phase !== "active") return;
      const dx = x - pos[0],
        dz = z - pos[2];
      if (Math.hypot(dx, dz) < 0.3) return;
      const next = [];
      if (Math.abs(dx) > 0.16) next.push(dx > 0 ? "KeyA" : "KeyD");
      if (Math.abs(dz) > 0.16) next.push(dz > 0 ? "KeyW" : "KeyS");
      for (const key of held)
        if (!next.includes(key)) await page.keyboard.up(key);
      for (const key of next)
        if (!held.includes(key)) await page.keyboard.down(key);
      held = next;
      await page.waitForTimeout(90);
    }
    throw new Error(`Movement stuck: ${JSON.stringify(await state())}`);
  } finally {
    for (const key of held) await page.keyboard.up(key);
  }
}
async function screenshot(name) {
  if (!["01-success", "complete", "handoff"].includes(name))
    await page.waitForTimeout(450);
  await page.screenshot({ path: `artifacts/tutorial-${name}.png` });
}
try {
  await page.goto(url);
  await page.waitForFunction(() => !!window.__quantumGame);
  await page.evaluate(() =>
    window.__quantumGame.getState().start("codmos_nova", 1),
  );
  await waitFor((s) => s.time > 0.3, "assets and physics ready");
  await page.locator(".lab-tutorial").waitFor();
  assert.equal(
    await page.locator(".lab-tutorial h2").innerText(),
    "STEP 1. 캐릭터 이동",
  );
  assert.equal(
    await page.locator(".lab-tutorial p").innerText(),
    "WASD 키를 눌러 캐릭터를 이동해 보세요.",
  );
  await screenshot("01");
  await page.keyboard.press("KeyE");
  assert.equal((await state()).tutorial.phase, "active");
  await page.keyboard.down("KeyW");
  await waitFor((s) => s.tutorial.phase === "success", "real movement");
  await page.keyboard.up("KeyW");
  await screenshot("01-success");
  // Pausing must freeze the success hold, then resume at the same step.
  await page.keyboard.press("Escape");
  const paused = (await state()).tutorial;
  await page.waitForTimeout(1700);
  assert.deepEqual((await state()).tutorial, paused);
  assert.equal(await page.locator(".lab-tutorial").count(), 0);
  await page.getByRole("button", { name: "게임으로 돌아가기" }).click();
  await waitFor(
    (s) => s.tutorial.step === 2 && s.tutorial.phase === "active",
    "step 2",
  );
  await screenshot("02");
  assert.equal(
    await page.locator(".lab-tutorial h2").innerText(),
    "STEP 2. 크기 변환",
  );
  await page.keyboard.press("Digit2");
  await page.waitForTimeout(150);
  assert.equal(
    (await state()).tutorial.phase,
    "active",
    "same size is not a transformation",
  );
  await page.keyboard.press("Digit1");
  await waitFor(
    (s) => s.size === 0.25 && s.tutorial.phase === "success",
    "real size change",
  );
  await waitFor(
    (s) => s.tutorial.step === 3 && s.tutorial.phase === "active",
    "step 3",
  );
  await page.locator(".tutorial-battery-beacon").waitFor();
  assert.equal(
    await page.locator(".lab-tutorial h2").innerText(),
    "STEP 3. 첫 번째 미션 도전",
  );
  assert.equal(await page.locator(".tutorial-giant-pulse").count(), 1);
  assert.equal(
    await page
      .locator(".chip-hud [data-command=power]")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await screenshot("03");
  await move(-3, 8);
  await move(-3, 14);
  assert.equal(
    (await state()).tutorial.phase,
    "active",
    "distant battery is not arrival",
  );
  await move(-4, 16);
  assert.equal(
    (await state()).tutorial.phase,
    "active",
    "the heavy floor battery is not the tutorial target",
  );
  // Isolate the target correction from the existing stair-jump challenge.
  // From the fourth book, use actual keyboard movement to approach the item.
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patchLab({ checkpoint: [-8, 2.65, 4.7] });
    s.patch({ respawn: s.respawn + 1 });
  });
  await waitFor(
    (s) => s.pos[1] > 2.4 && s.pos[0] < -7.5 && s.pos[2] > 4.5,
    "stair fixture ready",
  );
  await page.keyboard.press("Digit1");
  assert.equal((await state()).tutorial.phase, "active");
  await move(-8, 4.35, true);
  assert.equal(
    (await state()).tutorial.phase,
    "active",
    "tiny arrival must not complete step 3",
  );
  // Observe transitions in the browser so slow screenshot/IPC calls cannot
  // miss the short completion card or distort the physics-clock durations.
  await page.evaluate(() => {
    window.__tutorialPhases = {};
    window.__tutorialCards = {};
    window.__quantumGame.subscribe((s, previous) => {
      if (s.labTutorial.phase !== previous.labTutorial.phase)
        window.__tutorialPhases[s.labTutorial.phase] = s.lab.time;
    });
    new MutationObserver(() => {
      const s = window.__quantumGame.getState();
      const card = document.querySelector(".lab-tutorial");
      const phase = s.labTutorial.phase;
      const title = card?.querySelector("h2")?.textContent;
      if (
        (phase === "complete" && title === "🎉 튜토리얼 완료!") ||
        (phase === "handoff" &&
          title === "이제 다음 명령어 블록을 수집해 봐요!")
      ) {
        window.__tutorialCards[phase] = {
          text: card.textContent,
          size: s.size,
          chips: s.lab.chips,
          mission: s.lab.mission,
          hiddenControls: document.querySelectorAll(
            ".tutorial-count, .tutorial-progress, .lab-tutorial button, .tutorial-battery-beacon, .tutorial-giant-pulse, .toast",
          ).length,
          check: card.classList.contains("is-complete"),
          sparkles: !!card.querySelector(".tutorial-sparkles"),
        };
      }
    }).observe(document.querySelector(".hud"), {
      subtree: true,
      childList: true,
      attributes: true,
    });
  });
  await page.keyboard.press("Digit3");
  await waitFor((s) => s.tutorial.phase === "complete", "completion message");
  await screenshot("complete");
  await waitFor(
    (s) => ["handoff", "leaving", "done"].includes(s.tutorial.phase),
    "next block toast",
  );
  if ((await state()).tutorial.phase === "handoff") await screenshot("handoff");
  await waitFor((s) => s.tutorial.phase === "done", "automatic handoff");
  const sequence = await page.evaluate(() => ({
    phases: window.__tutorialPhases,
    cards: window.__tutorialCards,
  }));
  const { complete, handoff } = sequence.cards;
  assert.ok(complete.text.includes("첫 번째 미션 성공! 잘했어요!"));
  assert.ok(
    !complete.text.includes("거대 크기로 변신하고 배터리로 이동하세요."),
  );
  assert.equal(complete.size, 2.5);
  assert.deepEqual(complete.chips, ["battery"]);
  assert.equal(complete.mission, 0);
  assert.equal(complete.hiddenControls, 0);
  assert.equal(complete.check, true);
  assert.equal(complete.sparkles, true);
  assert.equal(handoff.hiddenControls, 0);
  assert.equal(handoff.check, false);
  assert.equal(handoff.sparkles, false);
  assert.ok(
    Math.abs(sequence.phases.handoff - sequence.phases.complete - 2) < 0.05,
  );
  assert.ok(
    Math.abs(sequence.phases.leaving - sequence.phases.handoff - 3) < 0.05,
  );
  assert.equal(
    await page
      .locator(".lab-tutorial, .tutorial-link, .tutorial-battery-beacon")
      .count(),
    0,
  );
  assert.equal(await page.locator(".mission-card").count(), 1);
  assert.equal(await page.locator(".chip-hud").count(), 1);
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.die("QA");
    s.reset();
    s.start(s.character, 1);
  });
  assert.equal((await state()).tutorial.phase, "done");
  assert.equal(await page.locator(".lab-tutorial").count(), 0);

  // A fresh session exercises narrow layouts and the actual skip button.
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => !!window.__quantumGame);
  await page.evaluate(() =>
    window.__quantumGame.getState().start("codmos_nova", 1),
  );
  await waitFor((s) => s.time > 0.2, "mobile ready");
  await page.locator(".lab-tutorial").waitFor();
  await page.waitForTimeout(500);
  await screenshot("mobile");
  const layout = await page.evaluate(() => {
    const card = document
      .querySelector(".lab-tutorial")
      .getBoundingClientRect();
    const mission = document
      .querySelector(".mission-card")
      .getBoundingClientRect();
    return {
      left: card.left,
      right: card.right,
      bottom: card.bottom,
      missionTop: mission.top,
      width: innerWidth,
    };
  });
  assert.ok(layout.left >= 0 && layout.right <= layout.width);
  assert.ok(layout.bottom <= layout.missionTop, JSON.stringify(layout));
  for (const width of [768, 900, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(400);
    const overlap = await page.evaluate(() => {
      const a = document.querySelector(".lab-tutorial").getBoundingClientRect();
      const b = document.querySelector(".mission-card").getBoundingClientRect();
      return (
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top
      );
    });
    assert.equal(overlap, false, `tutorial overlaps mission at ${width}px`);
  }
  await page.getByRole("button", { name: "건너뛰기" }).click();
  assert.equal((await state()).tutorial.phase, "done");
  assert.equal(await page.locator(".tutorial-key-pulse").count(), 0);
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.reset();
    s.start(s.character, 1);
  });
  assert.equal((await state()).tutorial.phase, "done");
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patchLab({ cleared: true });
    // Inspect the draft scene directly; normal Stage 2 entry is locked.
    s.patch({
      activeStage: 2,
      screen: "game",
      size: 1,
      pos: [0, 0, 32],
      panel: null,
    });
  });
  assert.equal(
    await page
      .locator(
        ".lab-tutorial, .tutorial-link, .tutorial-battery-beacon, .tutorial-key-pulse, .tutorial-scale-pulse",
      )
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/tutorial-verification.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "real movement",
          "pause freezes timer",
          "same-size rejection",
          "real transformation",
          "giant battery arrival and real inventory completion",
          "tiny arrival rejection",
          "two second completion and three second next block toast",
          "no duplicate notices or power-block animation",
          "completion handoff",
          "session persistence",
          "mobile layout",
          "skip",
          "stage 2 isolation",
        ],
        layout,
        sequence,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Tutorial browser checks passed.");
} finally {
  await browser.close();
}
