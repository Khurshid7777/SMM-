import React from "react";
import { AbsoluteFill, interpolate, interpolateColors, random, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { colors } from "./brand";
import type { Reel } from "./reels";

// Ролик 4 «Почему рубец становится грубым»: анимация среза кожи без красного.
// Фазы привязаны к таймингам кадров из JSON, поэтому правка таймингов в контенте двигает анимацию.

const W = 1080;
const SURFACE_Y = 820;
const DERMIS_BOTTOM = 1340;
const FIBERS = 22;
const DROPS = 16;
const ease = Easing.bezier(0.45, 0, 0.2, 1);

export const SkinSection: React.FC<{ reel: Reel }> = ({ reel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const at = (n: number) => reel.shots.find((s) => s.n === n) ?? reel.shots[0];
  const [s2, s3, s4, s5, s6] = [2, 3, 4, 5, 6].map(at);

  const k = (a: number, b: number) =>
    interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

  // Фазы 0..1
  const toSection = k(s2.start - 0.4, s2.start + 0.8);
  const draw = k(s2.start, s2.end - 0.5);
  const dry = k(s3.start, s3.end) * (1 - k(s5.start, s5.end - 1));
  const chaos = k(s4.start - 0.5, s4.end) - k(s6.start, s6.end - 1) * 0.75;
  const bump = k(s4.start, s4.end) * 70 - k(s6.start, s6.end) * 38;
  const silicone = k(s5.start, s5.start + 1.6);
  const tealShift = k(s5.start + 0.8, s6.start + 1);

  const warm = interpolateColors(dry, [0, 1], [colors.linen, "#EFD9C4"]);
  const dermis = interpolateColors(tealShift, [0, 1], [warm, "#E3E6E0"]);
  const epidermis = interpolateColors(tealShift, [0, 1], [colors.powder, "#CFE0DC"]);
  const fiberColor = interpolateColors(tealShift, [0, 1], ["#B88E7C", colors.teal]);

  const surface = (x: number) => SURFACE_Y - bump * Math.exp(-(((x - W / 2) / 210) ** 2)) + Math.sin(x / 70) * 3;
  const surfacePath = pathAlong((x) => surface(x));

  return (
    <AbsoluteFill style={{ backgroundColor: colors.graphite, overflow: "hidden" }}>
      {/* Кадр 1: макротекстура кожи, медленный пролёт вдоль поверхности */}
      <AbsoluteFill style={{ opacity: 1 - toSection }}>
        <SkinMacro t={t} />
      </AbsoluteFill>

      {/* Кадры 2–6: срез */}
      <AbsoluteFill style={{ opacity: toSection, transform: `scale(${1.25 - toSection * 0.25})` }}>
        <svg width={W} height={1920} viewBox={`0 0 ${W} 1920`}>
          <defs>
            <linearGradient id="sil" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
              <stop offset="1" stopColor={colors.teal} stopOpacity={0.35} />
            </linearGradient>
            <clipPath id="dermis">
              <path d={`${surfacePath} L ${W} ${DERMIS_BOTTOM} L 0 ${DERMIS_BOTTOM} Z`} />
            </clipPath>
          </defs>

          {/* Дерма и эпидермис */}
          <path d={`${surfacePath} L ${W} ${DERMIS_BOTTOM} L 0 ${DERMIS_BOTTOM} Z`} fill={dermis} />
          <path
            d={`${surfacePath} L ${W} ${surface(W) + 64} ${reversePath((x) => surface(x) + 64)} Z`}
            fill={epidermis}
          />
          <path
            d={pathAlong((x) => surface(x) + 64)}
            stroke={colors.graphite}
            strokeOpacity={0.25}
            strokeWidth={2}
            fill="none"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
          />

          {/* Волокна коллагена: густеют и путаются, под силиконом выравниваются */}
          <g clipPath="url(#dermis)">
            {new Array(FIBERS).fill(0).map((_, i) => {
              const baseY = SURFACE_Y + 95 + i * ((DERMIS_BOTTOM - SURFACE_Y - 120) / FIBERS);
              const freq = 0.006 + random(`f${i}`) * 0.01;
              const phase = random(`p${i}`) * Math.PI * 2;
              const amp = 4 + Math.max(0, chaos) * (14 + random(`a${i}`) * 26);
              const lift = (x: number) => bump * 0.8 * Math.exp(-(((x - W / 2) / 230) ** 2)) * (1 - i / FIBERS);
              const d = pathAlong((x) => baseY - lift(x) + Math.sin(x * freq + phase + t * 0.6) * amp);
              const visible = i < FIBERS * (0.45 + 0.55 * Math.max(0, chaos)) ? 1 : 0.25;
              return (
                <path
                  key={i}
                  d={d}
                  stroke={fiberColor}
                  strokeWidth={2 + Math.max(0, chaos) * 2.5}
                  strokeOpacity={0.55 * visible * draw}
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}
          </g>

          {/* Капли влаги: уходят вверх, под силиконом возвращаются */}
          {new Array(DROPS).fill(0).map((_, i) => {
            const x = 120 + random(`x${i}`) * (W - 240);
            const delay = random(`d${i}`) * 0.6;
            const rise = Math.max(0, Math.min(1, dry * 1.4 - delay));
            const under = surface(x) + 26;
            const y = under - rise * (180 + random(`h${i}`) * 160);
            const r = 7 + random(`r${i}`) * 7;
            const opacity = draw * (1 - rise * 0.9);
            return <circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={opacity * 0.85} />;
          })}

          {/* Слой силикона ложится сверху */}
          <path
            d={`${pathAlong((x) => surface(x) - 30)} L ${W} ${surface(W) + 2} ${reversePath((x) => surface(x) + 2)} Z`}
            fill="url(#sil)"
            opacity={silicone}
            transform={`translate(0 ${(1 - silicone) * -260})`}
          />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Макро кожи: мягкий градиент, поры и тонкие линии, медленный пролёт
const SkinMacro: React.FC<{ t: number }> = ({ t }) => {
  const shift = -t * 40;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${colors.powder} 0%, ${colors.linen} 60%, #E9D6C6 100%)` }}>
      <svg width={W} height={1920} style={{ transform: `translateX(${shift}px) scale(1.12)` }}>
        {new Array(140).fill(0).map((_, i) => (
          <circle
            key={i}
            cx={random(`mx${i}`) * (W + 300)}
            cy={random(`my${i}`) * 1920}
            r={1.5 + random(`mr${i}`) * 3}
            fill={colors.graphite}
            opacity={0.07}
          />
        ))}
        {new Array(18).fill(0).map((_, i) => (
          <path
            key={`l${i}`}
            d={pathAlong((x) => 120 + i * 100 + Math.sin(x / (90 + i * 7) + i) * 22, W + 300)}
            stroke={colors.graphite}
            strokeOpacity={0.06}
            strokeWidth={2}
            fill="none"
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

const pathAlong = (f: (x: number) => number, width = W) => {
  let d = "";
  for (let x = 0; x <= width; x += 20) d += `${x === 0 ? "M" : "L"} ${x} ${f(x).toFixed(1)} `;
  return d.trim();
};

const reversePath = (f: (x: number) => number) => {
  let d = "";
  for (let x = W; x >= 0; x -= 20) d += `L ${x} ${f(x).toFixed(1)} `;
  return d.trim();
};
