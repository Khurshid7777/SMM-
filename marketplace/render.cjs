// HTML-слайды → PNG 1080×1440 (Uzum) и 900×1200 (WB) + контактный лист 200 px (проверка превью).
// Запуск: node marketplace/render.cjs   (после python3 marketplace/build.py)
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "marketplace/out");
const manifest = JSON.parse(fs.readFileSync(path.join(OUT, "manifest.json"), "utf8"));
const only = process.argv[2] || "";

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await b.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 });
  let n = 0;
  for (const m of manifest) {
    if (only && !`${m.lang}/${m.sku}`.includes(only)) continue;
    fs.mkdirSync(path.dirname(m.png), { recursive: true });
    await page.goto("file://" + m.html);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: m.png, type: "png" });
    n++;
  }
  await b.close();
  console.log("png:", n);
})();
