#!/usr/bin/env python3
"""Коробка Silicare: расчёт размеров, развёртка (straight tuck end), печать по слоям, отчёт.

Запуск:  python3 packaging/dieline.py            # все SKU
Пишет в packaging/out/:
  report.md                         формула намотки, размеры, «1 или 2 штампа», пустота, предупреждения
  dieline_<SKU>.svg                 все слои (print, varnish, crease, cut) — для просмотра
  dieline_<SKU>_<layer>.svg         слой отдельно: print | varnish | crease | cut
  dieline_<SKU>_inside.svg          печать на обороте: внутренняя сторона крышки (QR)
  manifest.json                     список файлов и размеров для packaging/render.cjs (PDF/PNG/3D)
Единицы — мм. Тексты — data/copy.*.json, маркировка — data/legal.json, размеры — data/skus.json.
Весь текст в кривых (шрифты из brand/fonts через brand/build.py).
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "brand"))
import build as brand  # noqa: E402  (Face, PALETTE, text_paths)
import segno  # noqa: E402

OUT = ROOT / "packaging" / "out"
TOK = json.loads((ROOT / "brand" / "tokens.json").read_text())
C = {k: v["hex"] for k, v in TOK["colors"].items()}
SKUS = json.loads((ROOT / "data" / "skus.json").read_text())
LEGAL = json.loads((ROOT / "data" / "legal.json").read_text())
COPY = {lang: json.loads((ROOT / "data" / f"copy.{lang}.json").read_text())["box"] for lang in ("ru", "uz-latn")}
LOGO_VARIANT = "A"

PT = 0.352778  # 1 pt в мм
BLEED = 3.0
SAFE = 3.0
GLUE = 13.0
TONGUE = 15.0
CREASE_ALLOW = 0.5  # +0,5 мм на каждый биг

CUT = "#FF0000"
CREASE = "#0000FF"
VARNISH = "#FF00FF"

warnings: list[str] = []


def warn(msg: str):
    if msg not in warnings:
        warnings.append(msg)


def fmt(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")


# ——— Расчёт ———


def val(x):
    return x["value"] if isinstance(x, dict) else x


def winding_length(D: float, d: float, t: float) -> float:
    """L = π(D² − d²) / (4t), мм."""
    return math.pi * (D * D - d * d) / (4 * t)


def winding_diameter(L_mm: float, d: float, t: float) -> float:
    return math.sqrt(d * d + 4 * t * L_mm / math.pi)


def sku_geometry(s: dict) -> dict:
    com = SKUS["common"]
    t = val(com["tape_thickness_mm"])
    d = val(com["core_diameter_mm"])
    D_meas = val(s.get("outer_diameter_mm"))
    D = D_meas if D_meas else winding_diameter(s["length_m"] * 1000, d, t)
    board = com["board_mm"]
    # конструктивный минимум грани — иначе маркировка 6 pt не помещается
    inner_side = max(D + 3, val(com["min_panel_mm"]) - board - CREASE_ALLOW)
    inner_h = s["width_mm"] + 3 + val(com["pouch_mm"]) + val(com["leaflet_mm"])
    return {
        "D": D,
        "D_measured": bool(D_meas),
        "d": d,
        "t": t,
        "inner_side": inner_side,
        "inner_h": inner_h,
        # размеры панелей развёртки: внутренний + картон + припуск на биг
        "W": inner_side + board + CREASE_ALLOW,
        "H": inner_h + board + CREASE_ALLOW,
        "void_pct": (1 - (math.pi * D * D / 4 * s["width_mm"]) / (inner_side * inner_side * inner_h)) * 100,
    }


# ——— Текст в кривых ———

_faces: dict[tuple[str, int], brand.Face] = {}


def face(role: str, weight: int) -> brand.Face:
    key = (role, weight)
    if key not in _faces:
        _faces[key] = brand.Face(brand.FONTS[role]["files"], weight)
    return _faces[key]


def face_for(lang: str, heading: bool) -> brand.Face:
    if heading:
        return face("heading" if lang == "ru" else "heading_uz", 600)
    return face("body", 400)


def wrap(f: brand.Face, text: str, size_mm: float, max_w: float) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if f.width(cand, size_mm) <= max_w or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def text(f: brand.Face, s: str, x: float, y: float, size_mm: float, fill: str, anchor: str = "start", opacity: float = 1) -> str:
    """Одна строка в кривых. y — базовая линия."""
    w = f.width(s, size_mm)
    if anchor == "end":
        x -= w
    elif anchor == "middle":
        x -= w / 2
    paths, _ = brand.text_paths(f, s, x, y, size_mm)
    op = "" if opacity == 1 else f' fill-opacity="{opacity}"'
    return f'<path fill="{fill}"{op} d="{" ".join(paths)}"/>'


class Block:
    """Текстовый блок с переносом; накапливает высоту, сообщает о переполнении."""

    def __init__(self, x: float, y: float, w: float, h: float, tag: str):
        self.x, self.y, self.w, self.h, self.tag = x, y, w, h, tag
        self.cy = y
        self.out: list[str] = []

    def line(self, f: brand.Face, s: str, pt: float, fill: str, lh: float = 1.25, gap_after: float = 0):
        size = pt * PT
        for ln in wrap(f, s, size, self.w):
            self.cy += size
            self.out.append(text(f, ln, self.x, self.cy, size, fill))
            self.cy += size * (lh - 1)
        self.cy += gap_after

    def para(self, lang: str, title: str | None, body: str, pt: float = 6, title_pt: float = 6):
        if title:
            self.line(face_for(lang, True), title, title_pt, C["teal_deep"], lh=1.15, gap_after=0.2)
        self.line(face_for(lang, False), body, pt, C["teal_deep"], lh=1.18, gap_after=0.9)

    def done(self) -> str:
        if self.cy > self.y + self.h + 0.3:
            warn(f"{self.tag}: текст выходит за блок на {self.cy - (self.y + self.h):.1f} мм — сократить или уменьшить")
        return "\n".join(self.out)


# ——— Графика ———


def logo_svg(name: str, x: float, y: float, w: float, fill_override: str | None = None) -> str:
    src = (ROOT / "brand" / "logo" / LOGO_VARIANT / f"{name}.svg").read_text()
    vb = re.search(r'viewBox="([^"]+)"', src).group(1)
    inner = src[src.index(">", src.index("<svg")) + 1 : src.rindex("</svg>")]
    vx, vy, vw, vh = (float(v) for v in vb.split())
    h = w * vh / vw
    if fill_override:
        inner = re.sub(r'fill="#[0-9A-Fa-f]{6}"', f'fill="{fill_override}"', inner)
        inner = re.sub(r' fill-opacity="[^"]+"', "", inner)
    return f'<svg x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" viewBox="{vb}">{inner}</svg>'


def logo_height(name: str, w: float) -> float:
    src = (ROOT / "brand" / "logo" / LOGO_VARIANT / f"{name}.svg").read_text()
    vx, vy, vw, vh = (float(v) for v in re.search(r'viewBox="([^"]+)"', src).group(1).split())
    return w * vh / vw


def icon_svg(name: str, x: float, y: float, size: float, color: str) -> str:
    src = (ROOT / "brand" / "icons" / f"{name}.svg").read_text()
    inner = src[src.index(">", src.index("<svg")) + 1 : src.rindex("</svg>")]
    return (
        f'<svg x="{fmt(x)}" y="{fmt(y)}" width="{fmt(size)}" height="{fmt(size)}" viewBox="0 0 48 48" fill="none" '
        f'stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">{inner}</svg>'
    )


STEP_ICONS = {
    "clean": '<path d="M12 30c4-6 20-6 24 0"/><path d="M24 10c-4 6-4 10 0 12 4-2 4-6 0-12Z"/>',
    "cut": '<circle cx="15" cy="33" r="5"/><circle cx="15" cy="15" r="5"/><path d="M19 18l19 14M19 30l19-14"/>',
    "apply": '<path d="M8 34c6-10 26-10 32 0"/><rect x="15" y="16" width="18" height="9" rx="3"/>',
    "wear": '<circle cx="24" cy="24" r="14"/><path d="M24 14v10l7 4"/>',
}


def step_icon(key: str, x: float, y: float, size: float, color: str) -> str:
    return (
        f'<svg x="{fmt(x)}" y="{fmt(y)}" width="{fmt(size)}" height="{fmt(size)}" viewBox="0 0 48 48" fill="none" '
        f'stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">{STEP_ICONS[key]}</svg>'
    )


def roll_illustration(x: float, y: float, D: float, width: float, scale: float, band_to_x: float) -> str:
    """Рулон (вид ¾ упрощённо: круг) с отмотанной лентой влево. scale — масштаб к 1:1."""
    R = D / 2 * scale
    r = SKUS["common"]["core_diameter_mm"]["value"] / 2 * scale
    bw = width * scale
    cx, cy = x, y
    tape = C["nude"]
    dark = "#D9B9A6"
    y_top, y_bot = cy + R - bw, cy + R
    xm = band_to_x + (cx - band_to_x) * 0.5
    els = [
        # лента: полоса шириной bw выходит из-под рулона влево, с мягкой волной
        f'<path fill="{tape}" d="M{fmt(cx)} {fmt(y_top)} C{fmt(xm)} {fmt(y_top)} {fmt(xm)} {fmt(y_top - 1.2 * scale)} {fmt(band_to_x)} {fmt(y_top - 1.2 * scale)} '
        f'L{fmt(band_to_x)} {fmt(y_bot - 1.2 * scale)} C{fmt(xm)} {fmt(y_bot - 1.2 * scale)} {fmt(xm)} {fmt(y_bot)} {fmt(cx)} {fmt(y_bot)} Z"/>',
        f'<path fill="none" stroke="{dark}" stroke-width="0.15" d="M{fmt(cx)} {fmt(y_top)} C{fmt(xm)} {fmt(y_top)} {fmt(xm)} {fmt(y_top - 1.2 * scale)} {fmt(band_to_x)} {fmt(y_top - 1.2 * scale)}"/>',
        f'<rect x="{fmt(band_to_x)}" y="{fmt(y_top - 1.2 * scale + bw * 0.12)}" width="{fmt((cx - band_to_x) * 0.55)}" height="{fmt(bw * 0.1)}" rx="{fmt(bw * 0.05)}" fill="#FFFFFF" fill-opacity="0.45"/>',
        f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(R)}" fill="{tape}"/>',
        f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(R)}" fill="none" stroke="{dark}" stroke-width="{fmt(0.25 * scale + 0.1)}"/>',
        # витки
        *[
            f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r + (R - r) * k)}" fill="none" stroke="{dark}" stroke-opacity="0.35" stroke-width="0.15"/>'
            for k in (0.3, 0.55, 0.8)
        ],
        # блик
        f'<path d="M{fmt(cx - R * 0.55)} {fmt(cy - R * 0.55)} A{fmt(R * 0.78)} {fmt(R * 0.78)} 0 0 1 {fmt(cx + R * 0.15)} {fmt(cy - R * 0.77)}" '
        f'fill="none" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="{fmt(0.5 * scale + 0.15)}" stroke-linecap="round"/>',
        f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r)}" fill="#FFFFFF"/>',
        f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r)}" fill="none" stroke="#E3DED8" stroke-width="0.2"/>',
    ]
    return "\n".join(els)


def skin_scheme(x: float, y: float, w: float, h: float) -> str:
    """Схема кожи в разрезе: лента сверху, эпидермис, дерма, капли влаги под лентой."""
    ep = h * 0.3
    els = [
        f'<rect x="{fmt(x)}" y="{fmt(y + h * 0.22)}" width="{fmt(w)}" height="{fmt(ep)}" rx="1" fill="{C["nude"]}"/>',
        f'<rect x="{fmt(x)}" y="{fmt(y + h * 0.22 + ep)}" width="{fmt(w)}" height="{fmt(h - h * 0.22 - ep)}" rx="1" fill="#DDB9A6"/>',
        f'<rect x="{fmt(x + w * 0.12)}" y="{fmt(y + h * 0.08)}" width="{fmt(w * 0.76)}" height="{fmt(h * 0.16)}" rx="{fmt(h * 0.08)}" fill="{C["teal_soft"]}" fill-opacity="0.9"/>',
        # рубец — мягкий бугорок
        f'<path d="M{fmt(x + w * 0.4)} {fmt(y + h * 0.24)} Q{fmt(x + w * 0.5)} {fmt(y + h * 0.1)} {fmt(x + w * 0.6)} {fmt(y + h * 0.24)}" fill="#D9B0A0" stroke="none"/>',
    ]
    for i in range(5):
        cx = x + w * (0.2 + i * 0.15)
        els.append(f'<circle cx="{fmt(cx)}" cy="{fmt(y + h * 0.36)}" r="{fmt(h * 0.045)}" fill="#FFFFFF" fill-opacity="0.9"/>')
    return "\n".join(els)


def qr_svg(url: str, x: float, y: float, size: float) -> str:
    q = segno.make(url, error="m")
    n = q.symbol_size(border=0)[0]
    cell = size / n
    rects = []
    for ry, row in enumerate(q.matrix):
        for rx, v in enumerate(row):
            if v:
                rects.append(f"M{fmt(x + rx * cell)} {fmt(y + ry * cell)}h{fmt(cell)}v{fmt(cell)}h-{fmt(cell)}z")
    return f'<path fill="{C["teal_deep"]}" d="{"".join(rects)}"/>'


# ——— EAN-13 ———

EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"]
EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"]
EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"]
EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"]


def ean13_valid(code: str) -> bool:
    if not re.fullmatch(r"\d{13}", code):
        return False
    s = sum(int(c) * (3 if i % 2 else 1) for i, c in enumerate(code[:12]))
    return (10 - s % 10) % 10 == int(code[12])


def ean13_svg(code: str, x: float, y: float, w: float = 31.35, h: float = 22.85) -> str:
    """EAN-13 при 85 % от номинала (37,29×25,93 мм). Белая подложка входит в w×h."""
    if not ean13_valid(code):
        return (
            f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" fill="#FFFFFF" stroke="{C["text2"]}" stroke-width="0.2" stroke-dasharray="1 0.8"/>'
            + text(face("body", 500), "EAN-13", x + w / 2, y + h / 2 - 1, 2.2, C["text2"], "middle")
            + text(face("body", 400), "[ЗАПОЛНИТЬ]", x + w / 2, y + h / 2 + 2.2, 2, C["text2"], "middle")
        )
    bits = "101"
    for i, ch in enumerate(code[1:7]):
        bits += (EAN_L if EAN_PARITY[int(code[0])][i] == "L" else EAN_G)[int(ch)]
    bits += "01010"
    for ch in code[7:]:
        bits += EAN_R[int(ch)]
    bits += "101"
    module = w / 113  # 95 модулей + тихие зоны 9 + 9
    x0 = x + 9 * module
    bar_h = h - 4.5
    els = [f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" fill="#FFFFFF"/>']
    for i, b in enumerate(bits):
        if b == "1":
            guard = i < 3 or 45 <= i < 50 or i >= 92
            els.append(f'<rect x="{fmt(x0 + i * module)}" y="{fmt(y + 1)}" width="{fmt(module)}" height="{fmt(bar_h + (1.6 if guard else 0))}" fill="#000000"/>')
    f = face("body", 400)
    els.append(text(f, code[0], x0 - 1.2 * module, y + h - 0.6, 2.4, "#000000", "end"))
    els.append(text(f, code[1:7], x0 + 24 * module, y + h - 0.6, 2.4, "#000000", "middle"))
    els.append(text(f, code[7:], x0 + 71 * module, y + h - 0.6, 2.4, "#000000", "middle"))
    return "\n".join(els)


# ——— Символы ISO 15223-1 (упрощённые, 1 = сторона квадрата) ———


def iso_symbol(key: str, x: float, y: float, s: float, color: str) -> str:
    st = f'fill="none" stroke="{color}" stroke-width="{fmt(s * 0.07)}" stroke-linecap="round" stroke-linejoin="round"'
    box = f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(s)}" height="{fmt(s)}" {st}/>'
    f = face("body", 500)
    if key == "manufacturer":
        return f'<path d="M{fmt(x + s * 0.15)} {fmt(y + s * 0.8)} V{fmt(y + s * 0.45)} L{fmt(x + s * 0.4)} {fmt(y + s * 0.6)} V{fmt(y + s * 0.45)} L{fmt(x + s * 0.65)} {fmt(y + s * 0.6)} V{fmt(y + s * 0.45)} L{fmt(x + s * 0.85)} {fmt(y + s * 0.6)} V{fmt(y + s * 0.8)} Z M{fmt(x + s * 0.2)} {fmt(y + s * 0.45)} V{fmt(y + s * 0.2)} H{fmt(x + s * 0.32)} V{fmt(y + s * 0.4)}" {st}/>'
    if key == "ref":
        return box + text(f, "REF", x + s / 2, y + s * 0.68, s * 0.42, color, "middle")
    if key == "lot":
        return box + text(f, "LOT", x + s / 2, y + s * 0.68, s * 0.42, color, "middle")
    if key == "exp":
        return f'<path d="M{fmt(x + s * 0.25)} {fmt(y + s * 0.15)} H{fmt(x + s * 0.75)} M{fmt(x + s * 0.25)} {fmt(y + s * 0.85)} H{fmt(x + s * 0.75)} M{fmt(x + s * 0.3)} {fmt(y + s * 0.15)} C{fmt(x + s * 0.3)} {fmt(y + s * 0.5)} {fmt(x + s * 0.7)} {fmt(y + s * 0.5)} {fmt(x + s * 0.7)} {fmt(y + s * 0.85)} M{fmt(x + s * 0.7)} {fmt(y + s * 0.15)} C{fmt(x + s * 0.7)} {fmt(y + s * 0.5)} {fmt(x + s * 0.3)} {fmt(y + s * 0.5)} {fmt(x + s * 0.3)} {fmt(y + s * 0.85)}" {st}/>'
    if key == "consult-ifu":
        return f'<path d="M{fmt(x + s * 0.2)} {fmt(y + s * 0.2)} H{fmt(x + s * 0.8)} V{fmt(y + s * 0.8)} H{fmt(x + s * 0.2)} Z M{fmt(x + s * 0.5)} {fmt(y + s * 0.2)} V{fmt(y + s * 0.8)}" {st}/>' + text(f, "i", x + s * 0.35, y + s * 0.65, s * 0.3, color, "middle")
    if key == "keep-dry":
        return f'<path d="M{fmt(x + s * 0.15)} {fmt(y + s * 0.5)} A{fmt(s * 0.35)} {fmt(s * 0.35)} 0 0 1 {fmt(x + s * 0.85)} {fmt(y + s * 0.5)} Z M{fmt(x + s * 0.5)} {fmt(y + s * 0.5)} V{fmt(y + s * 0.82)} M{fmt(x + s * 0.3)} {fmt(y + s * 0.2)} L{fmt(x + s * 0.25)} {fmt(y + s * 0.3)} M{fmt(x + s * 0.7)} {fmt(y + s * 0.2)} L{fmt(x + s * 0.75)} {fmt(y + s * 0.3)}" {st}/>'
    if key == "do-not-use-if-damaged":
        return f'<path d="M{fmt(x + s * 0.2)} {fmt(y + s * 0.3)} H{fmt(x + s * 0.8)} V{fmt(y + s * 0.75)} H{fmt(x + s * 0.2)} Z M{fmt(x + s * 0.5)} {fmt(y + s * 0.3)} L{fmt(x + s * 0.42)} {fmt(y + s * 0.5)} L{fmt(x + s * 0.58)} {fmt(y + s * 0.6)} L{fmt(x + s * 0.5)} {fmt(y + s * 0.75)}" {st}/><circle cx="{fmt(x + s / 2)}" cy="{fmt(y + s / 2)}" r="{fmt(s * 0.46)}" {st}/><path d="M{fmt(x + s * 0.18)} {fmt(y + s * 0.18)} L{fmt(x + s * 0.82)} {fmt(y + s * 0.82)}" {st}/>'
    if key == "md":
        return box + text(f, "MD", x + s / 2, y + s * 0.68, s * 0.42, color, "middle")
    if key == "non-sterile":
        return box + text(f, "NON", x + s / 2, y + s * 0.45, s * 0.3, color, "middle") + text(f, "STERILE", x + s / 2, y + s * 0.8, s * 0.24, color, "middle")
    return box


# ——— Панели ———


def size_plate(x: float, y: float, s: dict, lang: str, h: float = 6.0, pt: float = 9) -> tuple[str, float]:
    f = face_for(lang, True)
    lbl = COPY[lang]["size_plate"].format(width=s["width_mm"] // 10, length=fmt(s["length_m"]).replace(".", ","))
    size = pt * PT
    w = f.width(lbl, size) + h
    return (
        f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" rx="{fmt(h / 2)}" fill="{C["teal_deep"]}"/>'
        + text(f, lbl, x + w / 2, y + h / 2 + size * 0.36, size, C["bg"], "middle"),
        w,
    )


def panel_front(s: dict, g: dict, lang: str) -> str:
    W, H = g["W"], g["H"]
    els = []
    lw = min(W * 0.46, 30)
    els.append(logo_svg("full_" + ("ru" if lang == "ru" else "uz-latn"), SAFE, SAFE, lw))
    ly = SAFE + logo_height("full_ru", lw)
    plate, pw = size_plate(SAFE, ly + 2.0, s, lang, h=5.6, pt=8.5)
    els.append(plate)
    # рулон: справа, не заходит на логотип; низ ленты — над рядом иконок
    icons_top = H - SAFE - 8.6
    scale = min(0.42, (W - SAFE * 2 - lw - 6) / g["D"], (icons_top - SAFE - 1) / (g["D"] + s["width_mm"] * 0.3))
    R = g["D"] / 2 * scale
    cx = W - SAFE - 3.2 - R
    cy = icons_top - 1.5 - R
    els.append(roll_illustration(cx, cy, g["D"], s["width_mm"], scale, SAFE + pw + 3))
    # честная ширина ленты 1:1 — отрезок вдоль правого края
    mx = W - SAFE - 0.5
    y0 = SAFE + 0.5
    y1 = min(y0 + s["width_mm"], H - SAFE - 0.5)
    els.append(f'<path d="M{fmt(mx)} {fmt(y0)} V{fmt(y1)} M{fmt(mx - 0.8)} {fmt(y0)} H{fmt(mx + 0.8)} M{fmt(mx - 0.8)} {fmt(y1)} H{fmt(mx + 0.8)}" stroke="{C["teal_deep"]}" stroke-width="0.25" fill="none"/>')
    els.append(f'<g transform="translate({fmt(mx - 1.3)} {fmt((y0 + y1) / 2)}) rotate(-90)">' + text(face("body", 500), f"{s['width_mm'] // 10} {'см' if lang == 'ru' else 'sm'} 1:1", 0, 0, 5 * PT, C["teal_deep"], "middle") + "</g>")
    if y1 - y0 < s["width_mm"] - 0.5:
        warn(f"front: метка 1:1 ({s['width_mm']} мм) не помещается по высоте панели {H:.0f} мм — показана укороченной")
    # три иконки внизу
    icons = ["medical-silicone", "reusable", "cut-to-size"]
    col = (W - SAFE * 2 - 3) / 3
    fb = face_for(lang, False)
    for i, (ic, cap) in enumerate(zip(icons, COPY[lang]["icons"])):
        x0 = SAFE + col * i
        els.append(icon_svg(ic, x0 + col / 2 - 2.2, icons_top, 4.4, C["teal_deep"]))
        for j, ln in enumerate(wrap(fb, cap, 5 * PT, col - 1)[:2]):
            els.append(text(fb, ln, x0 + col / 2, icons_top + 6.4 + j * 2.1, 5 * PT, C["teal_deep"], "middle"))
    return "\n".join(els)


def panel_back(s: dict, g: dict) -> str:
    W, H = g["W"], g["H"]
    els = []
    fh_ru, fh_uz = face_for("ru", True), face_for("uz-latn", True)
    fb = face("body", 400)
    # заголовок RU · UZ
    els.append(text(fh_ru, COPY["ru"]["how_it_works_title"], SAFE, SAFE + 2.4, 7 * PT, C["teal_deep"]))
    els.append(text(fh_uz, " · " + COPY["uz-latn"]["how_it_works_title"], SAFE + fh_ru.width(COPY["ru"]["how_it_works_title"], 7 * PT), SAFE + 2.4, 7 * PT, C["text2"]))
    sch_w = W * 0.3
    els.append(skin_scheme(SAFE, SAFE + 4, sch_w, 13))
    b = Block(SAFE + sch_w + 2, SAFE + 3.4, W - SAFE * 2 - sch_w - 2, 16, "back/how")
    for ru, uz in zip(COPY["ru"]["how_it_works"], COPY["uz-latn"]["how_it_works"]):
        b.line(fb, "• " + ru, 5.5, C["teal_deep"], lh=1.12)
        b.line(fb, "   " + uz, 5, C["text2"], lh=1.12, gap_after=0.4)
    els.append(b.done())
    # 4 шага
    y0 = SAFE + 21
    els.append(text(fh_ru, COPY["ru"]["steps_title"], SAFE, y0, 7 * PT, C["teal_deep"]))
    els.append(text(fh_uz, " · " + COPY["uz-latn"]["steps_title"], SAFE + fh_ru.width(COPY["ru"]["steps_title"], 7 * PT), y0, 7 * PT, C["text2"]))
    col = (W - SAFE * 2) / 4
    short_ru = COPY["ru"]["steps_short"]
    short_uz = COPY["uz-latn"]["steps_short"]
    for i, key in enumerate(["clean", "cut", "apply", "wear"]):
        x0 = SAFE + col * i
        els.append(f'<circle cx="{fmt(x0 + 2)}" cy="{fmt(y0 + 4.2)}" r="1.6" fill="{C["teal_soft"]}"/>')
        els.append(text(face("body", 600), str(i + 1), x0 + 2, y0 + 5.0, 2.2, C["teal_deep"], "middle"))
        els.append(step_icon(key, x0 + col / 2 - 2.4, y0 + 2, 5.4, C["teal_deep"]))
        els.append(text(fb, short_ru[i], x0 + col / 2, y0 + 9.6, 5.5 * PT, C["teal_deep"], "middle"))
        els.append(text(fb, short_uz[i], x0 + col / 2, y0 + 11.6, 5 * PT, C["text2"], "middle"))
    # курс и предупреждение
    b2 = Block(SAFE, y0 + 13.4, W - SAFE * 2, H - SAFE - (y0 + 13.4), "back/course")
    b2.line(face("body", 500), COPY["ru"]["course"] + " · " + COPY["uz-latn"]["course"], 5.5, C["teal_deep"], lh=1.1, gap_after=0.3)
    b2.line(face("body", 600), COPY["ru"]["warning_short"] + " · " + COPY["uz-latn"]["warning_short"], 5.5, C["teal_deep"], lh=1.05)
    els.append(b2.done())
    # предупреждение — тонкая линия-акцент слева
    els.append(f'<rect x="{fmt(SAFE - 1.6)}" y="{fmt(y0 + 13.4 + 3.2)}" width="0.6" height="{fmt(min(5.5, H - SAFE - (y0 + 16.6)))}" rx="0.3" fill="{C["teal_soft"]}"/>')
    return "\n".join(els)


def panel_side(s: dict, g: dict, lang: str) -> str:
    W, H = g["W"], g["H"]
    cp = COPY[lang]
    b = Block(SAFE, SAFE, W - SAFE * 2, H - SAFE - 2.6 - 1.2, f"side/{lang}")
    b.para(lang, cp["indications_title"], cp["indications"])
    b.line(face_for(lang, False), cp["composition_title"] + ": " + cp["composition"], 6, C["teal_deep"], lh=1.18, gap_after=0.9)
    b.para(lang, cp["contra_title"], cp["contra"])
    b.para(lang, cp["storage_title"], cp["storage"])
    els = [b.done()]
    # цветная полоса длины по нижнему краю (торец)
    els.append(f'<rect x="{fmt(-BLEED)}" y="{fmt(H - 2.6)}" width="{fmt(W + BLEED * 2)}" height="{fmt(2.6 + BLEED)}" fill="{C[TOK["stripes"][s["stripe"]]]}"/>')
    return "\n".join(els)


def panel_top(s: dict, g: dict) -> str:
    """Клапан-крышка на задней панели: после сгиба на 90° его дальний край — спереди, а артворк
    виден с лица повёрнутым на 180°. Поэтому содержимое рисуем перевёрнутым, полосу — у дальнего края."""
    W = g["W"]
    D = W - 1.0  # закрывающий клапан
    els = []
    stripe = C[TOK["stripes"][s["stripe"]]]
    els.append(f'<rect x="{fmt(-BLEED)}" y="{fmt(-BLEED)}" width="{fmt(W + BLEED * 2)}" height="{fmt(6 + BLEED)}" fill="{stripe}"/>')
    inner = []
    lw = min(W * 0.62, 40)
    lh = logo_height("full_ru", lw)
    inner.append(logo_svg("full_ru", (W - lw) / 2, 6 + (D - 6 - lh - 9) / 2 - 1, lw))
    plate, pw = size_plate(0, 0, s, "ru", h=7, pt=11)
    inner.append(f'<g transform="translate({fmt((W - pw) / 2)} {fmt(D - SAFE - 7.5)})">{plate}</g>')
    inner.append(text(face("heading", 600), s["label"], W - SAFE - 0.5, 6 + 7.5, 7.5, C["teal_deep"], "end", opacity=0.9))
    els.append(f'<g transform="rotate(180 {fmt(W / 2)} {fmt(D / 2)})">' + "\n".join(inner) + "</g>")
    return "\n".join(els)


def panel_bottom(s: dict, g: dict) -> str:
    W = g["W"]
    D = W
    els = []
    com = SKUS["common"]
    sub = {
        "width": s["width_mm"] // 10,
        "length": fmt(s["length_m"]).replace(".", ","),
        "manufacturer": com["manufacturer"],
        "manufacturer_address": com["manufacturer_address"],
        "importer": LEGAL["importer"]["name"],
        "importer_address": LEGAL["importer"]["address"],
        "importer_phone": LEGAL["importer"]["phone"],
        "registration_number": LEGAL["registration_number"],
        "ref": s["ref"],
    }
    ru, uz = COPY["ru"], COPY["uz-latn"]
    f6, f6b = face("body", 400), face("body", 500)
    b = Block(SAFE, SAFE, W - SAFE * 2, D - SAFE * 2 - 19, "bottom/legal")
    b.line(f6b, f"{ru['legal_product_label']} / {uz['legal_product_label']} Silicare, {sub['width']} см × {sub['length']} м, {ru['legal_qty']} / {uz['legal_qty']}", 6, C["teal_deep"], lh=1.1, gap_after=0.3)
    b.line(f6, f"{ru['legal_manufacturer_label']} / {uz['legal_manufacturer_label']}: {sub['manufacturer']}, {sub['manufacturer_address']}", 6, C["teal_deep"], lh=1.1, gap_after=0.3)
    b.line(f6, f"{ru['legal_importer_label']} / {uz['legal_importer_label']}: {sub['importer']}, {sub['importer_address']}, {sub['importer_phone']}", 6, C["teal_deep"], lh=1.1, gap_after=0.3)
    b.line(f6, f"{ru['legal_reg_label']} / {uz['legal_reg_label']}: {sub['registration_number']}", 6, C["teal_deep"], lh=1.1, gap_after=0.3)
    b.line(f6, f"{ru['legal_nonsterile']} / {uz['legal_nonsterile']}. {ru['legal_storage_short']} / {uz['legal_storage_short']}.", 6, C["teal_deep"], lh=1.12)
    els.append(b.done())
    # нижний ряд: EAN слева; справа — поле LOT/EXP, под ним символы ISO 15223-1 и зона DataMatrix
    y_row = D - SAFE - 17
    els.append(ean13_svg(s["ean13"], SAFE, y_row, 29.8, 17))
    fx = SAFE + 29.8 + 2
    fw = W - SAFE - fx
    els.append(f'<rect x="{fmt(fx)}" y="{fmt(y_row)}" width="{fmt(fw)}" height="6.5" fill="#FFFFFF" stroke="{C["text2"]}" stroke-width="0.2"/>')
    els.append(text(face("body", 400), "LOT", fx + 0.8, y_row + 2.4, 4.5 * PT, C["text2"]))
    els.append(text(face("body", 400), "EXP", fx + fw / 2, y_row + 2.4, 4.5 * PT, C["text2"]))
    syms = LEGAL["symbols_iso15223"]
    ss = min(3.6, (fw - 8) / len(syms) - 0.5)
    for i, key in enumerate(syms):
        els.append(iso_symbol(key, fx + i * (ss + 0.5), y_row + 7.5, ss, C["teal_deep"]))
    els.append(text(face("body", 500), f"REF {s['ref']}", fx, y_row + 7.5 + ss + 2.2, 5 * PT, C["teal_deep"]))
    dm = 6
    els.append(f'<rect x="{fmt(fx + fw - dm)}" y="{fmt(y_row + 7.5 + ss + 0.3)}" width="{fmt(dm)}" height="{fmt(dm)}" fill="none" stroke="{C["text2"]}" stroke-width="0.2" stroke-dasharray="0.8 0.6"/>')
    els.append(text(face("body", 400), "DM", fx + fw - dm / 2, y_row + 7.5 + ss + 0.3 + dm * 0.65, 4 * PT, C["text2"], "middle"))
    return "\n".join(els)


def panel_inside_top(s: dict, g: dict) -> str:
    W = g["W"]
    D = W
    els = []
    q = 16
    els.append(qr_svg("https://instagram.com/sil.icare", (W - q) / 2, SAFE + 5, q))
    fh, fb = face_for("ru", True), face("body", 400)
    y = SAFE + 5 + q + 5
    els.append(text(fh, COPY["ru"]["inside_thanks"], W / 2, y, 7 * PT, C["teal_deep"], "middle"))
    els.append(text(face_for("uz-latn", True), COPY["uz-latn"]["inside_thanks"], W / 2, y + 3.4, 7 * PT, C["teal_deep"], "middle"))
    b = Block(SAFE, y + 5.5, W - SAFE * 2, D - (y + 5.5) - SAFE, "inside/qr")
    b.line(fb, COPY["ru"]["inside_qr"], 5.5, C["text2"], lh=1.15)
    b.line(fb, COPY["uz-latn"]["inside_qr"], 5.5, C["text2"], lh=1.15)
    els.append(b.done())
    return "\n".join(els)


# ——— Развёртка ———


def dieline(s: dict, g: dict) -> dict:
    """Геометрия straight tuck end: клапаны верх/низ — на задней панели, пылевые — на боковых."""
    W, H = g["W"], g["H"]
    Dp = W  # квадратное сечение: глубина = ширина
    closure = Dp - 1.0  # закрывающий клапан чуть короче глубины
    dust = Dp * 0.78
    x_glue = 0
    x_back = GLUE
    x_side_uz = x_back + W
    x_front = x_side_uz + Dp
    x_side_ru = x_front + W
    total_w = x_side_ru + Dp
    y_body = TONGUE + closure
    total_h = y_body + H + closure + TONGUE
    panels = {
        "back": (x_back, y_body, W, H),
        "side_uz": (x_side_uz, y_body, Dp, H),
        "front": (x_front, y_body, W, H),
        "side_ru": (x_side_ru, y_body, Dp, H),
        "top": (x_back, y_body - closure, W, closure),
        "bottom": (x_back, y_body + H, W, closure),
    }

    def cut_path() -> str:
        # обход контура по часовой стрелке, начиная с левого верха клеевого клапана
        p = []
        tx0, tx1 = x_back + 2.5, x_back + W - 2.5  # язычок уже клапана
        p.append(f"M{fmt(x_glue)} {fmt(y_body + 1.5)}")
        p.append(f"L{fmt(x_glue + 2)} {fmt(y_body)}")
        p.append(f"L{fmt(x_back)} {fmt(y_body)}")
        # верхний клапан + язычок
        p.append(f"L{fmt(x_back)} {fmt(y_body - closure)}")
        p.append(f"L{fmt(tx0)} {fmt(y_body - closure)}")
        p.append(f"Q{fmt(tx0)} {fmt(y_body - closure - TONGUE)} {fmt(tx0 + 6)} {fmt(y_body - closure - TONGUE)}")
        p.append(f"L{fmt(tx1 - 6)} {fmt(y_body - closure - TONGUE)}")
        p.append(f"Q{fmt(tx1)} {fmt(y_body - closure - TONGUE)} {fmt(tx1)} {fmt(y_body - closure)}")
        p.append(f"L{fmt(x_back + W)} {fmt(y_body - closure)}")
        p.append(f"L{fmt(x_back + W)} {fmt(y_body)}")
        # пылевой клапан над боком UZ
        p.append(f"L{fmt(x_side_uz + 1.5)} {fmt(y_body)}")
        p.append(f"L{fmt(x_side_uz + 4)} {fmt(y_body - dust)}")
        p.append(f"L{fmt(x_side_uz + Dp - 4)} {fmt(y_body - dust)}")
        p.append(f"L{fmt(x_side_uz + Dp - 1.5)} {fmt(y_body)}")
        p.append(f"L{fmt(x_front + W)} {fmt(y_body)}")
        # пылевой над боком RU
        p.append(f"L{fmt(x_side_ru + 1.5)} {fmt(y_body)}")
        p.append(f"L{fmt(x_side_ru + 4)} {fmt(y_body - dust)}")
        p.append(f"L{fmt(x_side_ru + Dp - 4)} {fmt(y_body - dust)}")
        p.append(f"L{fmt(x_side_ru + Dp - 1.5)} {fmt(y_body)}")
        p.append(f"L{fmt(total_w)} {fmt(y_body)}")
        p.append(f"L{fmt(total_w)} {fmt(y_body + H)}")
        # низ: пылевой RU
        p.append(f"L{fmt(x_side_ru + Dp - 1.5)} {fmt(y_body + H)}")
        p.append(f"L{fmt(x_side_ru + Dp - 4)} {fmt(y_body + H + dust)}")
        p.append(f"L{fmt(x_side_ru + 4)} {fmt(y_body + H + dust)}")
        p.append(f"L{fmt(x_side_ru + 1.5)} {fmt(y_body + H)}")
        p.append(f"L{fmt(x_front)} {fmt(y_body + H)}")
        # пылевой UZ
        p.append(f"L{fmt(x_side_uz + Dp - 1.5)} {fmt(y_body + H)}")
        p.append(f"L{fmt(x_side_uz + Dp - 4)} {fmt(y_body + H + dust)}")
        p.append(f"L{fmt(x_side_uz + 4)} {fmt(y_body + H + dust)}")
        p.append(f"L{fmt(x_side_uz + 1.5)} {fmt(y_body + H)}")
        p.append(f"L{fmt(x_back + W)} {fmt(y_body + H)}")
        # нижний клапан + язычок
        p.append(f"L{fmt(x_back + W)} {fmt(y_body + H + closure)}")
        p.append(f"L{fmt(tx1)} {fmt(y_body + H + closure)}")
        p.append(f"Q{fmt(tx1)} {fmt(y_body + H + closure + TONGUE)} {fmt(tx1 - 6)} {fmt(y_body + H + closure + TONGUE)}")
        p.append(f"L{fmt(tx0 + 6)} {fmt(y_body + H + closure + TONGUE)}")
        p.append(f"Q{fmt(tx0)} {fmt(y_body + H + closure + TONGUE)} {fmt(tx0)} {fmt(y_body + H + closure)}")
        p.append(f"L{fmt(x_back)} {fmt(y_body + H + closure)}")
        p.append(f"L{fmt(x_back)} {fmt(y_body + H)}")
        p.append(f"L{fmt(x_glue + 2)} {fmt(y_body + H)}")
        p.append(f"L{fmt(x_glue)} {fmt(y_body + H - 1.5)}")
        p.append("Z")
        return " ".join(p)

    def crease_path() -> str:
        c = []
        for x in (x_back, x_side_uz, x_front, x_side_ru):
            c.append(f"M{fmt(x)} {fmt(y_body)} V{fmt(y_body + H)}")
        c.append(f"M{fmt(x_back)} {fmt(y_body)} H{fmt(total_w)}")
        c.append(f"M{fmt(x_back)} {fmt(y_body + H)} H{fmt(total_w)}")
        c.append(f"M{fmt(x_back)} {fmt(y_body - closure)} H{fmt(x_back + W)}")
        c.append(f"M{fmt(x_back)} {fmt(y_body + H + closure)} H{fmt(x_back + W)}")
        return " ".join(c)

    return {"panels": panels, "w": total_w, "h": total_h, "cut": cut_path(), "crease": crease_path(), "closure": closure}


def panel_group(name: str, box: tuple, inner: str, bg: bool = True) -> str:
    x, y, w, h = box
    cid = f"clip-{name}"
    fill = f'<rect x="{fmt(-BLEED)}" y="{fmt(-BLEED)}" width="{fmt(w + BLEED * 2)}" height="{fmt(h + BLEED * 2)}" fill="{C["bg"]}"/>' if bg else ""
    return (
        f'<clipPath id="{cid}"><rect x="{fmt(-BLEED)}" y="{fmt(-BLEED)}" width="{fmt(w + BLEED * 2)}" height="{fmt(h + BLEED * 2)}"/></clipPath>'
        f'<g id="panel-{name}" transform="translate({fmt(x)} {fmt(y)})" clip-path="url(#{cid})">{fill}{inner}</g>'
    )


def varnish_layer(s: dict, g: dict, dl: dict) -> str:
    """Выборочный УФ-лак: словесный знак и капли на лице и крышке."""
    els = []
    fx, fy, fw, fh = dl["panels"]["front"]
    lw = min(fw * 0.52, 34)
    els.append(logo_svg("wordmark", fx + SAFE, fy + SAFE, lw, fill_override=VARNISH))
    tx, ty, tw, th = dl["panels"]["top"]
    lw2 = min(tw * 0.62, 40)
    lh2 = logo_height("full_ru", lw2)
    els.append(f'<g transform="rotate(180 {fmt(tx + tw / 2)} {fmt(ty + th / 2)})">' + logo_svg("wordmark", tx + (tw - lw2) / 2, ty + 6 + (th - 6 - lh2 - 9) / 2 - 1, lw2, fill_override=VARNISH) + "</g>")
    return "\n".join(els)


def svg_doc(w: float, h: float, body: str, title: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{fmt(w)}mm" height="{fmt(h)}mm" viewBox="0 0 {fmt(w)} {fmt(h)}">\n'
        f"<title>{title}</title>\n{body}\n</svg>\n"
    )


def build_sku(s: dict) -> dict:
    g = sku_geometry(s)
    dl = dieline(s, g)
    P = dl["panels"]
    bleed_w, bleed_h = dl["w"] + BLEED * 2, dl["h"] + BLEED * 2
    off = f'<g transform="translate({fmt(BLEED)} {fmt(BLEED)})">'

    # печать: фон под всей развёрткой (с вылетом), затем панели
    print_body = [
        off,
        f'<path d="{dl["cut"]}" fill="{C["bg"]}" stroke="{C["bg"]}" stroke-width="{fmt(BLEED * 2)}" stroke-linejoin="round"/>',
        panel_group("front", P["front"], panel_front(s, g, "ru")),
        panel_group("back", P["back"], panel_back(s, g)),
        panel_group("side_ru", P["side_ru"], panel_side(s, g, "ru")),
        panel_group("side_uz", P["side_uz"], panel_side(s, g, "uz-latn")),
        panel_group("top", P["top"], panel_top(s, g)),
        panel_group("bottom", P["bottom"], panel_bottom(s, g)),
        "</g>",
    ]
    varnish_body = [off, varnish_layer(s, g, dl), "</g>"]
    cut_body = [off, f'<path d="{dl["cut"]}" fill="none" stroke="{CUT}" stroke-width="0.25"/>', "</g>"]
    crease_body = [off, f'<path d="{dl["crease"]}" fill="none" stroke="{CREASE}" stroke-width="0.25" stroke-dasharray="2 1"/>', "</g>"]
    title = f"Silicare {s['sku']} — {s['width_mm'] // 10} см × {s['length_m']} м"
    files = {}
    layers = {"print": print_body, "varnish": varnish_body, "crease": crease_body, "cut": cut_body}
    for name, body in layers.items():
        fn = f"dieline_{s['sku']}_{name}.svg"
        (OUT / fn).write_text(svg_doc(bleed_w, bleed_h, "\n".join(body), f"{title} — {name}"))
        files[name] = fn
    combined_layers = dict(layers)
    combined_layers["varnish"] = [off, varnish_layer(s, g, dl).replace(f'fill="{VARNISH}"', f'fill="none" stroke="{VARNISH}" stroke-width="2"'), "</g>"]
    combined = "\n".join(f'<g id="layer-{n}"{" opacity=\"0.6\"" if n == "varnish" else ""}>' + "\n".join(b) + "</g>" for n, b in combined_layers.items())
    legend = (
        f'<g transform="translate({fmt(BLEED)} {fmt(bleed_h - 1.2)})">'
        + text(face("body", 400), f"{title} · развёртка {fmt(dl['w'])}×{fmt(dl['h'])} мм + вылеты {fmt(BLEED)} · рез — красный, биг — синий пунктир, лак — пурпурный · "
               + ("размеры УСЛОВНЫЕ [ЗАПОЛНИТЬ замеры]" if not g["D_measured"] else "по замерам"), 0, 0, 2.2, C["text2"])
        + "</g>"
    )
    (OUT / f"dieline_{s['sku']}.svg").write_text(svg_doc(bleed_w, bleed_h + 3, combined + legend, title))
    files["combined"] = f"dieline_{s['sku']}.svg"
    # оборот: внутренняя сторона крышки (зеркально по X относительно развёртки)
    tx, ty, tw, th = P["top"]
    inside = (
        f'<g transform="translate({fmt(bleed_w)} 0) scale(-1 1)">{off}'
        + panel_group("inside_top", (tx, ty, tw, th), panel_inside_top(s, g))
        + f'<path d="{dl["cut"]}" fill="none" stroke="{CUT}" stroke-width="0.25"/></g></g>'
    )
    (OUT / f"dieline_{s['sku']}_inside.svg").write_text(svg_doc(bleed_w, bleed_h, inside, f"{title} — оборот (внутри крышки)"))
    files["inside"] = f"dieline_{s['sku']}_inside.svg"
    # отдельные грани для 3D-макета и слайдов
    for name in ("front", "side_ru", "top"):
        x, y, w, h = P[name]
        inner = {"front": panel_front(s, g, "ru"), "side_ru": panel_side(s, g, "ru"), "top": panel_top(s, g)}[name]
        (OUT / f"box_{name}_{s['sku']}.svg").write_text(svg_doc(w, h, panel_group(name, (0, 0, w, h), inner), f"{title} — {name}"))
        files[f"face_{name}"] = f"box_{name}_{s['sku']}.svg"
    return {"sku": s["sku"], "geometry": g, "dieline_mm": [dl["w"], dl["h"]], "sheet_mm": [bleed_w, bleed_h + 3], "panel_mm": {k: list(v) for k, v in P.items()}, "files": files}


# ——— Отчёт ———


def report(results: list[dict]) -> str:
    com = SKUS["common"]
    t, d = val(com["tape_thickness_mm"]), val(com["core_diameter_mm"])
    kr = com["known_roll"]
    L = []
    L.append("# Коробка Silicare — расчёт и развёртки\n")
    L.append("**Статус: замеры рулонов не получены.** Все диаметры ниже посчитаны по формуле намотки из условных t и d (помечены ★). Файлы годятся для оценки дизайна и бумажного прототипа «по месту», но не для тиража.\n")
    L.append("## 1. Формула намотки\n")
    L.append("L = π(D² − d²) / (4t). Принято ★: t = %s мм (толщина ленты), d = %s мм (втулка). Правило: если замер отличается от расчёта больше чем на 10 %% — перемерить.\n" % (t, d))
    L.append("Известный рулон из ТЗ-1: ширина %s мм, D = %s мм. При d = %s мм это даёт:\n" % (kr["width_mm"], kr["outer_diameter_mm"], d))
    for Lm in (1.5, 3.0):
        tt = math.pi * (kr["outer_diameter_mm"] ** 2 - d * d) / (4 * Lm * 1000)
        L.append(f"- если это {Lm} м → толщина ленты t = {tt:.2f} мм")
    L.append("\nТипичная толщина силиконовой ленты для рубцов 0,4–0,8 мм, поэтому рулон 55 мм с равной вероятностью может быть и SC-4150 (t≈0,83), и SC-4300 (t≈0,41). **Замер t решает вопрос.**\n")
    L.append("## 2. Размеры по SKU\n")
    L.append("| SKU | Лента | D нар. ★ | Внутр. сторона | Внутр. высота | Панель W×H | Пустота в коробке |")
    L.append("|---|---|---|---|---|---|---|")
    for r in results:
        g = r["geometry"]
        s = next(x for x in SKUS["skus"] if x["sku"] == r["sku"])
        L.append(f"| {r['sku']} | {s['width_mm'] // 10} см × {s['length_m']} м | {g['D']:.1f} мм | {g['inner_side']:.1f} мм | {g['inner_h']:.1f} мм | {g['W']:.1f}×{g['H']:.1f} мм | {g['void_pct']:.0f} % |")
    L.append("\nВнутренняя сторона = max(D + 3, минимум грани %s мм — иначе двуязычная маркировка 6 pt и EAN не помещаются); высота" % val(com['min_panel_mm']) + "")
    L.append("Высота = ширина ленты + 3 + пакет %s + вкладыш %s (★). Панели развёртки = внутренний размер + картон %s + 0,5 мм на биг.\n" % (val(com["pouch_mm"]), val(com["leaflet_mm"]), com["board_mm"]))
    # один или два штампа
    L.append("## 3. Один штамп или два\n")
    D150 = [r["geometry"]["D"] for r in results if r["sku"].endswith("150")]
    D300 = [r["geometry"]["D"] for r in results if r["sku"].endswith("300")]
    dD = max(D300) - min(D150)
    L.append(f"Разница диаметров 1,5 м и 3 м: **{dD:.1f} мм** (порог 8 мм).\n")
    L.append("**Вариант A — один штамп на 4 SKU** (сторона под 3 м, высота под 5 см, для 4 см — картонная прокладка 10 мм):\n")
    side = max(D300) + 3
    h5 = 50 + 3 + val(com["pouch_mm"]) + val(com["leaflet_mm"])
    for r in results:
        s = next(x for x in SKUS["skus"] if x["sku"] == r["sku"])
        g = r["geometry"]
        void = (1 - (math.pi * g["D"] ** 2 / 4 * s["width_mm"]) / (side * side * h5)) * 100
        L.append(f"- {r['sku']}: пустота {void:.0f} %{' ⚠ > 30 %' if void > 30 else ''}")
    L.append("\n**Вариант B — два штампа** («1,5 м» и «3 м», одинаковая высота под 5 см, для 4 см — прокладка):\n")
    for tag, Ds in (("1,5 м", D150), ("3 м", D300)):
        side_b = max(Ds) + 3
        for r in results:
            s = next(x for x in SKUS["skus"] if x["sku"] == r["sku"])
            if str(s["stripe"]) != ("150" if tag == "1,5 м" else "300"):
                continue
            g = r["geometry"]
            void = (1 - (math.pi * g["D"] ** 2 / 4 * s["width_mm"]) / (side_b * side_b * h5)) * 100
            L.append(f"- штамп {tag}, {r['sku']}: сторона {side_b:.1f} мм, пустота {void:.0f} %{' ⚠ > 30 %' if void > 30 else ''}")
    rec = "один штамп" if dD <= 8 and all((1 - (math.pi * r["geometry"]["D"] ** 2 / 4 * next(x for x in SKUS["skus"] if x["sku"] == r["sku"])["width_mm"]) / (side * side * h5)) * 100 <= 30 for r in results) else "два штампа"
    L.append(f"\n**Рекомендация по условным данным: {rec}.** Пересчитать после замеров — `python3 packaging/dieline.py`.\n")
    L.append("## 4. Развёртка\n")
    L.append("Straight tuck end (прямой клапан-замок сверху и снизу на задней панели, пылевые клапаны на боковых). Клеевой клапан %s мм, язычок %s мм, вылеты %s мм, безопасная зона %s мм, +0,5 мм на каждый биг. Слои — отдельными файлами: `_print` (печать, с фоном под вылеты), `_varnish` (выборочный УФ-лак: словесный знак на лице и крышке), `_crease` (биг, синий пунктир), `_cut` (рез, красный), `_inside` (печать на обороте: QR внутри крышки, зеркально).\n" % (GLUE, TONGUE, BLEED, SAFE))
    L.append("| SKU | Развёртка (без вылетов) | Лист с вылетами |")
    L.append("|---|---|---|")
    for r in results:
        L.append(f"| {r['sku']} | {r['dieline_mm'][0]:.1f} × {r['dieline_mm'][1]:.1f} мм | {r['sheet_mm'][0]:.1f} × {r['sheet_mm'][1]:.1f} мм |")
    L.append("\n## 5. Что на какой грани\n")
    L.append("- **Лицо** — логотип A (полный, с дескриптором), плашка размера, рулон с отмотанной лентой, 3 иконки. Рулон уменьшен (панель всего %.0f мм высотой при ленте 40 мм), честная ширина показана меткой «1:1» справа — отклонение от ТЗ, см. §7.\n" % results[0]["geometry"]["H"])
    L.append("- **Тыл** — схема кожи + 3 тезиса RU/UZ, 4 шага пиктограммами, курс, предупреждение «только на зажившую кожу».")
    L.append("- **Бок RU / Бок UZ (латиница)** — показания, состав, противопоказания, хранение; цветная полоса длины по нижнему торцу.")
    L.append("- **Верх (крышка)** — полоса длины, логотип, плашка размера, крупная цифра ширины у края.")
    L.append("- **Низ** — юридический блок с двуязычными подписями в одну колонку, EAN-13 (80 %), белое поле LOT/EXP, символы ISO 15223-1, REF, зона DataMatrix (DM).")
    L.append("- **Внутри крышки** — QR на @sil.icare, «Спасибо, что заботитесь о себе» RU/UZ.\n")
    L.append("## 6. Предупреждения генератора\n")
    L.extend(f"- {w}" for w in (warnings or ["нет"]))
    L.append("\n## 7. Отклонения и решения\n")
    L.append("- Иллюстрация рулона не 1:1: при высоте панели ≈ ширина ленты + 6 мм рулон в натуральную величину не оставляет места логотипу и иконкам. Вместо этого — метка реальной ширины «1:1». Если принципиально 1:1 — переносим рулон на крышку (58×58 мм) и меняем местами содержимое крышки и лица.")
    L.append("- Уход и повторное использование с боковых граней убраны (не влезают в 6 pt) — остаются в инструкции и карточке.")
    L.append("- EAN-13 и DataMatrix — зоны-заглушки до получения кодов; генератор печатает настоящий штрихкод, как только в skus.json появится валидный номер.")
    L.append("- CE не ставится: сертификата нет (legal.json).")
    L.append("- «Внутри крышки» требует двусторонней печати — уточнить у типографии стоимость; иначе QR переезжает на тыл.\n")
    L.append("## 8. Бумажный прототип\n")
    L.append("Распечатать `prototype_<SKU>.pdf` 1:1 (масштаб 100 %, без «вписать в страницу»), вырезать по красному, согнуть по синему, склеить клапан, вложить реальный рулон и инструкцию. Если не закрывается — замеры неверны (см. §1).\n")
    return "\n".join(L)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    results = [build_sku(s) for s in SKUS["skus"]]
    (OUT / "report.md").write_text(report(results))
    (OUT / "manifest.json").write_text(json.dumps({"bleed": BLEED, "skus": results}, ensure_ascii=False, indent=1))
    print("ok:", ", ".join(r["sku"] for r in results), "| предупреждений:", len(warnings))
    for w in warnings:
        print("  -", w)


if __name__ == "__main__":
    main()
