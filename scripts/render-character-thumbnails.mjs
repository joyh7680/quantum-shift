import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";

// Render the catalog's exact GLBs; no substitute characters or recoloring.
// Run against the Vite dev server so Three.js modules resolve locally.
const url = process.env.QC_QA_URL || "http://127.0.0.1:5173/";
const catalog = JSON.parse(fs.readFileSync("src/characters.json", "utf8"));
const directory = "public/character-thumbnails";
fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
try {
  const page = await browser.newPage();
  await page.goto(url);
  const portraits = await page.evaluate(async (catalog) => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { GLTFLoader } =
      await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js");
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(192, 192);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe8f5ff, 0x687b98, 2.5));
    const key = new THREE.DirectionalLight(0xfff3e5, 3);
    key.position.set(3, 5, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9de5ff, 1.5);
    fill.position.set(-4, 2, 4);
    scene.add(fill);
    const loader = new GLTFLoader();
    const portraits = [];
    for (const asset of catalog) {
      const { scene: model } = await loader.loadAsync(asset.url);
      scene.add(model);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      // Measure upper vertices so wide helmets/antennae also fit the portrait.
      const head = new THREE.Box3();
      const vertex = new THREE.Vector3();
      model.traverse((object) => {
        if (!object.isMesh) return;
        const positions = object.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          vertex
            .fromBufferAttribute(positions, i)
            .applyMatrix4(object.matrixWorld);
          if (vertex.y >= box.max.y - size.y * 0.48) head.expandByPoint(vertex);
        }
      });
      const span = Math.max(size.y * 0.66, (head.max.x - head.min.x) * 1.08);
      const targetX = (head.min.x + head.max.x) / 2;
      const targetY = box.max.y + size.y * 0.04 - span / 2;
      const camera = new THREE.OrthographicCamera(
        -span / 2,
        span / 2,
        span / 2,
        -span / 2,
        0.01,
        size.z + size.y * 10,
      );
      camera.position.set(targetX, targetY, box.max.z + size.y * 3);
      camera.lookAt(targetX, targetY, center.z);
      renderer.render(scene, camera);
      portraits.push({
        id: asset.id,
        model: asset.url,
        sha256: asset.sha256,
        data: renderer.domElement.toDataURL("image/png"),
      });
      scene.remove(model);
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        for (const material of [].concat(object.material)) material.dispose();
      });
    }
    renderer.dispose();
    return portraits;
  }, catalog);
  assert.equal(portraits.length, catalog.length);
  for (const portrait of portraits) {
    fs.writeFileSync(
      `${directory}/${portrait.id}.png`,
      Buffer.from(portrait.data.split(",")[1], "base64"),
    );
  }
  fs.writeFileSync(
    `${directory}/manifest.json`,
    JSON.stringify(
      portraits.map(({ data, ...source }) => source),
      null,
      2,
    ) + "\n",
  );
  await page.setViewportSize({ width: 1000, height: 1320 });
  await page.setContent(
    `<body style="margin:0;background:#101b2d;color:#dceaff;font:12px sans-serif;display:grid;grid-template-columns:repeat(8,1fr);gap:8px;padding:16px">${catalog.map((c, i) => `<div style="text-align:center"><img src="${portraits[i].data}" style="display:block;width:112px;height:112px;background:#21344b;border-radius:10px"><p>${c.id}<br>${c.name}</p></div>`).join("")}</body>`,
  );
  await page
    .locator("img")
    .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
  await page.screenshot({
    path: "artifacts/character-thumbnails-contact.png",
    fullPage: true,
  });
  console.log(
    `Rendered ${portraits.length} character portraits from matching GLBs.`,
  );
} finally {
  await browser.close();
}
