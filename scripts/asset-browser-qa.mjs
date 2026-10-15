import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
try {
  const page = await browser.newPage();
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5173/");
  const catalog = JSON.parse(fs.readFileSync("src/characters.json", "utf8"));
  const results = await page.evaluate(async (catalog) => {
    const { GLTFLoader } =
      await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js");
    const { Box3, Vector3 } =
      await import("/node_modules/three/build/three.module.js");
    const loader = new GLTFLoader(),
      results = [];
    for (const a of catalog) {
      const gltf = await loader.loadAsync(a.url);
      const box = new Box3().setFromObject(gltf.scene),
        d = box.getSize(new Vector3());
      const scale = Math.min(1.5 / d.y, 1.05 / Math.max(d.x, d.z));
      if (!Number.isFinite(scale) || scale <= 0)
        throw Error("Invalid bounds: " + a.name);
      results.push({
        name: a.name,
        url: a.url,
        originalSize: d.toArray(),
        normalizedSize: d.multiplyScalar(scale).toArray(),
        animations: gltf.animations.length,
      });
    }
    return results;
  }, catalog);
  fs.writeFileSync(
    "artifacts/character-load-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log("CHARACTER LOADING PASS", results.length, "models");
} finally {
  await browser.close();
}
