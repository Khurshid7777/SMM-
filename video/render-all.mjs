// Рендер всех роликов × RU/UZ в out/. Сначала автопроверка: с ошибками рендер не запускается.
// Запуск: npm run render:all   (можно передать фильтр: npm run render:all -- reel-01)
// 3D-сцены рендерятся через WebGL: на машине без GPU нужен --gl=swangle (по умолчанию).
// Свой Chromium: REMOTION_BROWSER=/путь/к/headless_shell npm run render:all
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

execFileSync("node", ["../scripts/check.mjs"], { stdio: "inherit" });

const filter = process.argv[2] ?? "";
const gl = process.env.REMOTION_GL ?? "swangle";
const browser = process.env.REMOTION_BROWSER;
const ids = readdirSync("../content/reels")
  .filter((f) => f.endsWith(".json") && f.includes(filter))
  .map((f) => f.replace(/\.json$/, ""));

for (const id of ids) {
  for (const lang of ["ru", "uz"]) {
    const comp = `${id}-${lang}`;
    console.log(`\n▶ ${comp}`);
    const args = ["remotion", "render", comp, `out/${comp}.mp4`, `--gl=${gl}`];
    if (browser) args.push(`--browser-executable=${browser}`);
    execFileSync("npx", args, { stdio: "inherit" });
  }
}
