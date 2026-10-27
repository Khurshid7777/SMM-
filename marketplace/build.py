#!/usr/bin/env python3
"""Слайды карточки Uzum / WB: 8 шаблонов × 4 SKU × 2 языка → HTML (1080×1440), затем render.cjs → PNG.

Запуск:  python3 marketplace/build.py && node marketplace/render.cjs
Пишет:   marketplace/out/html/<lang>/<SKU>/slide_NN.html + manifest.json
Тексты — data/copy.<lang>.json (slides, brand), размеры — data/skus.json, токены — brand/tokens.json,
логотип — brand/logo/A, визуалы — packaging/out (3D-макет, лицо коробки), renders/ (GPT, референс материала).
Где GPT-рендера ещё нет — плейсхолдер с подписью (P1, P4, P5 по ТЗ-1 раздел 4).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "packaging"))
sys.path.insert(0, str(ROOT / "brand"))
import segno  # noqa: E402

OUT = ROOT / "marketplace" / "out"
TOK = json.loads((ROOT / "brand" / "tokens.json").read_text())
C = {k: v["hex"] for k, v in TOK["colors"].items()}
SKUS = json.loads((ROOT / "data" / "skus.json").read_text())
COPY = {lang: json.loads((ROOT / "data" / f"copy.{lang}.json").read_text()) for lang in ("ru", "uz-latn")}
W, H = 1080, 1440
LOGO = "A"


def file_url(p: Path) -> str:
    return "file://" + str(p)


def logo_svg(name: str) -> str:
    src = (ROOT / "brand" / "logo" / LOGO / f"{name}.svg").read_text()
    return re.sub(r'<svg ', '<svg class="logo" ', src, count=1)


def icon(name: str, size: int = 56, color: str | None = None) -> str:
    src = (ROOT / "brand" / "icons" / f"{name}.svg").read_text()
    inner = src[src.index(">", src.index("<svg")) + 1 : src.rindex("</svg>")]
    return f'<svg width="{size}" height="{size}" viewBox="0 0 48 48" fill="none" stroke="{color or C["teal_deep"]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{inner}</svg>'


# Иконки показаний и шагов — линейные, в одном стиле с brand/icons
ICONS = {
    "surgery": '<path d="M10 38 30 18"/><path d="M28 12l8 8-4 4-8-8z"/><path d="M12 36l-3 3"/>',
    "csection": '<path d="M24 8c8 0 14 7 14 16s-6 16-14 16S10 33 10 24 16 8 24 8Z"/><path d="M14 26h20"/>',
    "burn": '<path d="M24 8c2 7 8 9 8 17a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 2 4 3 4 0-5-1-9 1-13Z"/>',
    "injury": '<rect x="6" y="18" width="36" height="12" rx="6" transform="rotate(-30 24 24)"/><path d="M20 22l8 4M22 19l8 4M18 25l8 4"/>',
    "hyper": '<path d="M6 32c8 0 10-10 18-10s10 10 18 10"/><path d="M6 38h36"/>',
    "keloid": '<path d="M6 34c6 0 6-14 18-14s12 14 18 14"/><path d="M18 30c2-4 10-4 12 0"/><path d="M6 40h36"/>',
    "clean": '<path d="M12 30c4-6 20-6 24 0"/><path d="M24 10c-4 6-4 10 0 12 4-2 4-6 0-12Z"/>',
    "cut": '<circle cx="15" cy="33" r="5"/><circle cx="15" cy="15" r="5"/><path d="M19 18l19 14M19 30l19-14"/>',
    "apply": '<path d="M8 34c6-10 26-10 32 0"/><rect x="15" y="16" width="18" height="9" rx="3"/>',
    "wear": '<circle cx="24" cy="24" r="14"/><path d="M24 14v10l7 4"/>',
    "soft": '<path d="M8 30c8-10 24-10 32 0"/><path d="M14 36c6-5 14-5 20 0"/>',
    "flat": '<path d="M6 30h36"/><path d="M10 24c6-4 22-4 28 0"/>',
    "fade": '<circle cx="24" cy="24" r="12" stroke-dasharray="4 4"/><circle cx="24" cy="24" r="5"/>',
}


def gicon(key: str, size: int = 56, color: str | None = None) -> str:
    return f'<svg width="{size}" height="{size}" viewBox="0 0 48 48" fill="none" stroke="{color or C["teal_deep"]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{ICONS[key]}</svg>'


def qr_svg(url: str, size: int) -> str:
    q = segno.make(url, error="m")
    n = q.symbol_size(border=0)[0]
    cell = size / n
    d = "".join(f"M{x * cell:.1f} {y * cell:.1f}h{cell:.1f}v{cell:.1f}h-{cell:.1f}z" for y, row in enumerate(q.matrix) for x, v in enumerate(row) if v)
    return f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}"><path fill="{C["teal_deep"]}" d="{d}"/></svg>'


def cropped_box3d(sku: str) -> Path:
    """3D-макет коробки без подписи и фона-прямоугольника: обрезка по области коробки."""
    from PIL import Image
    src = ROOT / "packaging" / "out" / f"box_3d_{sku}.png"
    dst = OUT / "assets" / f"box3d_{sku}.png"
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        im = Image.open(src).convert("RGB")
        im.crop((150, 230, 1150, 960)).save(dst)
    return dst


def skin_scheme_svg(lang: str = "ru") -> str:
    """Схема кожи в разрезе: лента, эпидермис, дерма, капли влаги — крупная версия для слайда 3."""
    teal, nude = C["teal_soft"], C["nude"]
    drops = "".join(f'<circle cx="{120 + i * 100}" cy="150" r="9" fill="#fff" opacity=".95"/>' for i in range(6))
    return f'''<svg viewBox="0 0 700 360" width="100%" style="display:block">
      <rect x="0" y="120" width="700" height="80" rx="6" fill="{nude}"/>
      <rect x="0" y="200" width="700" height="160" rx="6" fill="#DDB9A6"/>
      <path d="M250 125 Q350 70 450 125" fill="#D9B0A0"/>
      <rect x="60" y="78" width="580" height="46" rx="23" fill="{teal}"/>
      {drops}
      <g font-family="Inter, sans-serif" font-size="20" fill="{C["teal_deep"]}" font-weight="600">
        <text x="20" y="60">Silicare</text><text x="20" y="240" fill="#fff">{"эпидермис" if lang == "ru" else "epidermis"}</text><text x="20" y="330" fill="#fff">{"дерма" if lang == "ru" else "derma"}</text>
      </g>
    </svg>'''


# ——— Страница ———

def page(lang: str, body: str, bg: str = C["bg"]) -> str:
    heading = "Manrope" if lang == "ru" else "Inter"
    fonts = "\n".join(
        f'@font-face{{font-family:"{fam}";src:url("{file_url(ROOT / "brand" / "fonts" / f"{fam.lower()}-{sub}-wght-normal.woff2")}") format("woff2");font-weight:100 900;font-display:block}}'
        for fam, subs in (("Manrope", ["latin", "latin-ext", "cyrillic"]), ("Inter", ["latin", "latin-ext", "cyrillic", "cyrillic-ext"]))
        for sub in subs
    )
    return f'''<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><style>
{fonts}
:root{{--bg:{bg};--deep:{C["teal_deep"]};--soft:{C["teal_soft"]};--nude:{C["nude"]};--text2:{C["text2"]};--white:#fff}}
*{{box-sizing:border-box;margin:0}}
html,body{{width:{W}px;height:{H}px;overflow:hidden}}
body{{background:var(--bg);color:var(--deep);font-family:Inter,sans-serif;position:relative}}
h1,h2{{font-family:{heading},Inter,sans-serif;font-weight:700;letter-spacing:-.015em;line-height:1.08}}
h1{{font-size:78px}} h2{{font-size:62px}}
.sub{{font-size:34px;line-height:1.3;color:var(--deep);font-weight:400}}
.note{{font-size:26px;line-height:1.3;color:var(--text2)}}
.pad{{position:absolute;inset:0;padding:72px 64px}}
.logo{{width:260px;height:auto}}
.plate{{display:inline-flex;align-items:center;background:var(--deep);color:var(--bg);font-family:{heading},Inter,sans-serif;font-weight:700;font-size:40px;padding:14px 34px;border-radius:999px;white-space:nowrap}}
.chip{{display:inline-flex;align-items:center;gap:14px;background:var(--white);border-radius:999px;padding:16px 28px;font-size:30px;font-weight:600;color:var(--deep);box-shadow:0 2px 10px rgba(30,74,76,.08)}}
.ph{{border:3px dashed var(--soft);border-radius:24px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--text2);font-size:24px;line-height:1.3;padding:24px;background:rgba(143,201,194,.08)}}
.tile{{background:var(--white);border-radius:28px;padding:30px 28px;display:flex;flex-direction:column;gap:18px;justify-content:flex-end;min-height:0}}
.tile b{{font-size:30px;font-weight:600;line-height:1.15}}
.foot{{position:absolute;left:64px;right:64px;bottom:60px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px}}
.num{{font-family:{heading},Inter,sans-serif;font-weight:800;font-size:36px;width:64px;height:64px;border-radius:50%;background:var(--soft);color:var(--deep);display:grid;place-items:center;flex:none}}
img{{display:block}}
</style></head><body>{body}</body></html>'''


def fmt_len(v: float) -> str:
    return str(v).replace(".", ",").rstrip("0").rstrip(",") if "." in str(v) else str(v)


# ——— Слайды ———

def slide1(lang, s, cp):
    sl = cp["slides"][0]
    unit, munit = ("см", "м") if lang == "ru" else ("sm", "m")
    box3d = cropped_box3d(s["sku"])
    icons = zip(["medical-silicone", "reusable", "cut-to-size"], cp["box"]["icons"])
    return f'''<div class="pad">
      {logo_svg("full_" + ("ru" if lang == "ru" else "uz-latn"))}
      <h1 style="margin-top:36px;max-width:900px">{sl["title"]}</h1>
      <div style="margin-top:26px"><span class="plate">{s["width_mm"] // 10} {unit} × {fmt_len(s["length_m"])} {munit}</span></div>
      <div style="position:absolute;left:40px;right:40px;top:470px;height:640px;display:flex;align-items:center;justify-content:center">
        <img src="{file_url(box3d)}" style="height:640px;width:auto;object-fit:contain;mix-blend-mode:multiply">
        <div style="position:absolute;right:24px;top:8px;font-size:22px;color:var(--text2);background:var(--white);padding:8px 16px;border-radius:999px">P1 · GPT-рендер → заменит 3D-макет</div>
      </div>
      <div class="foot">{"".join(f'<div style="display:flex;align-items:center;gap:16px;flex:1"><div style="width:84px;height:84px;border-radius:24px;background:var(--white);display:grid;place-items:center">{icon(ic, 48)}</div><b style="font-size:28px;font-weight:600;line-height:1.1">{cap}</b></div>' for ic, cap in icons)}</div>
    </div>'''


def slide2(lang, s, cp):
    sl = cp["slides"][1]
    arm = ROOT / "renders" / "gpt_raw" / "R2_skin_forearm.png"
    chips = "".join(f'<span class="chip">{gicon(k, 40)}{b}</span>' for k, b in zip(["soft", "flat", "fade"], sl["bullets"]))
    return f'''<div style="position:absolute;right:-80px;top:120px;width:760px;height:1140px;overflow:hidden">
      <img src="{file_url(arm)}" style="width:100%;height:100%;object-fit:contain;object-position:right top;opacity:.95">
    </div>
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,{C["nude"]} 42%,rgba(232,205,191,0) 72%)"></div>
    <div class="pad">
      <h1 style="max-width:620px">{sl["title"]}</h1>
      <p class="sub" style="max-width:560px;margin-top:28px">{sl["sub"]}</p>
      <div style="display:flex;flex-direction:column;gap:18px;align-items:flex-start;margin-top:40px">{chips}</div>
      <div class="foot"><span class="note">{cp["brand"]["trust_line"]}</span><span class="note">P5 · фото нанесения → GPT</span></div>
    </div>'''


def slide3(lang, s, cp):
    sl = cp["slides"][2]
    return f'''<div class="pad">
      <h1 style="max-width:900px">{sl["title"]}</h1>
      <p class="sub" style="max-width:900px;margin-top:26px">{sl["sub"]}</p>
      <div style="margin-top:44px;background:var(--white);border-radius:32px;padding:36px">{skin_scheme_svg(lang)}</div>
      <div class="foot"><p class="note" style="max-width:860px">{sl["footnote"]}<br><span style="font-size:20px">{sl["footnote_source"]}</span></p></div>
    </div>'''


def slide4(lang, s, cp):
    sl = cp["slides"][3]
    keys = ["surgery", "csection", "burn", "injury", "hyper", "keloid"]
    tiles = "".join(f'<div class="tile">{gicon(k, 110)}<b style="font-size:34px">{t}</b></div>' for k, t in zip(keys, sl["tiles"]))
    return f'''<div class="pad">
      <h1>{sl["title"]}</h1>
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:280px;gap:20px;margin-top:40px">{tiles}</div>
      <div class="foot"><span class="note">{sl["footnote"]}</span></div>
    </div>'''


def slide5(lang, s, cp):
    sl = cp["slides"][4]
    keys = ["clean", "cut", "apply", "wear"]
    rows = "".join(f'<div style="display:flex;align-items:center;gap:26px;background:var(--white);border-radius:28px;padding:26px 30px"><span class="num">{i + 1}</span>{gicon(k, 64)}<b style="font-size:34px;font-weight:600;line-height:1.15">{t}</b></div>' for i, (k, t) in enumerate(zip(keys, sl["steps"])))
    return f'''<div class="pad">
      <h1>{sl["title"]}</h1>
      <div style="display:grid;gap:18px;margin-top:40px">{rows}</div>
      <div class="ph" style="position:absolute;left:64px;right:64px;top:850px;height:430px">P4 · руки режут ленту / P5 · нанесение — фото от GPT или съёмка<br>(плейсхолдер, этап 6)</div>
    </div>'''


def slide6(lang, s, cp):
    sl = cp["slides"][5]
    n = len(sl["timeline"])
    pts = "".join(
        f'<div style="display:flex;flex-direction:column;gap:14px;align-items:flex-start"><div style="width:28px;height:28px;border-radius:50%;background:{C["teal_deep"] if i == n - 1 else C["teal_soft"]};outline:8px solid var(--bg)"></div><b style="font-family:inherit;font-size:34px;font-weight:700">{p["t"]}</b><span style="font-size:24px;line-height:1.25;color:var(--text2);max-width:220px">{p["text"]}</span></div>'
        for i, p in enumerate(sl["timeline"])
    )
    return f'''<div class="pad">
      <h1 style="max-width:900px">{sl["title"]}</h1>
      <div style="position:relative;margin-top:120px">
        <div style="position:absolute;left:14px;right:14px;top:14px;height:6px;background:linear-gradient(90deg,var(--soft),var(--deep));border-radius:3px"></div>
        <div style="display:grid;grid-template-columns:repeat({n},1fr);gap:16px;position:relative">{pts}</div>
      </div>
      <div class="foot"><span class="note" style="max-width:900px">{sl["footnote"]}</span></div>
    </div>'''


def slide7(lang, s, cp):
    sl = cp["slides"][6]
    cards = []
    for z in sl["sizes"]:
        cur = z["sku"] == s["sku"]
        front = ROOT / "packaging" / "out" / f"box_front_{z['sku']}.png"
        cards.append(f'''<div style="background:{"var(--white)" if cur else "transparent"};border:4px solid {"var(--deep)" if cur else "transparent"};border-radius:28px;padding:22px;display:flex;flex-direction:column;gap:14px;align-items:center;text-align:center">
          <img src="{file_url(front)}" style="width:100%;height:auto;border-radius:12px;box-shadow:0 10px 30px rgba(30,74,76,.12)">
          <b style="font-size:30px;font-weight:700">{z["label"]}</b><span style="font-size:22px;color:var(--text2);line-height:1.2">{z["use"]}</span></div>''')
    return f'''<div class="pad">
      <h1>{sl["title"]}</h1>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:36px">{"".join(cards)}</div>
      <div class="foot"><span class="chip" style="font-size:26px">{sl["rule"]}</span></div>
    </div>'''


def slide8(lang, s, cp):
    sl = cp["slides"][7]
    ref = ROOT / "renders" / "reference" / "silicone_material_ref.jpg"
    return f'''<div style="position:absolute;left:0;right:0;top:0;height:720px;overflow:hidden"><img src="{file_url(ref)}" style="width:100%;height:100%;object-fit:cover;object-position:center 55%"></div>
    <div style="position:absolute;left:0;right:0;top:600px;height:140px;background:linear-gradient(180deg,rgba(246,244,240,0),var(--bg))"></div>
    <div style="position:absolute;right:64px;top:64px;background:var(--white);padding:18px;border-radius:20px;box-shadow:0 10px 30px rgba(30,74,76,.15)">{qr_svg("https://instagram.com/sil.icare", 170)}<div style="text-align:center;font-size:20px;color:var(--text2);margin-top:8px">@sil.icare</div></div>
    <div class="pad" style="top:720px">
      <h1 style="max-width:900px">{sl["title"]}</h1>
      <p class="sub" style="max-width:700px;margin-top:24px">{sl["sub"]}</p>
      <div class="foot"><span class="note">{sl["footnote"]}</span>{logo_svg("horizontal").replace('class="logo"', 'class="logo" style="width:300px"')}</div>
    </div>'''


SLIDES = [slide1, slide2, slide3, slide4, slide5, slide6, slide7, slide8]


def main():
    manifest = []
    for lang in ("ru", "uz-latn"):
        cp = COPY[lang]
        for s in SKUS["skus"]:
            d = OUT / "html" / lang / s["sku"]
            d.mkdir(parents=True, exist_ok=True)
            for i, fn in enumerate(SLIDES, 1):
                bg = C["nude"] if i == 2 else C["bg"]
                html = page(lang, fn(lang, s, cp), bg)
                f = d / f"slide_{i:02d}.html"
                f.write_text(html)
                manifest.append({"lang": lang, "sku": s["sku"], "n": i, "html": str(f), "png": str(OUT / lang / s["sku"] / f"slide_{i:02d}.png"), "wb": str(OUT / lang / s["sku"] / f"slide_{i:02d}_900x1200.png")})
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print("ok:", len(manifest), "слайдов HTML")


if __name__ == "__main__":
    main()
