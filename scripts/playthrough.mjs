import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const suitOnly = process.env.QC_QA_SUIT_ONLY === "1";
page.on("pageerror", (e) => {
  console.log("PAGE ERROR", e.message);
  errors.push(e.message);
});
const state = () =>
  page.evaluate(() => {
    const s = window.__quantumGame.getState();
    return JSON.parse(JSON.stringify(s));
  });
const assert = (v, m) => {
  if (!v) throw Error(m);
};
const waitFor = async (fn, label, ms = 20000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const s = await state();
    if (fn(s)) return s;
    await page.waitForTimeout(100);
  }
  throw Error("Timeout " + label + " " + JSON.stringify(await state()));
};
async function move(x, z, tolerance = 0.3) {
  const until = Date.now() + 30000;
  let held = [];
  try {
    while (Date.now() < until) {
      const s = await state();
      if (s.screen === "clear") return;
      if (s.panel) throw Error("Unexpected panel " + s.panel);
      const dx = x - s.pos[0],
        dz = z - s.pos[2];
      if (Math.hypot(dx, dz) < tolerance) return;
      const next = [];
      if (Math.abs(dx) > 0.16) next.push(dx > 0 ? "KeyA" : "KeyD");
      if (Math.abs(dz) > 0.16) next.push(dz > 0 ? "KeyW" : "KeyS");
      for (const k of held) if (!next.includes(k)) await page.keyboard.up(k);
      for (const k of next) if (!held.includes(k)) await page.keyboard.down(k);
      held = next;
      await page.waitForTimeout(60);
    }
    throw Error("Movement stuck " + JSON.stringify(await state()));
  } finally {
    for (const k of held) await page.keyboard.up(k);
  }
}
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5173/");
  await page.waitForTimeout(6000);
  if (suitOnly) {
    // Isolate studio interactions from the preceding movement puzzles.
    await page.evaluate(() => {
      window.__quantumGame.getState().patch({
        screen: "game",
        panel: "suit",
        power: true,
        stage: 3,
      });
    });
  } else {
    await page.getByRole("button", { name: /게임 시작/ }).click();
    await waitFor((s) => s.time > 0.5, "simulation ready");
    await page.evaluate(() => {
      const useGame = window.__quantumGame;
      window.__maxJump = 0;
      const record = () => {
        window.__maxJump = Math.max(
          window.__maxJump,
          useGame.getState().pos[1],
        );
        requestAnimationFrame(record);
      };
      record();
    });
    await page.keyboard.press("Space");
    await page.waitForTimeout(600);
    assert(
      await page.evaluate(() => window.__maxJump > 0.2),
      "jump should leave ground",
    );
    await page.waitForTimeout(700);
    await move(0, 8);
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(650);
    await page.keyboard.up("KeyW");
    assert((await state()).pos[2] < 8.5, "normal capsule blocked by vent");
    await page.keyboard.press("Digit1");
    await move(0, 10);
    await page.keyboard.press("Digit3");
    assert((await state()).size === 0.25, "growth must be blocked inside vent");
    await page.screenshot({ path: "artifacts/vent-clearance.png" });
    await move(0, 18);
    assert((await state()).stage === 2, "vent milestone");
    await page.keyboard.press("Digit3");
    await move(-2.8, 18);
    await page.keyboard.press("KeyE");
    assert((await state()).battery === "carried", "giant battery pickup");
    await move(3.8, 20);
    await page.keyboard.press("KeyE");
    assert((await state()).battery === "installed", "battery socket");
    await page.keyboard.press("Digit2");
    await move(4, 22.7);
    await page.keyboard.press("KeyE");
    await page.getByRole("dialog", { name: "전원 알고리즘" }).waitFor();
    const pausedTime = (await state()).time;
    await page.waitForTimeout(300);
    assert((await state()).time === pausedTime, "coding panel pauses game");
    for (const n of ["A", "메인 전원", "B", "C"])
      await page
        .getByRole("button", {
          name: new RegExp(
            "^" + (n === "메인 전원" ? "⏻" : "↳") + " " + n + "$",
          ),
        })
        .click();
    await page.getByRole("button", { name: "순서 실행" }).click();
    await page.getByText("연결 실패 ·", { exact: false }).waitFor();
    await page.getByRole("button", { name: "초기화", exact: true }).click();
    for (const n of ["메인 전원", "A", "B", "C"])
      await page
        .getByRole("button", {
          name: new RegExp(
            "^" + (n === "메인 전원" ? "⏻" : "↳") + " " + n + "$",
          ),
        })
        .click();
    await page.screenshot({ path: "artifacts/power-puzzle.png" });
    await page.getByRole("button", { name: "순서 실행" }).click();
    assert((await state()).power, "power unlocked");
    await move(0, 27);
    await move(0, 33);
    await move(-2, 34);
    await page.keyboard.press("KeyE");
  }
  await page.getByRole("dialog", { name: "슈트 개발" }).waitFor();
  const input = page.getByPlaceholder("명령어를 입력해보세요");
  const generate = page.getByRole("button", { name: "능력 생성하기" });
  const testAbility = page.getByRole("button", {
    name: "능력 테스트",
    exact: false,
  });
  const equip = page.getByRole("button", { name: "슈트에 장착" });
  const code = page.locator(".studio-code pre");
  const emptyCode = "명령어를 입력하면 생성된 코드가 여기에 표시됩니다.";
  assert((await input.inputValue()) === "", "command starts empty");
  assert(
    (await code.textContent()) === emptyCode,
    "code starts with neutral guidance",
  );
  assert(await generate.isDisabled(), "generation locked for empty command");
  assert(await testAbility.isDisabled(), "testing locked before generation");
  assert(await equip.isDisabled(), "equip locked before generation");
  assert(
    !(await page.getByText("지원되는 능력", { exact: true }).isVisible()),
    "help starts hidden",
  );
  assert(
    !/초소형|축소|복귀/.test(
      await page.getByRole("dialog", { name: "슈트 개발" }).innerText(),
    ),
    "initial studio does not reveal solution",
  );
  await page.screenshot({ path: "artifacts/suit-studio-empty.png" });
  const help = page.getByRole("button", { name: "도움말" });
  await help.click();
  assert(
    (await help.getAttribute("aria-expanded")) === "true",
    "help expanded state",
  );
  assert(
    await page.getByText("지원되는 능력", { exact: true }).isVisible(),
    "help reveals supported abilities",
  );
  await help.click();
  assert(
    !(await page.getByText("지원되는 능력", { exact: true }).isVisible()),
    "help can collapse",
  );
  await input.fill(" \n\t ");
  assert(await generate.isDisabled(), "generation locked for whitespace");
  await page.getByLabel("어떤 능력을 만들까요?").fill("무적이 되어줘");
  await page.getByRole("button", { name: "능력 생성하기" }).click();
  await page.getByRole("alert").waitFor();
  assert(!(await state()).program, "unsupported ability rejected");
  await page
    .getByLabel("어떤 능력을 만들까요?")
    .fill("레이저가 접근하면 작아지고 지나가면 이전 크기로 복귀해줘");
  assert(
    (await code.textContent()) === emptyCode,
    "typing alone does not generate code",
  );
  assert(
    await testAbility.isDisabled(),
    "typing alone does not unlock testing",
  );
  assert(
    !(await page.getByRole("alert").count()),
    "editing clears previous error",
  );
  await page.getByRole("button", { name: "능력 생성하기" }).click();
  assert(
    await page.getByRole("button", { name: "슈트에 장착" }).isDisabled(),
    "equip locked before testing",
  );
  await page.getByRole("button", { name: "능력 테스트", exact: false }).click();
  assert(await input.isDisabled(), "command locked while testing");
  assert(await equip.isDisabled(), "equip locked while testing");
  await waitFor((s) => s.tested, "sandbox test");
  await page.getByRole("button", { name: "수정 요청" }).click();
  assert(
    await input.evaluate((el) => document.activeElement === el),
    "revision focuses command",
  );
  assert(
    (await code.textContent()) === emptyCode,
    "revision invalidates old code",
  );
  assert(!(await state()).tested, "revision invalidates saved test result");
  assert(await equip.isDisabled(), "revision locks equip until another test");
  assert(
    await testAbility.isDisabled(),
    "revision requires generation before testing",
  );
  await input.fill("레이저 감지 시 초소형, 이후 원래 크기로 복귀");
  await page.getByRole("button", { name: "능력 수정하기" }).click();
  assert(
    (await code.textContent()).includes("suit.shrink"),
    "revision generates new code",
  );
  assert(await equip.isDisabled(), "regenerated ability needs a new test");
  await testAbility.click();
  await waitFor((s) => s.tested, "revised sandbox test");
  // A direct edit also invalidates successful results, without the revision button.
  await input.fill("레이저가 오면 작아지고 원래 크기로 돌아와");
  assert(
    !(await state()).tested && !(await state()).program,
    "direct edit invalidates saved results",
  );
  assert(
    (await equip.isDisabled()) && (await testAbility.isDisabled()),
    "direct edit locks actions",
  );
  await generate.click();
  await testAbility.click();
  await waitFor((s) => s.tested, "edited sandbox test");
  await page.getByRole("button", { name: "패널 닫기" }).click();
  if (suitOnly)
    await page.evaluate(() =>
      window.__quantumGame.getState().patch({ panel: "suit" }),
    );
  else await page.keyboard.press("KeyE");
  await page.getByRole("dialog", { name: "슈트 개발" }).waitFor();
  assert(
    (await input.inputValue()) === "레이저가 오면 작아지고 원래 크기로 돌아와",
    "reopening preserves user's command",
  );
  assert(!(await equip.isDisabled()), "reopening preserves successful test");
  assert(
    (await page.locator(".test-checks .passed").count()) === 3,
    "reopening shows consistent test results",
  );
  await page.screenshot({ path: "artifacts/suit-studio.png" });
  await page.getByRole("button", { name: "슈트에 장착" }).click();
  assert((await state()).equipped, "suit equipped");
  if (suitOnly) {
    assert(errors.length === 0, "no browser errors");
    console.log(
      "SUIT STUDIO PASS: empty state, help, generation, testing, revision, reopen, equip",
    );
    await browser.close();
    process.exit(0);
  }
  await move(0, 38);
  await page.keyboard.press("KeyQ");
  assert(!(await state()).ability, "Q disables");
  await page.keyboard.down("KeyW");
  await waitFor((s) => s.deaths === 1, "laser death checkpoint");
  await page.keyboard.up("KeyW");
  await waitFor((s) => Math.abs(s.pos[2] - 38) < 0.4, "checkpoint position");
  assert((await state()).size === 1, "checkpoint restores normal collider");
  await page.keyboard.press("KeyQ");
  await move(0, 44);
  assert((await state()).size === 0.25, "laser triggers actual shrink");
  await page.screenshot({ path: "artifacts/laser-dodge.png" });
  await move(0, 55.8);
  await waitFor((s) => s.pendingRestore, "wait under low ceiling");
  assert((await state()).size === 0.25, "remain tiny under obstruction");
  await page.screenshot({ path: "artifacts/safe-restore.png" });
  await move(0, 58);
  await waitFor((s) => !s.automatic, "restore after corridor");
  assert((await state()).size === 1, "restore previous size");
  // Stand in the arena and dodge three real beam cycles with the equipped ability.
  await move(0, 62);
  for (let hp = 3; hp > 0; hp--) {
    await waitFor(
      (s) => s.bossPhase === "weak" && !s.automatic,
      "boss weakness " + hp,
      30000,
    );
    await page.keyboard.press("Digit3");
    await page.keyboard.press("KeyE");
    await waitFor((s) => s.bossHP === hp - 1, "boss hit " + hp);
    if (hp === 3) await page.screenshot({ path: "artifacts/boss-fight.png" });
  }
  await move(4.5, 65);
  await move(4.5, 71.5);
  await move(0, 72);
  await move(0, 76);
  await waitFor((s) => s.screen === "clear", "clear screen");
  await page.screenshot({ path: "artifacts/clear-screen.png" });
  console.log("PLAYTHROUGH PASS", JSON.stringify(await state()));
  assert(errors.length === 0, "no browser errors");
  fs.writeFileSync(
    "artifacts/playthrough-result.json",
    JSON.stringify({ passed: true, errors, state: await state() }, null, 2),
  );
  await page.getByRole("button", { name: /메인 메뉴로/ }).click();
  assert(
    (await state()).screen === "start",
    "restart returns to character selection",
  );
} catch (e) {
  console.error(e);
  await page.screenshot({ path: "artifacts/qa-failure.png" });
  fs.writeFileSync(
    "artifacts/playthrough-result.json",
    JSON.stringify(
      { passed: false, error: String(e), errors, state: await state() },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
