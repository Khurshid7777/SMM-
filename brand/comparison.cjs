// Лист-сравнение логотипов → brand/logo/comparison.png (Playwright + Chromium).
// Запуск: node brand/comparison.cjs
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const ROOT = path.resolve(__dirname, "..");
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, "brand/tokens.json"), "utf8"));
const C = Object.fromEntries(Object.entries(tokens.colors).map(([k, v]) => [k, v.hex]));
const svg = (v, f) => fs.readFileSync(path.join(ROOT, "brand/logo", v, f + ".svg"), "utf8");

const cell = (bg, inner, label, extra = "") =>
  `<div class="cell" style="background:${bg};${extra}"><div class="inner">${inner}</div><div class="label">${label}</div></div>`;

const variants = Object.entries(tokens.logo.variants)
  .map(([v, desc]) => {
    const icons = [256, 96, 48]
      .map((s) => `<div style="width:${s}px;height:${s}px;display:inline-block;margin-right:24px;vertical-align:middle">${svg(v, "icon")}</div>`)
      .join("");
    return `
    <section>
      <h2>Вариант ${v} <span>${desc}</span></h2>
      <div class="row">
        ${cell(C.bg, svg(v, "full_ru"), "Полная версия, RU — на фоне коробки")}
        ${cell(C.nude, svg(v, "full_uz-latn"), "Полная версия, UZ латиница — на нюде")}
        ${cell(C.teal_deep, svg(v, "mono_reverse"), "Монохром, реверс — тиснение, тёмная грань")}
      </div>
      <div class="row">
        ${cell(C.bg, svg(v, "horizontal"), "Горизонтальная — шапка карточки, документы", "flex:1.4")}
        ${cell(C.bg, `<div style="width:300px">${svg(v, "wordmark")}</div>`, "Знак 18 мм — минимальный размер", "flex:0.8")}
        ${cell(C.white, icons, "Иконка: 256 / 96 / 48 px (аватар @sil.icare)", "flex:1.2")}
      </div>
    </section>`;
  })
  .join("");

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<style>
  @font-face{font-family:Inter;src:url(file://${ROOT}/brand/fonts/inter-cyrillic-wght-normal.woff2) format('woff2');font-weight:100 900;unicode-range:U+0400-045F}
  @font-face{font-family:Inter;src:url(file://${ROOT}/brand/fonts/inter-latin-wght-normal.woff2) format('woff2');font-weight:100 900}
  body{margin:0;background:#FFFFFF;font-family:Inter,system-ui,sans-serif;color:${C.teal_deep};width:1600px;padding:48px 56px;box-sizing:border-box}
  h1{font-size:34px;font-weight:600;margin:0 0 6px}
  h1 small{font-weight:400;color:${C.text2};font-size:18px;margin-left:16px}
  h2{font-size:22px;font-weight:600;margin:36px 0 14px}
  h2 span{font-weight:400;color:${C.text2};font-size:16px;margin-left:12px}
  .row{display:flex;gap:16px;margin-bottom:16px}
  .cell{flex:1;border-radius:18px;padding:28px 28px 18px;display:flex;flex-direction:column;justify-content:space-between;min-height:200px}
  .inner{display:flex;align-items:center;justify-content:center;flex:1}
  .inner svg{max-width:100%;max-height:150px}
  .label{font-size:13px;color:${C.text2};margin-top:14px}
  .cell[style*="${C.teal_deep}"] .label{color:${C.teal_soft}}
  .palette{display:flex;gap:10px;margin:14px 0 4px}
  .sw{flex:1;border-radius:12px;padding:12px;font-size:12px;line-height:1.4;border:1px solid rgba(0,0,0,0.06)}
</style></head><body>
<h1>Silicare by Yafho — логотип, 3 варианта <small>brand/build.py · шрифт знака Manrope SemiBold 600, трекинг +20, в кривых</small></h1>
<div class="palette">${Object.entries(tokens.colors)
  .map(([k, v]) => `<div class="sw" style="background:${v.hex};color:${["teal_deep"].includes(k) ? C.bg : C.teal_deep}"><b>${k}</b><br>${v.hex}<br>CMYK ${v.cmyk.join("/")}</div>`)
  .join("")}</div>
${variants}
</body></html>`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(ROOT, "brand/logo/comparison.png"), fullPage: true });
  await b.close();
  console.log("brand/logo/comparison.png");
})();
