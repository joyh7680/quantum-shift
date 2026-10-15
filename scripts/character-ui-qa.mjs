import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";

const url = process.env.QC_QA_URL || "http://127.0.0.1:5173/";
const catalog = JSON.parse(fs.readFileSync("src/characters.json", "utf8"));
const manifest = JSON.parse(
  fs.readFileSync("public/character-thumbnails/manifest.json", "utf8"),
);
assert.deepEqual(
  manifest,
  catalog.map((c) => ({ id: c.id, model: c.url, sha256: c.sha256 })),
);
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const trigger = page.locator(".character-trigger");
try {
  await page.goto(url);
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 960 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(viewport);
    await trigger.click();
    const options = page.locator(".explorer-grid button");
    assert.equal(await options.count(), catalog.length);
    const images = await options.evaluateAll(async (buttons) => {
      return Promise.all(
        buttons.map(async (button) => {
          const image = button.querySelector("img");
          await image.decode();
          const name = button.querySelector(".explorer-name");
          const check = button.querySelector("b");
          const a = image.getBoundingClientRect(),
            b = name.getBoundingClientRect(),
            c = check.getBoundingClientRect();
          return {
            src: image.getAttribute("src"),
            width: image.naturalWidth,
            ordered: a.right <= b.left && b.right <= c.left,
            height: button.offsetHeight,
            fits: button.scrollWidth <= button.clientWidth,
          };
        }),
      );
    });
    for (const [i, image] of images.entries()) {
      assert.equal(image.src, `/character-thumbnails/${catalog[i].id}.png`);
      assert.equal(image.width, 192);
      assert.equal(image.ordered, true, `${device}: image, name, check order`);
      assert.equal(image.fits, true, `${device}: option fits`);
      assert.equal(image.height, device === "desktop" ? 40 : 36);
    }
    for (const id of ["codmos_nova", "alien", "wizard", "soldier"]) {
      const asset = catalog.find((c) => c.id === id);
      const option = page.getByRole("button", {
        name: `${asset.name} 선택`,
        exact: true,
      });
      await option.click();
      assert.equal(
        await options
          .locator("b")
          .allTextContents()
          .then((checks) => checks.filter(Boolean).join("")),
        "✓",
      );
      assert.equal(
        await page.locator('.explorer-grid [aria-pressed="true"]').count(),
        1,
      );
      assert.equal(await option.getAttribute("class"), "chosen");
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".explorer-grid .chosen"))
            .backgroundColor === "rgb(38, 69, 86)",
      );
      const colors = await option.evaluate((button) => ({
        border: getComputedStyle(button).borderColor,
        background: getComputedStyle(button).backgroundColor,
      }));
      assert.equal(colors.border, "rgb(139, 230, 247)");
      assert.equal(colors.background, "rgb(38, 69, 86)");
      await page.getByRole("button", { name: /선택 완료/ }).click();
      assert.equal(
        await trigger.locator("img").getAttribute("src"),
        `/character-thumbnails/${id}.png`,
      );
      assert.equal(await trigger.locator("strong").innerText(), asset.name);
      await trigger.locator("img").evaluate((img) => img.decode());
      assert.equal(
        await trigger.evaluate((b) => b === document.activeElement),
        true,
      );
      await trigger.click();
      assert.equal(await option.getAttribute("aria-pressed"), "true");
    }
    await page.getByRole("button", { name: "노바 선택", exact: true }).click();
    await page.locator(".explorer-grid").evaluate((grid) => {
      grid.scrollTop = 0;
    });
    await page.screenshot({
      path: `artifacts/character-options-${device}.png`,
    });
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: `artifacts/character-selected-${device}.png`,
    });
    const bounds = await trigger.boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 47 matching portraits, desktop/mobile layout, exclusive check, cyan selection, closed selection, reopen and focus restoration.",
  );
} finally {
  await browser.close();
}
