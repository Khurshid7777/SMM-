#!/usr/bin/env python3
"""После render.cjs: версии 900×1200 для WB и контрольные листы 200 px (проверка читаемости превью)."""
import json
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent / "out"
man = json.loads((OUT / "manifest.json").read_text())
groups = {}
for m in man:
    p = Path(m["png"])
    if not p.exists():
        continue
    im = Image.open(p)
    im.resize((900, 1200), Image.LANCZOS).save(m["wb"])
    groups.setdefault((m["lang"], m["sku"]), []).append(im.resize((200, 267), Image.LANCZOS))
(OUT / "preview").mkdir(exist_ok=True)
for (lang, sku), ims in groups.items():
    sheet = Image.new("RGB", (200 * 8 + 7 * 8, 267), "#FFFFFF")
    for i, im in enumerate(ims):
        sheet.paste(im, (i * 208, 0))
    sheet.save(OUT / "preview" / f"{lang}_{sku}_200px.png")
print("wb + preview:", len(groups), "наборов")
