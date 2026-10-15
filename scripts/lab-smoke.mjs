import { chromium } from "@playwright/test";
import fs from "node:fs";
import { runLab } from "./lab-playthrough.mjs";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [],
  requests = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("PAGE ERROR", e.message);
});
page.on("response", (r) => {
  if (r.status() >= 400) requests.push(`${r.status()} ${r.url()}`);
});
try {
  await page.goto(process.env.QC_QA_URL || "http://127.0.0.1:5177/");
  await page.getByRole("button", { name: /게임 시작/ }).click();
  const result = await runLab(page);
  if (errors.length || requests.length)
    throw Error(JSON.stringify({ errors, requests }));
  fs.writeFileSync(
    "artifacts/lab-result.json",
    JSON.stringify({ passed: true, errors, requests, state: result }, null, 2),
  );
  console.log("LAB PASS", JSON.stringify(result));
} catch (e) {
  console.error(e);
  const state = await page
    .evaluate(() => window.__quantumGame?.getState())
    .catch(() => null);
  await page.screenshot({ path: "artifacts/lab-failure.png" });
  fs.writeFileSync(
    "artifacts/lab-result.json",
    JSON.stringify(
      { passed: false, error: String(e), errors, requests, state },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
