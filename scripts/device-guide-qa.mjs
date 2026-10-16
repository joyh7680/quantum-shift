import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
let rendererUrl;
page.on("pageerror", (e) => errors.push(e.message));
page.on("requestfailed", (r) =>
  console.log("REQUEST FAILED", r.url(), r.failure()?.errorText),
);
page.on("console", (m) => {
  if (m.type() === "error") console.log("BROWSER ERROR", m.text());
});
page.on("response", (r) => {
  if (
    /(@react-three_fiber|@react-three\/fiber\/dist\/react-three-fiber).*\.js/.test(
      r.url(),
    )
  )
    rendererUrl = r.url();
});
const snapshot = () =>
  page.evaluate(() => {
    const markers = [];
    window.__guideQaScene.traverse((o) => {
      if (o.userData.deviceGuideTarget) {
        const p = o.getWorldPosition(o.position.clone());
        markers.push({
          device: o.userData.deviceGuideTarget,
          x: p.x,
          y: p.y,
          z: p.z,
        });
      }
    });
    return markers;
  });
const materials = () =>
  page.evaluate(() => {
    const values = [];
    window.__guideQaScene.traverse((o) => {
      if (o.isMesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (m.isMeshStandardMaterial)
            values.push([
              m.uuid,
              m.color.getHexString(),
              m.emissive.getHexString(),
              m.emissiveIntensity,
            ]);
      }
    });
    return values.sort((a, b) => a[0].localeCompare(b[0]));
  });
const game = () =>
  page.evaluate(() => {
    const s = window.__quantumGame.getState();
    return {
      size: s.size,
      battery: s.lab.battery,
      power: s.lab.power,
      fan: s.lab.fan,
      chips: s.lab.chips,
      code: s.lab.code,
      run: s.lab.run,
    };
  });
const cases = [
  [
    "battery",
    "배터리 연결",
    "거대 크기로 배터리를 정지 장치에 연결해 전력을 공급하세요.",
    2,
  ],
  [
    "power",
    "전원 차단",
    "일반 크기로 정지 장치의 버튼을 눌러 환풍기 전원을 차단하세요.",
    1,
  ],
  [
    "vent",
    "환풍기 멈춤",
    "전원이 차단되어 팬이 멈추면 초소형으로 환풍구를 통과하세요.",
    1,
  ],
];
async function waitMarkers(device, count) {
  await page.waitForFunction(
    ({ device, count }) => {
      let total = 0,
        match = 0;
      window.__guideQaScene.traverse((o) => {
        if (o.userData.deviceGuideTarget) {
          total++;
          if (o.userData.deviceGuideTarget === device) match++;
        }
      });
      return total === count && match === count;
    },
    { device, count },
  );
}
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5177/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.waitForFunction(
    () => window.__quantumGame?.getState().lab.time > 0.1,
  );
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patchLab({ checkpoint: [0, 0.03, 13] });
    s.patch({ panel: "power", respawn: s.respawn + 1, toast: "" });
  });
  assert(rendererUrl, "Observed the renderer module URL");
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    window.__guideQaScene = _roots
      .get(document.querySelector(".game-canvas canvas"))
      .store.getState().scene;
  }, rendererUrl);
  await page.waitForTimeout(1500);
  assert.equal(await page.locator(".device-guide-card").count(), 3);
  assert.equal(await page.getByRole("tooltip").count(), 0);
  assert.deepEqual(await snapshot(), []);
  const beforeGame = await game(),
    beforeMaterials = await materials();
  await page.screenshot({ path: "artifacts/device-guide-default.png" });
  const checks = [];
  for (const [id, name, text, count] of cases) {
    await page
      .locator(".device-guide")
      .getByRole("button", { name, exact: true })
      .hover();
    await waitMarkers(id, count);
    assert.equal(await page.getByRole("tooltip").innerText(), text);
    const highlighted = await snapshot();
    if (id === "battery") {
      assert(
        highlighted.some(
          (p) => Math.abs(p.x + 4) < 0.05 && Math.abs(p.z - 18) < 0.05,
        ),
      );
      assert(
        highlighted.some(
          (p) => Math.abs(p.x - 4.8) < 0.05 && Math.abs(p.z - 19) < 0.05,
        ),
      );
    }
    if (id === "power")
      assert(
        Math.abs(highlighted[0].x - 5) < 0.05 &&
          highlighted[0].z > 23 &&
          highlighted[0].z < 24,
      );
    if (id === "vent")
      assert(
        Math.abs(highlighted[0].x) < 0.05 &&
          Math.abs(highlighted[0].z - 26.55) < 0.05,
      );
    assert.notDeepEqual(
      await materials(),
      beforeMaterials,
      "Actual device materials highlight",
    );
    const tooltip = await page.getByRole("tooltip").boundingBox();
    assert(
      tooltip.x >= 0 &&
        tooltip.x + tooltip.width < 768 &&
        tooltip.y >= 0 &&
        tooltip.y + tooltip.height <= 720,
    );
    await page.screenshot({ path: `artifacts/device-guide-${id}.png` });
    await page.mouse.move(1100, 35);
    await waitMarkers(null, 0);
    assert.equal(await page.getByRole("tooltip").count(), 0);
    assert.deepEqual(
      await materials(),
      beforeMaterials,
      "Original materials restored",
    );
    assert.deepEqual(
      await game(),
      beforeGame,
      "Inspection does not operate devices or edit code",
    );
    checks.push({ id, markers: highlighted });
  }
  const powerCard = page
    .locator(".device-guide")
    .getByRole("button", { name: "전원 차단", exact: true });
  await powerCard.focus();
  await waitMarkers("power", 1);
  await powerCard.press("Escape");
  await waitMarkers(null, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [id, name, , count] of cases) {
    const card = page
      .locator(".device-guide")
      .getByRole("button", { name, exact: true });
    await card.click();
    await waitMarkers(id, count);
    const tooltip = await page.getByRole("tooltip").boundingBox();
    assert(
      tooltip.x >= 0 &&
        tooltip.x + tooltip.width <= 235 &&
        tooltip.y >= 0 &&
        tooltip.y + tooltip.height <= 844,
    );
  }
  await page.screenshot({ path: "artifacts/device-guide-mobile.png" });
  await page.evaluate(() =>
    window.__quantumGame.getState().patch({ panel: null }),
  );
  await waitMarkers(null, 0);
  assert.equal(await page.locator(".device-guide").count(), 0);
  await page.evaluate(() =>
    window.__quantumGame.getState().patch({ panel: "power" }),
  );
  assert.equal(await page.getByRole("tooltip").count(), 0);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/device-guide-result.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        errors,
        verified: [
          "three compact default cards",
          "exact hover explanations",
          "actual Three.js target positions and material changes",
          "hover leave restores materials",
          "keyboard focus and Escape",
          "mobile tap and tooltip bounds",
          "unmount clears highlights",
          "puzzle/inventory/code unchanged",
        ],
      },
      null,
      2,
    ),
  );
  console.log("DEVICE GUIDE PASS", JSON.stringify(checks));
} catch (e) {
  console.error(e);
  await page.screenshot({ path: "artifacts/device-guide-failure.png" });
  fs.writeFileSync(
    "artifacts/device-guide-result.json",
    JSON.stringify({ passed: false, error: String(e), errors }, null, 2),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
