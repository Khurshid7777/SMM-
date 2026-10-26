// Развёртки → PDF (векторные, размер страницы = лист в мм), PNG-превью и 3D-макет собранной коробки.
// Запуск: node packaging/render.cjs   (после python3 packaging/dieline.py)
// CHROMIUM=/путь/к/chrome PLAYWRIGHT_MODULE=/путь/к/playwright — при нестандартной установке.
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "packaging/out");
const manifest = JSON.parse(fs.readFileSync(path.join(OUT, "manifest.json"), "utf8"));
const PX_PER_MM = 8;

const svgPage = (svg) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{margin:0}html,body{margin:0;padding:0;background:#fff}svg{display:block}</style></head><body>${svg}</body></html>`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  for (const r of manifest.skus) {
    const [sw, sh] = r.sheet_mm;
    const page = await b.newPage({ viewport: { width: Math.round(sw * PX_PER_MM), height: Math.round(sh * PX_PER_MM) } });

    // PDF по слоям + общий + оборот + прототип 1:1 (общий без лака)
    const pdfs = { combined: `dieline_${r.sku}.pdf`, print: `dieline_${r.sku}_print.pdf`, varnish: `dieline_${r.sku}_varnish.pdf`, crease: `dieline_${r.sku}_crease.pdf`, cut: `dieline_${r.sku}_cut.pdf`, inside: `dieline_${r.sku}_inside.pdf` };
    for (const [layer, pdfName] of Object.entries(pdfs)) {
      const svg = fs.readFileSync(path.join(OUT, r.files[layer]), "utf8");
      const [w, h] = layer === "combined" ? r.sheet_mm : [r.sheet_mm[0], r.sheet_mm[1] - 3];
      await page.setContent(svgPage(svg));
      await page.pdf({ path: path.join(OUT, pdfName), width: `${w}mm`, height: `${h}mm`, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    }
    // прототип: печать + рез + биг, без лака, подпись «1:1»
    {
      const print = fs.readFileSync(path.join(OUT, r.files.print), "utf8");
      const cut = fs.readFileSync(path.join(OUT, r.files.cut), "utf8");
      const crease = fs.readFileSync(path.join(OUT, r.files.crease), "utf8");
      const inner = (s) => s.slice(s.indexOf(">", s.indexOf("<svg")) + 1, s.lastIndexOf("</svg>"));
      const [w, h] = [r.sheet_mm[0], r.sheet_mm[1] - 3];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">${inner(print)}${inner(crease)}${inner(cut)}</svg>`;
      await page.setContent(svgPage(svg));
      await page.pdf({ path: path.join(OUT, `prototype_${r.sku}.pdf`), width: `${w}mm`, height: `${h}mm`, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    }
    // PNG: развёртка целиком
    await page.setContent(svgPage(fs.readFileSync(path.join(OUT, r.files.combined), "utf8").replace(/width="[^"]+mm" height="[^"]+mm"/, `width="${Math.round(sw * PX_PER_MM)}" height="${Math.round(sh * PX_PER_MM)}"`)));
    await page.screenshot({ path: path.join(OUT, `box_flat_${r.sku}.png`), fullPage: true });

    // PNG граней в 12 px/мм
    const faces = {};
    for (const name of ["front", "side_ru", "top"]) {
      const svg = fs.readFileSync(path.join(OUT, r.files[`face_${name}`]), "utf8");
      const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      const W = Math.round(w * 12), H = Math.round(h * 12);
      const p2 = await b.newPage({ viewport: { width: W, height: H } });
      await p2.setContent(svgPage(svg.replace(/width="[^"]+mm" height="[^"]+mm"/, `width="${W}" height="${H}"`)));
      const file = path.join(OUT, `box_${name}_${r.sku}.png`);
      await p2.screenshot({ path: file });
      await p2.close();
      faces[name] = { file, w: +w, h: +h, data: "data:image/png;base64," + fs.readFileSync(file).toString("base64") };
    }
    // 3D-макет собранной коробки: CSS-перспектива, три грани
    const W = faces.front.w, H = faces.front.h, D = faces.side_ru.w;
    const k = 7; // px на мм
    // крышка: дальний край развёртки → перед коробки, артворк повёрнут на 180° относительно вида спереди
    const face = (name, style, rot = 0) => `<div style="position:absolute;transform-origin:0 0;${style}"><div style="width:100%;height:100%;background:url(${faces[name].data}) center/100% 100%;transform:rotate(${rot}deg)"></div></div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;width:1400px;height:1000px;background:radial-gradient(80% 70% at 50% 40%,#FFFFFF 0%,#F6F4F0 70%);display:flex;align-items:center;justify-content:center;font-family:sans-serif}
      .scene{perspective:2600px;width:${(W + D) * k}px;height:${(H + D) * k}px;position:relative}
      .box{position:absolute;left:${D * k * 0.5}px;top:${D * k * 0.55}px;transform-style:preserve-3d;transform:rotateX(-22deg) rotateY(-32deg)}
      .shadow{position:absolute;left:${D * k * 0.3}px;top:${(D * 0.55 + H) * k}px;width:${(W + D * 0.8) * k}px;height:${D * k * 0.6}px;background:radial-gradient(50% 50% at 50% 50%,rgba(60,40,30,0.28),rgba(0,0,0,0) 70%);filter:blur(10px);transform:skewX(-30deg)}
      .cap{position:absolute;left:24px;bottom:18px;color:#5C6B6A;font-size:14px}</style></head><body>
      <div class="scene"><div class="shadow"></div><div class="box">
        ${face("front", `width:${W * k}px;height:${H * k}px;transform:translateZ(${D * k}px)`)}
        ${face("side_ru", `width:${D * k}px;height:${H * k}px;transform:rotateY(90deg) translateZ(${W * k}px)`)}
        ${face("top", `width:${W * k}px;height:${D * k}px;transform:rotateX(90deg)`, 180)}
      </div></div>
      <div class="cap">${r.sku} · ${W.toFixed(1)}×${D.toFixed(1)}×${H.toFixed(1)} мм (внешние) · размеры условные [ЗАПОЛНИТЬ замеры]</div></body></html>`;
    const p3 = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
    await p3.setContent(html);
    await p3.screenshot({ path: path.join(OUT, `box_3d_${r.sku}.png`) });
    await p3.close();
    await page.close();
    console.log(r.sku, "ok");
  }
  await b.close();
})();
