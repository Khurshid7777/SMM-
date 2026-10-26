#!/usr/bin/env python3
"""Бренд-система Silicare by Yafho: токены, логотипы в кривых, иконки, отчёты.

Запуск:  python3 brand/build.py
Пишет:   brand/tokens.json, brand/logo/<A|B|C>/*.svg, brand/icons/*.svg,
         qa/contrast_report.md, qa/fonts_report.md
Всё параметрично: цвета и шрифты меняются здесь, в PALETTE и FONTS.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "brand"
QA = ROOT / "qa"

# ——— Палитра (ТЗ-1, раздел 1) ———
PALETTE = {
    "bg": ("#F6F4F0", "Фон, «чистая кожа»: коробка, слайды"),
    "teal_deep": ("#1E4A4C", "Основной тёмный: логотип, заголовки, полоса «3 м»"),
    "teal_soft": ("#8FC9C2", "Акцент «силикон»: иконки, плашки, полоса «1,5 м»"),
    "nude": ("#E8CDBF", "Тёплый нюд: фоны lifestyle, схемы кожи"),
    "text2": ("#5C6B6A", "Вторичный текст, by Yafho"),
    "white": ("#FFFFFF", "Белый: подложки, реверс логотипа на тёмном"),
}

FONTS = {
    "heading": {"family": "Manrope", "weight": 600, "files": ["manrope-latin", "manrope-latin-ext", "manrope-cyrillic"]},
    "heading_uz": {"family": "Inter", "weight": 600, "files": ["inter-latin", "inter-latin-ext", "inter-cyrillic", "inter-cyrillic-ext"]},
    "body": {"family": "Inter", "weight": 400, "files": ["inter-latin", "inter-latin-ext", "inter-cyrillic", "inter-cyrillic-ext"]},
}

DESCRIPTOR = {
    "ru": "Силиконовая лента для ухода за рубцами",
    "uz-latn": "Chandiqlarni parvarishlash uchun silikon lenta",
    "uz": "Чандиқларни парваришлаш учун силикон лента",
}

# ——— Цвет ———


def hex_rgb(h: str) -> tuple[int, int, int]:
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]


def rgb_cmyk(rgb: tuple[int, int, int]) -> list[int]:
    r, g, b = (v / 255 for v in rgb)
    k = 1 - max(r, g, b)
    if k >= 1:
        return [0, 0, 0, 100]
    c, m, y = ((1 - v - k) / (1 - k) for v in (r, g, b))
    return [round(c * 100), round(m * 100), round(y * 100), round(k * 100)]


def luminance(rgb: tuple[int, int, int]) -> float:
    def ch(v: int) -> float:
        s = v / 255
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4

    r, g, b = (ch(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = luminance(hex_rgb(a)), luminance(hex_rgb(b))
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# ——— Шрифты: статические экземпляры из вариативных woff2 ———

_cache: dict[tuple[str, int], TTFont] = {}


def font(file_stem: str, weight: int) -> TTFont:
    key = (file_stem, weight)
    if key not in _cache:
        f = TTFont(BRAND / "fonts" / f"{file_stem}-wght-normal.woff2")
        _cache[key] = instancer.instantiateVariableFont(f, {"wght": weight})
    return _cache[key]


class Face:
    """Набор субсетов одного семейства: ищет глиф по всем файлам."""

    def __init__(self, stems: list[str], weight: int):
        self.fonts = [font(s, weight) for s in stems]
        self.upm = self.fonts[0]["head"].unitsPerEm
        self.x_height = self.fonts[0]["OS/2"].sxHeight
        self.cap_height = self.fonts[0]["OS/2"].sCapHeight

    def glyph(self, ch: str):
        for f in self.fonts:
            name = f.getBestCmap().get(ord(ch))
            if name:
                return f, name
        raise KeyError(f"нет глифа {ch!r} (U+{ord(ch):04X})")

    def advance(self, ch: str) -> int:
        f, name = self.glyph(ch)
        return f["hmtx"][name][0]

    def width(self, text: str, size: float, tracking: float = 0) -> float:
        return sum(self.advance(c) * size / self.upm + tracking * size for c in text) - tracking * size

    def contours(self, ch: str):
        """Контуры глифа списком записей RecordingPen (разбито по moveTo)."""
        f, name = self.glyph(ch)
        gs = f.getGlyphSet()
        pen = DecomposingRecordingPen(gs)  # составные глифы (й, ё) — в контуры
        gs[name].draw(pen)
        out, cur = [], []
        for op, args in pen.value:
            if op == "moveTo" and cur:
                out.append(cur)
                cur = []
            cur.append((op, args))
        if cur:
            out.append(cur)
        return out


def contour_bbox(contour):
    xs, ys = [], []
    for _, args in contour:
        for pt in args:
            if pt is not None:
                xs.append(pt[0])
                ys.append(pt[1])
    return min(xs), min(ys), max(xs), max(ys)


def contour_path(contour, x: float, y: float, scale: float) -> str:
    """Контур → SVG path: масштаб, сдвиг, ось Y вниз."""
    pen = SVGPathPen(None)
    tpen = TransformPen(pen, (scale, 0, 0, -scale, x, y))
    for op, args in contour:
        getattr(tpen, op)(*args)
    return pen.getCommands()


def text_paths(face: Face, text: str, x: float, y: float, size: float, tracking: float = 0, skip=None) -> tuple[list[str], float]:
    """Текст в кривых. skip(ch, contour_bbox, face) → True, чтобы пропустить контур."""
    scale = size / face.upm
    paths = []
    cx = x
    for ch in text:
        for c in face.contours(ch):
            if skip and skip(ch, contour_bbox(c), face):
                continue
            paths.append(contour_path(c, cx, y, scale))
        cx += face.advance(ch) * scale + tracking * size
    return paths, cx - tracking * size


def fmt(v: float) -> str:
    return f"{v:.1f}".rstrip("0").rstrip(".")


# ——— Логотип ———

E = 200.0  # кегль словесного знака в единицах SVG
TRACKING = 0.02  # «чуть разреженный»: +20
WORD = "silicare"


def i_dot_boxes(face: Face, size: float, tracking: float) -> list[tuple[float, float, float, float]]:
    """Координаты точек над «i» (в единицах SVG, baseline y=0, Y вниз)."""
    scale = size / face.upm
    boxes = []
    cx = 0.0
    for ch in WORD:
        if ch == "i":
            for c in face.contours(ch):
                x0, y0, x1, y1 = contour_bbox(c)
                if y0 > face.x_height * 0.75:  # точка выше x-height
                    boxes.append((cx + x0 * scale, -y1 * scale, cx + x1 * scale, -y0 * scale))
        cx += face.advance(ch) * scale + tracking * size
    return boxes


def is_i_dot(ch, bbox, face: Face) -> bool:
    return ch == "i" and bbox[1] > face.x_height * 0.75


def drop_path(cx: float, bottom: float, w: float, h: float) -> str:
    """Капля: острие вверху, круглое дно."""
    r = w / 2
    top = bottom - h
    cy = bottom - r
    return (
        f"M{fmt(cx)} {fmt(top)} "
        f"C{fmt(cx + r * 0.55)} {fmt(top + h * 0.42)} {fmt(cx + r)} {fmt(cy - r * 0.35)} {fmt(cx + r)} {fmt(cy)} "
        f"A{fmt(r)} {fmt(r)} 0 1 1 {fmt(cx - r)} {fmt(cy)} "
        f"C{fmt(cx - r)} {fmt(cy - r * 0.35)} {fmt(cx - r * 0.55)} {fmt(top + h * 0.42)} {fmt(cx)} {fmt(top)} Z"
    )


def wave_path(x0: float, x1: float, y: float, amp: float, thick: float) -> str:
    """Мягкая волна-лента: замкнутый контур из двух синусоид."""
    n = 48
    top, bot = [], []
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        yy = y + math.sin(t * math.pi * 2 - math.pi * 0.5) * amp
        # толщина чуть «дышит»
        th = thick * (0.8 + 0.2 * math.cos(t * math.pi * 2))
        top.append((x, yy - th / 2))
        bot.append((x, yy + th / 2))
    pts = top + bot[::-1]
    return "M" + " L".join(f"{fmt(x)} {fmt(y)}" for x, y in pts) + " Z"


def strip_path(cx: float, cy: float, w: float, h: float, angle: float) -> str:
    """Полоска-лента со скруглёнными углами, повёрнутая."""
    r = h / 2
    a = math.radians(angle)
    ca, sa = math.cos(a), math.sin(a)

    def P(x, y):
        return (cx + x * ca - y * sa, cy + x * sa + y * ca)

    hw = w / 2 - r
    p1, p2, p3, p4 = P(-hw, -r), P(hw, -r), P(hw, r), P(-hw, r)
    return (
        f"M{fmt(p1[0])} {fmt(p1[1])} L{fmt(p2[0])} {fmt(p2[1])} "
        f"A{fmt(r)} {fmt(r)} 0 0 1 {fmt(p3[0])} {fmt(p3[1])} L{fmt(p4[0])} {fmt(p4[1])} "
        f"A{fmt(r)} {fmt(r)} 0 0 1 {fmt(p1[0])} {fmt(p1[1])} Z"
    )


VARIANTS = {
    "A": "drops — точки над «i» как полупрозрачные капли силикона",
    "B": "wave — мягкая волна-лента под словом",
    "C": "strips — точки над «i» как полоски ленты",
}


def build_logo(variant: str, kind: str, lang: str = "ru", mono: str | None = None) -> str:
    """kind: wordmark | full | horizontal | icon. mono: цвет для одноцветной версии."""
    head = Face(FONTS["heading"]["files"], FONTS["heading"]["weight"])
    body = Face(FONTS["body"]["files"], 500)
    deep, soft, text2, bg = (PALETTE[k][0] for k in ("teal_deep", "teal_soft", "text2", "bg"))
    ink = mono or deep
    accent = mono or soft
    accent_op = "1" if mono else "0.92"

    skip = is_i_dot if variant in ("A", "C") else None
    paths, word_w = text_paths(head, WORD, 0, 0, E, TRACKING, skip)
    x_h = head.x_height * E / head.upm  # 108
    els = [f'<path fill="{ink}" d="{" ".join(paths)}"/>']

    dots = i_dot_boxes(head, E, TRACKING)
    if variant == "A":
        for x0, y0, x1, y1 in dots:
            w = (x1 - x0) * 1.55
            h = (y1 - y0) * 2.4
            cx = (x0 + x1) / 2
            els.append(f'<path fill="{accent}" fill-opacity="{accent_op}" d="{drop_path(cx, y1 + (y1 - y0) * 0.1, w, h)}"/>')
            if not mono:
                els.append(f'<ellipse cx="{fmt(cx - w * 0.17)}" cy="{fmt(y1 - h * 0.28)}" rx="{fmt(w * 0.13)}" ry="{fmt(h * 0.13)}" fill="#FFFFFF" fill-opacity="0.8"/>')
    elif variant == "C":
        for x0, y0, x1, y1 in dots:
            w = (x1 - x0) * 2.6
            h = (y1 - y0) * 0.95
            els.append(f'<path fill="{accent}" fill-opacity="{accent_op}" d="{strip_path((x0 + x1) / 2, (y0 + y1) / 2 - (y1 - y0) * 0.05, w, h, -12)}"/>')
    elif variant == "B":
        els.append(f'<path fill="{accent}" fill-opacity="{accent_op}" d="{wave_path(E * 0.02, word_w - E * 0.02, E * 0.3, E * 0.055, E * 0.075)}"/>')

    pad = E * 0.25
    top = -E * 0.95
    bottom = E * 0.42 if variant == "B" else E * 0.28
    width = word_w

    if kind == "wordmark":
        pass
    elif kind == "horizontal":
        by_size = x_h * 0.28 / (body.x_height / body.upm)
        bp, bx = text_paths(body, "by Yafho", word_w + E * 0.16, 0, by_size)
        els.append(f'<path fill="{mono or text2}" d="{" ".join(bp)}"/>')
        width = bx
    elif kind == "full":
        by_size = x_h * 0.28 / (body.x_height / body.upm)
        by_w = body.width("by Yafho", by_size)
        by_y = bottom + by_size * 0.9
        bp, _ = text_paths(body, "by Yafho", word_w - by_w, by_y, by_size)
        els.append(f'<path fill="{mono or text2}" d="{" ".join(bp)}"/>')
        d_face = Face(FONTS["heading_uz"]["files"], 500) if lang != "ru" else body
        d_text = DESCRIPTOR[lang]
        d_size = E * 0.17
        d_w = d_face.width(d_text, d_size)
        d_y = by_y + d_size * 1.75
        dp, _ = text_paths(d_face, d_text, (word_w - d_w) / 2 if d_w < word_w else 0, d_y, d_size)
        els.append(f'<path fill="{ink}" fill-opacity="{"1" if mono else "0.85"}" d="{" ".join(dp)}"/>')
        bottom = d_y + d_size * 0.3
        width = max(word_w, d_w)
    elif kind == "icon":
        return build_icon(variant, mono)

    vb = f"{fmt(-pad)} {fmt(top - pad)} {fmt(width + pad * 2)} {fmt(bottom - top + pad * 2)}"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="silicare by Yafho">\n'
        + "\n".join("  " + e for e in els)
        + "\n</svg>\n"
    )


def build_icon(variant: str, mono: str | None = None) -> str:
    """Иконка для аватара: тёмный скруглённый квадрат, символ варианта, строчная «s»."""
    head = Face(FONTS["heading"]["files"], FONTS["heading"]["weight"])
    deep, soft, bg = (PALETTE[k][0] for k in ("teal_deep", "teal_soft", "bg"))
    S = 256.0
    els = [f'<rect width="{S}" height="{S}" rx="{S * 0.22}" fill="{mono or deep}"/>']
    sym = "#FFFFFF" if mono else soft
    if variant == "A":
        els.append(f'<path fill="{sym}" fill-opacity="0.9" d="{drop_path(S / 2, S * 0.78, S * 0.5, S * 0.64)}"/>')
    elif variant == "B":
        els.append(f'<path fill="{sym}" fill-opacity="0.9" d="{wave_path(S * 0.1, S * 0.9, S * 0.66, S * 0.07, S * 0.1)}"/>')
    else:
        els.append(f'<path fill="{sym}" fill-opacity="0.9" d="{strip_path(S / 2, S * 0.5, S * 0.76, S * 0.3, -14)}"/>')
    size = S * 0.5
    w = head.width("s", size)
    y = S * 0.5 + (head.x_height * size / head.upm) / 2
    if variant == "A":
        y = S * 0.72
    sp, _ = text_paths(head, "s", (S - w) / 2, y, size)
    s_color = (mono or deep) if variant != "B" else (mono and "#FFFFFF") or bg
    if variant == "B":
        s_color = bg if not mono else deep
    els.append(f'<path fill="{s_color}" d="{" ".join(sp)}"/>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S:.0f} {S:.0f}" role="img" aria-label="silicare">\n'
        + "\n".join("  " + e for e in els)
        + "\n</svg>\n"
    )


# ——— Иконки свойств (линейные, 48×48, stroke 3) ———

ICONS = {
    "medical-silicone": (
        "Медицинский силикон",
        '<path d="M14 10h20a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z"/>'
        '<path d="M24 17v14M17 24h14"/>',
    ),
    "reusable": (
        "Многоразовая",
        '<path d="M36 20a13 13 0 0 0-23-5M12 28a13 13 0 0 0 23 5"/>'
        '<path d="M36 10v10h-10M12 38V28h10"/>',
    ),
    "cut-to-size": (
        "Режется по размеру",
        '<circle cx="15" cy="33" r="5"/><circle cx="15" cy="15" r="5"/>'
        '<path d="M19 18l19 14M19 30l19-14"/>',
    ),
    "healed-skin-only": (
        "Только на зажившую кожу",
        '<path d="M8 30c6-10 26-10 32 0"/><path d="M14 24l20 0"/><path d="M24 10v6M20 13h8"/>',
    ),
}


def build_icons():
    deep = PALETTE["teal_deep"][0]
    (BRAND / "icons").mkdir(exist_ok=True)
    for name, (title, inner) in ICONS.items():
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="{deep}" '
            f'stroke-width="3" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="{title}">\n'
            f"  {inner}\n</svg>\n"
        )
        (BRAND / "icons" / f"{name}.svg").write_text(svg)


# ——— Отчёты ———

PAIRS = [
    ("teal_deep", "bg", "Заголовки и логотип на фоне коробки"),
    ("text2", "bg", "Вторичный текст, by Yafho на фоне"),
    ("teal_deep", "nude", "Текст на тёплом нюде (lifestyle, схема кожи)"),
    ("text2", "nude", "Мелкий текст на нюде"),
    ("teal_deep", "teal_soft", "Текст на акцентной плашке"),
    ("white", "teal_deep", "Реверс: белый текст на тёмном"),
    ("bg", "teal_deep", "Реверс: фон-цвет на тёмном"),
    ("white", "teal_soft", "Белый текст на акценте (ожидаемо не проходит)"),
    ("teal_soft", "bg", "Акцент как цвет текста на фоне (не для текста)"),
]


def contrast_report() -> str:
    lines = [
        "# Контраст палитры Silicare (WCAG 2.1)",
        "",
        "AA: обычный текст ≥ 4,5:1, крупный (≥ 18 pt или ≥ 14 pt bold) ≥ 3:1. AAA: ≥ 7:1.",
        "",
        "| Текст | Фон | Контраст | Обычный текст | Крупный текст | Где |",
        "|---|---|---|---|---|---|",
    ]
    for fg, bg, where in PAIRS:
        r = contrast(PALETTE[fg][0], PALETTE[bg][0])
        normal = "AAA" if r >= 7 else "AA" if r >= 4.5 else "✗"
        large = "AA" if r >= 3 else "✗"
        lines.append(f"| {fg} {PALETTE[fg][0]} | {bg} {PALETTE[bg][0]} | {r:.2f}:1 | {normal} | {large} | {where} |")
    lines += [
        "",
        "## Выводы",
        "",
        "- Основной текст — только `teal_deep` на `bg`/`nude`/`white` и реверс `bg`/`white` на `teal_deep`.",
        "- `text2` годится для мелкого текста на `bg` и `nude` (см. таблицу), на `teal_soft` — нет.",
        "- `teal_soft` — только заливки, иконки, плашки и декор; текст поверх него — `teal_deep`.",
        "- Юридический блок на коробке (6 pt) — `teal_deep` на `bg`, без полутонов.",
    ]
    return "\n".join(lines) + "\n"


def fonts_report() -> str:
    tests = {
        "Русская кириллица": "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя",
        "Узбекская кириллица ў қ ғ ҳ": "ўқғҳЎҚҒҲ",
        "Узбекская латиница oʻ gʻ (ʻ U+02BB)": "oʻgʻOʻGʻ",
        "Апостроф ʼ U+02BC": "ʼ",
        "Апостроф ’ U+2019": "’",
        "Знаки № × – — «» ₽": "№×–—«»",
        "Цифры и %": "0123456789%",
    }
    rows = []
    for key in ("heading", "heading_uz", "body"):
        spec = FONTS[key]
        face = Face(spec["files"], spec["weight"])
        for name, chars in tests.items():
            missing = [c for c in chars if not _has(face, c)]
            rows.append((key, spec["family"], name, "✓" if not missing else "✗ " + " ".join(f"{c} U+{ord(c):04X}" for c in missing)))
    lines = [
        "# Шрифты: покрытие кириллицы и узбекской латиницы",
        "",
        "Файлы: `brand/fonts/` (Manrope, Inter — вариативные, SIL OFL).",
        "",
        "| Роль | Семейство | Проверка | Результат |",
        "|---|---|---|---|",
    ]
    lines += [f"| {k} | {f} | {n} | {r} |" for k, f, n, r in rows]
    lines += [
        "",
        "## Правила",
        "",
        "- **Manrope SemiBold** — заголовки и логотип на русском и в латинице без узбекских букв.",
        "- **Inter SemiBold** — заголовки на узбекском: и кириллица (қ ғ ҳ), и латиница (ʻ U+02BB). В Manrope этих знаков нет.",
        "- **Inter Regular/Medium** — весь наборный текст на всех языках.",
        "- Апостроф в oʻ gʻ — только ʻ U+02BB. Автопроверка отклоняет ' U+0027 и ’ U+2019 в узбекской латинице.",
        "- Логотип и иконки — в кривых (`brand/logo/*.svg`), шрифты для них не нужны.",
    ]
    return "\n".join(lines) + "\n"


def _has(face: Face, ch: str) -> bool:
    try:
        face.glyph(ch)
        return True
    except KeyError:
        return False


# ——— Токены ———


def tokens() -> dict:
    colors = {}
    for k, (hx, role) in PALETTE.items():
        rgb = hex_rgb(hx)
        colors[k] = {"hex": hx, "rgb": list(rgb), "cmyk": rgb_cmyk(rgb), "role": role}
    return {
        "_source": "ТЗ-1 Silicare by Yafho, раздел 1. Генерируется brand/build.py — правь там.",
        "brand": {
            "name": "Silicare",
            "wordmark": "silicare",
            "endorsement": "by Yafho",
            "instagram": "@sil.icare",
            "manufacturer": "HONY MEDICAL CO., LTD",
            "descriptor": DESCRIPTOR,
        },
        "colors": colors,
        "stripes": {"150": "teal_soft", "300": "teal_deep", "_note": "Метка длины на торце и верхе коробки"},
        "cmyk_note": "CMYK посчитан из sRGB без ICC-профиля — ориентир для макета. Финальную конвертацию и цветопробу делает типография.",
        "fonts": {
            "heading": {"family": "Manrope", "weight": 600, "use": "Заголовки RU и латиница без узбекских букв, логотип"},
            "heading_uz": {"family": "Inter", "weight": 600, "use": "Заголовки на узбекском (кириллица қ ғ ҳ и латиница ʻ) — в Manrope этих знаков нет"},
            "body": {"family": "Inter", "weight": [400, 500], "use": "Наборный текст на всех языках"},
            "files": "brand/fonts/*.woff2 (вариативные, SIL OFL)",
            "uz_latn_apostrophe": "ʻ U+02BB",
        },
        "type": {
            "box_min_pt": 6,
            "slide_min_px": 28,
            "video_headline_min_px": 64,
            "video_caption_min_px": 40,
            "logo_tracking_em": TRACKING,
            "by_yafho_ratio": 0.28,
        },
        "logo": {
            "variants": VARIANTS,
            "clearspace": "высота строчной «s» со всех сторон",
            "min_width_mm": {"full": 25, "horizontal": 30, "wordmark": 18, "icon": 6},
            "files": "brand/logo/<A|B|C>/{wordmark,full_ru,full_uz-latn,full_uz,horizontal,icon,mono,mono_reverse,icon_mono}.svg",
        },
        "print": {
            "board": "мелованный картон 300–350 г/м²",
            "lamination": "матовая soft-touch",
            "spot_uv": ["логотип", "символ (капля/волна/полоска)"],
            "bleed_mm": 3,
            "safe_mm": 3,
        },
        "style": {
            "reference": "премиум-минимализм «медицинская косметика»: много воздуха, один акцент, без сине-красного и дешёвых градиентов",
            "video_backdrops": ["bg", "nude", "teal_soft"],
            "headline": {"align": "left", "size_hook": 96, "size": 80, "weight": 600, "tracking_em": -0.02, "leading": 1.05, "top_px": 300},
            "chip": {"size": 34, "radius": 999, "bg": "rgba(255,255,255,0.72)"},
        },
    }


def main():
    (BRAND / "tokens.json").write_text(json.dumps(tokens(), ensure_ascii=False, indent=2) + "\n")
    deep, bg = PALETTE["teal_deep"][0], PALETTE["bg"][0]
    for v in VARIANTS:
        d = BRAND / "logo" / v
        d.mkdir(parents=True, exist_ok=True)
        (d / "wordmark.svg").write_text(build_logo(v, "wordmark"))
        (d / "full_ru.svg").write_text(build_logo(v, "full", "ru"))
        (d / "full_uz-latn.svg").write_text(build_logo(v, "full", "uz-latn"))
        (d / "full_uz.svg").write_text(build_logo(v, "full", "uz"))
        (d / "horizontal.svg").write_text(build_logo(v, "horizontal"))
        (d / "mono.svg").write_text(build_logo(v, "full", "ru", mono=deep))
        (d / "mono_reverse.svg").write_text(build_logo(v, "full", "ru", mono=bg))
        (d / "icon.svg").write_text(build_icon(v))
        (d / "icon_mono.svg").write_text(build_icon(v, mono=deep))
    build_icons()
    QA.mkdir(exist_ok=True)
    (QA / "contrast_report.md").write_text(contrast_report())
    (QA / "fonts_report.md").write_text(fonts_report())
    print("ok: tokens, 3×9 logo svg, icons, qa reports")


if __name__ == "__main__":
    main()
