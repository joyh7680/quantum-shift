import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
let rendererUrl;
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.url().includes("/deps/@react-three_fiber.js"))
    rendererUrl = response.url();
});
fs.mkdirSync("artifacts/command-items", { recursive: true });
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5180/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.waitForFunction(
    () => window.__quantumGame?.getState().lab.time > 0.1,
  );
  assert(rendererUrl, "React Three Fiber renderer is loaded");
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    window.__chipQaRoot = _roots.get(
      document.querySelector(".game-canvas canvas"),
    ).store;
    window.__quantumGame.getState().patch({ panel: "pause", toast: "" });
  }, rendererUrl);
  const bounds = await page.evaluate(async () => {
    const { Box3 } = await import("/node_modules/.vite/deps/three.js");
    const root = window.__chipQaRoot.getState();
    const models = [];
    root.scene.traverse((object) => {
      if (object.userData.commandChip) models.push(object);
    });
    window.__chipQaModels = models;
    return models.map((object) => {
      const bounds = new Box3().setFromObject(object, true);
      return {
        id: object.userData.commandChip,
        min: bounds.min.toArray(),
        max: bounds.max.toArray(),
      };
    });
  });
  assert.deepEqual(bounds.map((b) => b.id).sort(), [
    "battery",
    "power",
    "vent",
  ]);
  const vent = bounds.find((b) => b.id === "vent");
  assert(
    vent.min[1] > 0 && vent.max[1] < 0.65,
    "vent fits inside maintenance tunnel",
  );
  const rotation = await page.evaluate(() => {
    const rotor = window.__chipQaModels
      .find((m) => m.userData.commandChip === "vent")
      .children[0].children[0].children.find(
        (child) => child.children.length === 4,
      );
    window.__chipQaRotor = rotor;
    return rotor.rotation.z;
  });
  await page.waitForTimeout(400);
  assert.notEqual(
    await page.evaluate(() => window.__chipQaRotor.rotation.z),
    rotation,
    "vent rotor animates",
  );
  for (const id of ["battery", "power", "vent"]) {
    await page.evaluate((id) => {
      const s = window.__quantumGame.getState();
      s.patchLab({ chips: [...s.lab.chips, id] });
    }, id);
    await page.waitForFunction(
      (id) =>
        !window.__chipQaModels.find((m) => m.userData.commandChip === id)
          .visible,
      id,
    );
  }
  await page.evaluate(() =>
    window.__quantumGame.getState().patchLab({ chips: [] }),
  );
  await page.waitForFunction(() =>
    window.__chipQaModels.every((m) => m.visible && m.scale.x === 1),
  );

  // Render the actual in-game models together for visual review, without a production preview route.
  await page.evaluate(async () => {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const state = window.__chipQaRoot.getState();
    state.setFrameloop("never");
    state.scene.children.forEach((child) => {
      child.visible = false;
    });
    state.scene.fog = null;
    const gallery = new THREE.Group();
    window.__chipQaModels.forEach((object, index) => {
      const model = object.children[0].clone(true);
      model.position.set((index - 1) * 1.55, 0, 0);
      model.rotation.set(-0.12, -0.25, 0);
      model.scale.setScalar(1.8);
      gallery.add(model);
    });
    gallery.add(new THREE.HemisphereLight("#bbdef8", "#17223d", 2));
    const light = new THREE.DirectionalLight("#c2e4ff", 3);
    light.position.set(-2, 4, 5);
    gallery.add(light);
    state.scene.add(gallery);
    state.camera.position.set(0, 0.3, 5.6);
    state.camera.fov = 42;
    state.camera.lookAt(0, 0, 0);
    state.camera.updateProjectionMatrix();
    state.gl.render(state.scene, state.camera);
    const overlay = document.createElement("div");
    overlay.innerHTML = `<style>
      .hud,.toast,.pause-scrim,.resource-loading{display:none!important}
      .chip-review{position:fixed;inset:0;pointer-events:none;color:#e0f3ff;font-family:system-ui,sans-serif}
      .chip-review header{position:absolute;top:9%;left:9%}.chip-review small{font-size:11px;letter-spacing:3px;color:#77ddff}
      .chip-review h1{font-size:30px;margin:12px 0}.chip-review header p{color:#7c97ae;font-size:14px}
      .chip-review footer{position:absolute;bottom:17%;left:0;right:0;display:flex;justify-content:center;gap:0}
      .chip-review section{width:300px;text-align:center}.chip-review b{font-size:19px}.chip-review section p{font-size:11px;letter-spacing:2px;color:#7c97ae}
    </style><div class="chip-review"><header><small>QUANTUM / COMMAND ARTIFACTS</small><h1>기능이 보이는 명령 아이템</h1><p>메탈 프레임 · 발광 코어 · 고유한 실루엣</p></header><footer>
      <section style="color:#ffcb80"><b>ϟ 배터리 연결</b><p>ENERGY CELL</p></section>
      <section style="color:#bca5ff"><b>⏻ 전원 차단</b><p>POWER CORE</p></section>
      <section style="color:#70f2cd"><b>✣ 환풍기 멈춤</b><p>VENT TURBINE</p></section>
    </footer></div>`;
    document.body.appendChild(overlay);
  });
  await page.screenshot({ path: "artifacts/command-items/preview.png" });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/command-items/result.json",
    JSON.stringify({ passed: true, bounds, errors }, null, 2),
  );
  console.log(
    "PASS: three distinct models, vent clearance, rotor animation, collection and reset; no browser errors",
  );
} finally {
  await browser.close();
}
