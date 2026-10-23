import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { brand, colors, fontFamily } from "../brand";
import type { Lang } from "../reels";

// Общие элементы сцен: фон льна и кожи, силиконовая пластина, плёнка, упаковка, реквизит.
// Всё рисуется кодом — права на изображения не нужны, стиль один во всех роликах.

export const W = 1080;
export const H = 1920;
export const ease = Easing.bezier(0.45, 0, 0.2, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

// Локальное время кадра: секунды и доля 0..1
export const useShotTime = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return { t: frame / fps, p: frame / Math.max(1, durationInFrames - 1), frame, fps, duration: durationInFrames / fps };
};

// Фаза 0..1 между долями кадра a и b
export const phase = (p: number, a: number, b: number, e = ease) =>
  interpolate(p, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

// Медленный наезд камеры и лёгкий слайд — без резких движений
export const Camera: React.FC<{ children: React.ReactNode; push?: number; slide?: number }> = ({
  children,
  push = 0.06,
  slide = 0,
}) => {
  const { p } = useShotTime();
  const k = phase(p, 0, 1, Easing.bezier(0.3, 0, 0.7, 1));
  return (
    <AbsoluteFill style={{ transform: `translateX(${slide * k}px) scale(${1 + push * k})` }}>{children}</AbsoluteFill>
  );
};

// Мягкий боковой свет окна и виньетка поверх любой сцены
export const Light: React.FC<{ warm?: number }> = ({ warm = 0 }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(90% 60% at 8% 22%, rgba(255,${246 - warm * 20},${226 - warm * 50},${0.42 + warm * 0.15}) 0%, rgba(255,255,255,0) 60%)`,
        mixBlendMode: "soft-light",
      }}
    />
    <AbsoluteFill
      style={{ background: "radial-gradient(120% 85% at 50% 45%, rgba(0,0,0,0) 55%, rgba(43,43,43,0.22) 100%)" }}
    />
  </AbsoluteFill>
);

// Бежевый лён
export const Linen: React.FC<{ tint?: string }> = ({ tint = colors.linen }) => (
  <AbsoluteFill style={{ backgroundColor: tint }}>
    <AbsoluteFill
      style={{
        opacity: 0.55,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(120,95,75,0.07) 0 2px, transparent 2px 7px), repeating-linear-gradient(90deg, rgba(120,95,75,0.06) 0 2px, transparent 2px 8px)",
      }}
    />
    <AbsoluteFill
      style={{ background: "linear-gradient(170deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%, rgba(120,90,70,0.08) 100%)" }}
    />
  </AbsoluteFill>
);

// Белая махровая ткань полотенца
export const Towel: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#FAF8F4" }}>
    <svg width={W} height={H}>
      {new Array(900).fill(0).map((_, i) => (
        <circle
          key={i}
          cx={random(`tx${i}`) * W}
          cy={random(`ty${i}`) * H}
          r={4 + random(`tr${i}`) * 5}
          fill="none"
          stroke="rgba(150,135,120,0.10)"
          strokeWidth={2}
        />
      ))}
    </svg>
  </AbsoluteFill>
);

// Кожа предплечья крупным планом; линия карандашом вместо настоящего рубца
export const Skin: React.FC<{ line?: boolean; creases?: number }> = ({ line = true, creases = 0 }) => (
  <AbsoluteFill>
    <svg width={W} height={H}>
      <defs>
        <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EECDB5" />
          <stop offset="0.55" stopColor="#E3B89C" />
          <stop offset="1" stopColor="#D2A586" />
        </linearGradient>
        <radialGradient id="skinShade" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#5A3A28" stopOpacity={0.22} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#skin)" />
      {new Array(260).fill(0).map((_, i) => (
        <circle
          key={i}
          cx={random(`sx${i}`) * W}
          cy={random(`sy${i}`) * H}
          r={1.2 + random(`sr${i}`) * 2.2}
          fill="#8A5A40"
          opacity={0.06 + random(`so${i}`) * 0.05}
        />
      ))}
      {new Array(14).fill(0).map((_, i) => (
        <path
          key={`f${i}`}
          d={wave((x) => 140 + i * 130 + Math.sin(x / (120 + i * 9) + i) * 16)}
          stroke="#8A5A40"
          strokeOpacity={0.05}
          strokeWidth={2}
          fill="none"
        />
      ))}
      {creases > 0
        ? [0, 1, 2].map((i) => (
            <path
              key={`c${i}`}
              d={`M ${300 + i * 40} ${1040 + i * 26} Q 540 ${1000 + i * 26 - creases * 30} ${780 - i * 40} ${1040 + i * 26}`}
              stroke="#7A4A35"
              strokeOpacity={0.16 * creases}
              strokeWidth={3}
              fill="none"
            />
          ))
        : null}
      {line ? <ScarLine /> : null}
      <rect width={W} height={H} fill="url(#skinShade)" />
    </svg>
  </AbsoluteFill>
);

export const SCAR = { x1: 470, y1: 470, x2: 610, y2: 1130 };

const ScarLine: React.FC = () => (
  <path
    d={`M ${SCAR.x1} ${SCAR.y1} C 520 640, 560 860, ${SCAR.x2} ${SCAR.y2}`}
    stroke="#6E5A52"
    strokeOpacity={0.5}
    strokeWidth={6}
    strokeLinecap="round"
    fill="none"
  />
);

type SheetProps = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
  // 0 — лежит отдельно, 1 — прилегает к коже (прозрачнее, без тени)
  adhered?: number;
  // 0..1 — где проходит блик
  sheen?: number;
  // 0..1 — пластина приподнята над поверхностью
  lift?: number;
  // Размер загнутого угла в пикселях (правый верхний)
  curl?: number;
  scaleX?: number;
  // Защитная плёнка поверх: 0 — снята
  film?: number;
  filmOffset?: { x: number; y: number; r: number };
};

// Тонкая прозрачная силиконовая пластина с бликом и мягкой тенью
export const Sheet: React.FC<SheetProps> = ({
  id,
  x,
  y,
  w,
  h,
  rotate = 0,
  adhered = 0,
  sheen = 0.5,
  lift = 0,
  curl = 0,
  scaleX = 1,
  film = 0,
  filmOffset = { x: 0, y: 0, r: 0 },
}) => {
  const r = Math.min(w, h) * 0.12;
  const c = Math.min(curl, Math.min(w, h) * 0.8);
  // Пластина без загнутого угла
  const body = c > 0
    ? `M ${r} 0 L ${w - c} 0 L ${w} ${c} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`
    : roundRect(w, h, r);
  const bodyOpacity = 0.5 - adhered * 0.28;
  const shadowOffset = 6 + lift * 40;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={bodyOpacity + 0.12} />
          <stop offset="0.5" stopColor="#F4F7F6" stopOpacity={bodyOpacity} />
          <stop offset="1" stopColor="#E6EEEC" stopOpacity={bodyOpacity + 0.06} />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset={Math.max(0, sheen - 0.18)} stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset={sheen} stopColor="#FFFFFF" stopOpacity={0.55 - adhered * 0.2} />
          <stop offset={Math.min(1, sheen + 0.18)} stopColor="#FFFFFF" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`${id}-flap`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
          <stop offset="1" stopColor="#E8EFEE" stopOpacity={0.55} />
        </linearGradient>
        <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={8 + lift * 22} />
        </filter>
        <pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4A7F92" strokeOpacity={0.22} strokeWidth={1.5} />
        </pattern>
      </defs>
      <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scaleX} 1) translate(${-w / 2} ${-h / 2})`}>
        {adhered < 1 ? (
          <path
            d={body}
            transform={`translate(${shadowOffset * 0.6} ${shadowOffset})`}
            fill="#5A3E2E"
            opacity={(0.2 + lift * 0.08) * (1 - adhered)}
            filter={`url(#${id}-blur)`}
          />
        ) : null}
        <path d={body} fill={`url(#${id}-fill)`} />
        <path d={body} fill={`url(#${id}-sheen)`} />
        {/* Скошенная кромка: силикон светится по краю в контровом свете */}
        <path d={body} fill="none" stroke="#FFFFFF" strokeOpacity={0.9 - adhered * 0.3} strokeWidth={3} />
        <path d={body} fill="none" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={14} transform="translate(0 0)" />
        {c > 0 ? (
          <>
            <path d={`M ${w - c} 0 L ${w} ${c} L ${w - c} ${c} Z`} fill="#3A2A20" opacity={0.12} filter={`url(#${id}-blur)`} />
            <path
              d={`M ${w - c} 0 L ${w} ${c} L ${w - c * 0.92 - lift * 10} ${c * 0.92 + lift * 10} Z`}
              fill={`url(#${id}-flap)`}
              stroke="#FFFFFF"
              strokeWidth={2.5}
            />
          </>
        ) : null}
        {film > 0 ? (
          <g
            opacity={film}
            transform={`translate(${filmOffset.x} ${filmOffset.y}) rotate(${filmOffset.r} ${w / 2} ${h / 2})`}
          >
            <path d={roundRect(w + 8, h + 8, r)} transform="translate(-4 -4)" fill="#D6E8EE" fillOpacity={0.62} />
            <path d={roundRect(w + 8, h + 8, r)} transform="translate(-4 -4)" fill={`url(#${id}-grid)`} />
            <path
              d={roundRect(w + 8, h + 8, r)}
              transform="translate(-4 -4)"
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity={0.8}
              strokeWidth={2}
            />
          </g>
        ) : null}
      </g>
    </svg>
  );
};

// Упаковка — макет до фото реальной коробки Yafho
export const Pack: React.FC<{ x: number; y: number; scale?: number; lang: Lang; open?: number; rotate?: number }> = ({
  x,
  y,
  scale = 1,
  lang,
  open = 0,
  rotate = 0,
}) => {
  const w = 440;
  const h = 600;
  const d = 70;
  const line = lang === "ru" ? ["силиконовый", "пластырь для рубцов"] : ["силикон пластир", "чандиқлар учун"];
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <filter id="packShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={22} />
        </filter>
        <linearGradient id="packFront" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F1ECE6" />
        </linearGradient>
      </defs>
      <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale}) translate(${-w / 2} ${-h / 2})`}>
        <ellipse cx={w / 2 + 40} cy={h + 18} rx={w * 0.62} ry={34} fill="#4A3426" opacity={0.28} filter="url(#packShadow)" />
        {/* Боковая грань */}
        <path d={`M ${w} 0 L ${w + d} ${-d * 0.45} L ${w + d} ${h - d * 0.45} L ${w} ${h} Z`} fill="#DCD3CA" />
        {/* Верхняя грань / крышка */}
        <g transform={`translate(0 0) ${open > 0 ? `skewX(${-open * 10})` : ""}`}>
          <path
            d={`M 0 0 L ${d} ${-d * 0.45 - open * 140} L ${w + d} ${-d * 0.45 - open * 140} L ${w} 0 Z`}
            fill={open > 0 ? "#EDE6DF" : "#F7F3EE"}
          />
        </g>
        <rect width={w} height={h} fill="url(#packFront)" />
        <rect y={h - 26} width={w} height={26} fill={colors.teal} />
        {/* Окошко с пластиной */}
        <rect x={56} y={250} width={w - 112} height={230} rx={22} fill="#EAF1EF" />
        <rect x={84} y={276} width={w - 168} height={178} rx={18} fill="#FFFFFF" opacity={0.75} stroke="#FFFFFF" strokeWidth={3} />
        <rect x={84} y={276} width={(w - 168) * 0.42} height={178} rx={18} fill="#FFFFFF" opacity={0.5} />
        <text x={56} y={120} fontFamily={fontFamily} fontWeight={700} fontSize={70} fill={colors.graphite} letterSpacing={-1}>
          sil<tspan fill={colors.teal}>·</tspan>icare
        </text>
        <text x={58} y={162} fontFamily={fontFamily} fontWeight={500} fontSize={26} fill={colors.graphite} opacity={0.7}>
          {brand.endorsement}
        </text>
        <text x={56} y={212} fontFamily={fontFamily} fontWeight={500} fontSize={24} fill={colors.graphite} opacity={0.75}>
          {line[0]} {line[1]}
        </text>
        <text x={56} y={540} fontFamily={fontFamily} fontWeight={600} fontSize={30} fill={colors.teal}>
          4 × 13 {lang === "ru" ? "см" : "см"}
        </text>
      </g>
    </svg>
  );
};

// Чашка чая сбоку, с лёгким паром
export const Cup: React.FC<{ x: number; y: number; scale?: number; t: number }> = ({ x, y, scale = 1, t }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    <defs>
      <linearGradient id="cupBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#E9E4DE" />
        <stop offset="0.35" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#D8D0C8" />
      </linearGradient>
      <filter id="steam">
        <feGaussianBlur stdDeviation={6} />
      </filter>
    </defs>
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx={0} cy={150} rx={190} ry={40} fill="#4A3426" opacity={0.18} filter="url(#steam)" />
      <ellipse cx={0} cy={140} rx={170} ry={36} fill="#F4F0EB" />
      <path d="M -120 0 L -100 130 Q 0 160 100 130 L 120 0 Z" fill="url(#cupBody)" />
      <path d="M 118 30 Q 190 30 180 80 Q 172 118 104 110" fill="none" stroke="#E2DBD3" strokeWidth={16} />
      <ellipse cx={0} cy={0} rx={120} ry={26} fill="#F7F3EE" />
      <ellipse cx={0} cy={4} rx={104} ry={20} fill="#B07A4C" />
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={wave((v) => -60 - v * 0.4, 200, (yy) => Math.sin(yy / 30 + t * 1.6 + i * 2) * 14 + (i - 1) * 34, true)}
          stroke="#FFFFFF"
          strokeOpacity={0.45}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
          filter="url(#steam)"
        />
      ))}
    </g>
  </svg>
);

// Детские носочки
export const Socks: React.FC<{ x: number; y: number; scale?: number }> = ({ x, y, scale = 1 }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${i * 110} ${i * 18}) rotate(${i * 8 - 6})`}>
          <path
            d="M 0 0 L 70 0 L 70 120 Q 70 170 120 170 Q 150 172 150 200 Q 150 228 110 228 L 40 228 Q 0 228 0 180 Z"
            fill={colors.powder}
            stroke="#D6AFA4"
            strokeWidth={3}
          />
          <rect x={0} y={0} width={70} height={30} rx={6} fill="#F1DDD6" />
        </g>
      ))}
    </g>
  </svg>
);

// Мыльница с мылом
export const Soap: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={40} rx={170} ry={46} fill="#E4E8E6" stroke="#FFFFFF" strokeWidth={4} />
      <rect x={-110} y={-30} width={220} height={80} rx={36} fill="#FBF6EF" stroke="#EDE3D8" strokeWidth={3} />
    </g>
  </svg>
);

// Капля воды
export const Drop: React.FC<{ x: number; y: number; r: number; stretch?: number }> = ({ x, y, r, stretch = 1 }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    <defs>
      <radialGradient id={`drop${Math.round(r)}`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
        <stop offset="0.35" stopColor="#E9F3F2" stopOpacity={0.55} />
        <stop offset="1" stopColor="#9DBDB9" stopOpacity={0.45} />
      </radialGradient>
    </defs>
    <ellipse cx={x + r * 0.25} cy={y + r * 0.35} rx={r} ry={r * stretch} fill="#2B2B2B" opacity={0.1} />
    <ellipse cx={x} cy={y} rx={r} ry={r * stretch} fill={`url(#drop${Math.round(r)})`} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2} />
    <ellipse cx={x - r * 0.35} cy={y - r * 0.4 * stretch} rx={r * 0.22} ry={r * 0.14} fill="#FFFFFF" opacity={0.9} />
  </svg>
);

export const roundRect = (w: number, h: number, r: number) =>
  `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;

// Кривая вдоль оси X (или Y, если vertical)
export const wave = (f: (v: number) => number, len = W, g?: (v: number) => number, vertical = false) => {
  let d = "";
  for (let v = 0; v <= len; v += 20) {
    const a = vertical ? (g ? g(v) : 0) : v;
    const b = vertical ? f(v) : f(v);
    d += `${v === 0 ? "M" : "L"} ${a.toFixed(1)} ${b.toFixed(1)} `;
  }
  return d.trim();
};
