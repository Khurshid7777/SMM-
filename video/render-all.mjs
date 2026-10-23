// Рендер всех роликов × RU/UZ в out/. Сначала автопроверка: с ошибками рендер не запускается.
// Запуск: npm run render:all   (можно передать фильтр: npm run render:all -- reel-01)
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

execFileSync("node", ["../scripts/check.mjs"], { stdio: "inherit" });

const filter = process.argv[2] ?? "";
const ids = readdirSync("../content/reels")
  .filter((f) => f.endsWith(".json") && f.includes(filter))
  .map((f) => f.replace(/\.json$/, ""));

for (const id of ids) {
  for (const lang of ["ru", "uz"]) {
    const comp = `${id}-${lang}`;
    console.log(`\n▶ ${comp}`);
    execFileSync("npx", ["remotion", "render", comp, `out/${comp}.mp4`], { stdio: "inherit" });
  }
}
