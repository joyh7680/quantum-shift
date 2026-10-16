import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
let rendererUrl;
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (
    /(@react-three_fiber|@react-three\/fiber\/dist\/react-three-fiber).*\.js/.test(
      response.url(),
    )
  )
    rendererUrl = response.url();
});
const pose = () =>
  page.evaluate(() => {
    const scene = window.__walkRoot.getState().scene;
    const model = scene.getObjectByName("character-model");
    const state = window.__quantumGame.getState();
    return {
      pos: state.pos,
      moving: state.moving,
      airborne: state.airborne,
      angles: ["left-leg", "right-leg", "left-arm", "right-arm"].map(
        (name) => model.getObjectByName(name).rotation.x,
      ),
    };
  });
// Advance real game/physics callbacks at 60 Hz without depending on software
// WebGL wall-clock throughput. Render the last frame of each batch.
const tick = (frames) =>
  page.evaluate((frames) => {
    const state = window.__walkRoot.getState();
    const render = state.gl.render;
    state.gl.render = () => {};
    try {
      for (let i = 0; i < frames; i++)
        state.advance(state.clock.elapsedTime + 1 / 60, true);
    } finally {
      state.gl.render = render;
    }
    state.gl.render(state.scene, state.camera);
  }, frames);
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5173/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.waitForFunction(
    () => window.__quantumGame?.getState().lab.time > 0.2,
  );
  assert(rendererUrl);
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    window.__walkRoot = _roots.get(
      document.querySelector(".game-canvas canvas"),
    ).store;
    // Software WebGL in headless Chrome needs less fill work for input timing.
    window.__walkRoot.getState().setDpr(0.5);
    window.__walkRoot.getState().gl.shadowMap.enabled = false;
    window.__walkRoot.getState().setFrameloop("never");
  }, rendererUrl);
  await tick(30);
  const initial = await pose();
  const samples = [];
  await page.keyboard.down("w");
  for (let i = 0; i < 8; i++) {
    await tick(6);
    samples.push(await pose());
  }
  await page.keyboard.up("w");
  await page.screenshot({ path: "artifacts/character-walking.png" });
  assert(
    samples.at(-1).pos[2] - initial.pos[2] > 0.5,
    "keyboard moves character",
  );
  const angles = samples.map((s) => s.angles[0]);
  assert(
    Math.max(...angles) - Math.min(...angles) > 0.25,
    "legs visibly swing while translating",
  );
  assert(
    samples.some(
      (s) => s.angles[0] * s.angles[1] < 0 && s.angles[0] * s.angles[2] < 0,
    ),
    "opposite arm and leg",
  );
  await tick(60);
  assert(
    (await pose()).angles.every((a) => Math.abs(a) < 0.01),
    "stopping returns to idle",
  );
  console.log("keyboard / alternating limbs / idle passed");

  await page.keyboard.down("w");
  await tick(12);
  await page.keyboard.press("Escape");
  await page.keyboard.up("w");
  await page.waitForFunction(
    () => window.__quantumGame.getState().panel === "pause",
  );
  await tick(2);
  const paused = await pose();
  await tick(30);
  assert.deepEqual((await pose()).angles, paused.angles, "pause freezes pose");
  await page.evaluate(() =>
    window.__quantumGame.getState().patch({ panel: null }),
  );
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patchLab({ checkpoint: [0, 0, -2] });
    s.patch({ respawn: s.respawn + 1 });
  });
  await page.waitForTimeout(100);
  await tick(30);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press("Space");
  await tick(12);
  const jump = await pose();
  assert(
    jump.airborne && jump.angles[2] < -0.2 && jump.angles[3] < -0.2,
    "jump arm pose",
  );
  await tick(60);
  assert.equal((await pose()).airborne, false, "lands after jumping");
  console.log("pause / jump passed");

  for (const key of ["1", "3", "2"]) {
    await page.evaluate(() => {
      const s = window.__quantumGame.getState();
      s.patchLab({ checkpoint: [0, 0, -2] });
      s.patch({ respawn: s.respawn + 1 });
    });
    await page.waitForTimeout(100);
    await tick(30);
    await page.keyboard.press(key);
    await page.keyboard.down("w");
    await tick(12);
    assert(Math.abs((await pose()).angles[0]) > 0.04, `walk at size ${key}`);
    await page.keyboard.up("w");
    await tick(30);
  }
  console.log("all three sizes passed");

  // Checkpoint fixture isolates walking into the solid exit gate.
  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patchLab({ checkpoint: [0, 0, 25] });
    s.patch({ respawn: s.respawn + 1 });
  });
  await page.waitForTimeout(100);
  await tick(30);
  await page.keyboard.down("w");
  await tick(180);
  assert((await pose()).pos[2] > 26, "reached exit gate");
  const blocked = await pose();
  assert.equal(
    blocked.moving,
    false,
    "collision stops walking even with key held",
  );
  assert(
    blocked.angles.every((a) => Math.abs(a) < 0.01),
    "no stepping against wall",
  );
  await page.keyboard.up("w");
  console.log("collision / idle at wall passed");

  await page.evaluate(() => {
    const s = window.__quantumGame.getState();
    s.patchLab({
      chips: ["vent", "power", "battery"],
      code: ["giant", "battery"],
    });
    s.patch({ panel: "power" });
  });
  await page.locator(".run-actions .primary").click();
  await tick(65);
  const programSamples = [];
  for (let i = 0; i < 5; i++) {
    await tick(6);
    programSamples.push(await pose());
  }
  assert(
    programSamples.some((s) => Math.abs(s.angles[0]) > 0.05),
    "block program also animates walking",
  );

  // Render fixed poses of the same rig for visual inspection, independently of
  // the gameplay camera. Original assets, lighting and materials are retained.
  const contact = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { GLTFLoader } =
      await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js");
    const { createCharacterRig, animateCharacter } =
      await import("/src/characterAnimation.ts");
    const catalog = (await import("/src/characters.json")).default;
    const scene = new T.Scene();
    scene.background = new T.Color("#192737");
    scene.add(new T.HemisphereLight(0xffffff, 0x667788, 3));
    const key = new T.DirectionalLight(0xffffff, 3);
    key.position.set(4, 6, 5);
    scene.add(key);
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setSize(1280, 560);
    const camera = new T.PerspectiveCamera(30, 1280 / 560, 0.1, 100);
    camera.position.set(3, 2.1, 9);
    camera.lookAt(0, 0.7, 0);
    const source = (
      await new GLTFLoader().loadAsync(
        catalog.find((a) => a.id === "codmos_nova").url,
      )
    ).scene;
    for (let i = 0; i < 4; i++) {
      const rig = createCharacterRig(source, "codmos_nova");
      rig.weight = 1;
      rig.phase = (i * Math.PI) / 2;
      animateCharacter(rig, { speed: 4, airborne: false, paused: false }, 0.05);
      const group = new T.Group();
      group.position.x = (i - 1.5) * 1.45;
      group.rotation.y = 0.8;
      group.add(rig.model);
      scene.add(group);
    }
    const floor = new T.Mesh(
      new T.PlaneGeometry(20, 20),
      new T.MeshStandardMaterial({ color: "#3c5266" }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);
    renderer.render(scene, camera);
    const image = renderer.domElement.toDataURL("image/png");
    renderer.dispose();
    return image;
  });
  fs.writeFileSync(
    "artifacts/character-walk-poses.png",
    Buffer.from(contact.split(",")[1], "base64"),
  );
  assert.deepEqual(errors, []);
  const result = {
    keyboard: true,
    alternatingLimbs: true,
    idle: true,
    pause: true,
    jump: true,
    sizes: [0.25, 1, 2.5],
    blocked: true,
    blockProgram: true,
    errors,
  };
  fs.writeFileSync(
    "artifacts/character-walk-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} catch (error) {
  await page.screenshot({ path: "artifacts/character-walk-failure.png" });
  console.error(await pose().catch(() => null));
  throw error;
} finally {
  await browser.close();
}
