import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brand, colors, fontFamily, VIDEO } from "./brand";
import { toCards } from "./cards";
import type { Lang, Reel, Shot } from "./reels";
import { SkinSection } from "./SkinSection";
import { Scene3D } from "./three/scenes";

export type ReelProps = {
  reel: Reel;
  lang: Lang;
  // Показать рамки безопасных зон Instagram (верх 250, низ 300) для проверки
  showSafeZones: boolean;
};

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const S = brand.style;

export const backdropOf = (reel: Reel, shot?: Shot) =>
  colors[(shot?.backdrop ?? reel.backdrop ?? "linen") as keyof typeof colors];

export const ReelVideo: React.FC<ReelProps> = ({ reel, lang, showSafeZones }) => {
  const { fps } = useVideoConfig();
  const last = reel.shots[reel.shots.length - 1];
  const dark = reel.kind === "animation";
  const span = (s: Shot) => ({
    from: Math.round(s.start * fps),
    durationInFrames: Math.round((s.end - s.start) * fps),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: backdropOf(reel), fontFamily }}>
      {dark ? (
        <SkinSection reel={reel} />
      ) : (
        reel.shots.map((shot) => (
          <Sequence key={shot.n} {...span(shot)} name={`Кадр ${shot.n}`}>
            <ShotBackground reel={reel} shot={shot} lang={lang} />
          </Sequence>
        ))
      )}

      {reel.shots.map((shot) =>
        shot === last ? null : (
          <Sequence key={`t${shot.n}`} {...span(shot)} name={`Заголовок ${shot.n}`}>
            <Headline
              text={lang === "ru" ? shot.text_ru : shot.text_uz}
              hook={shot.n === 1}
              dark={dark}
              chips={shot.chips?.[lang]}
            />
          </Sequence>
        ),
      )}

      <Sequence {...span(last)} name="Финал: логотип и действие">
        <EndCard reel={reel} lang={lang} cta={lang === "ru" ? last.text_ru : last.text_uz} dark={dark} />
      </Sequence>

      {reel.music ? <Music src={reel.music} /> : null}
      {showSafeZones ? <SafeZones /> : null}
    </AbsoluteFill>
  );
};

// Отснятый клип; пока его нет — 3D-сцена продукта; без сцены — раскадровка
const ShotBackground: React.FC<{ reel: Reel; shot: Shot; lang: Lang }> = ({ reel, shot, lang }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.06], { extrapolateRight: "clamp" });
  // Мягкий вход кадра из цвета фона
  const fadeIn = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: "clamp" });

  let body: React.ReactNode;
  if (shot.clip) {
    body = (
      <OffthreadVideo
        src={staticFile(shot.clip)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          filter: "saturate(0.94) sepia(0.06) contrast(0.98)",
        }}
      />
    );
  } else if (shot.scene) {
    body = <Scene3D shot={shot} lang={lang} bg={backdropOf(reel, shot)} />;
  } else {
    body = (
      <div style={{ position: "absolute", top: 760, left: VIDEO.safe_side_px, right: VIDEO.safe_side_px, color: colors.graphite, opacity: 0.5, fontSize: 34, lineHeight: 1.35 }}>
        <div style={{ fontSize: 26, letterSpacing: 4, marginBottom: 12 }}>РАСКАДРОВКА · КАДР {shot.n}</div>
        {shot.visual}
      </div>
    );
  }
  return <AbsoluteFill style={{ overflow: "hidden", opacity: fadeIn }}>{body}</AbsoluteFill>;
};

// Заголовок как на сайтах DTC-брендов: слева, крупно, плотно; слова появляются по очереди
const Headline: React.FC<{ text: string; hook: boolean; dark: boolean; chips?: string[] }> = ({ text, hook, dark, chips }) => {
  const { durationInFrames } = useVideoConfig();
  const cards = toCards(text, VIDEO.max_words_per_card);
  if (!cards.length) return null;
  const per = Math.floor(durationInFrames / cards.length);
  return (
    <>
      {cards.map((card, i) => (
        <Sequence key={i} from={i * per} durationInFrames={i === cards.length - 1 ? durationInFrames - i * per : per}>
          <HeadlineCard text={card} size={hook && i === 0 ? S.headline.size_hook : S.headline.size} dark={dark} chips={i === 0 ? chips : undefined} />
        </Sequence>
      ))}
    </>
  );
};

const HeadlineCard: React.FC<{ text: string; size: number; dark: boolean; chips?: string[] }> = ({ text, size, dark, chips }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const out = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const words = text.split(/\s+/);
  return (
    <AbsoluteFill style={{ paddingTop: S.headline.top_px, paddingLeft: VIDEO.safe_side_px, paddingRight: VIDEO.safe_side_px + 40, opacity: out }}>
      <div
        style={{
          fontSize: size,
          fontWeight: S.headline.weight,
          lineHeight: S.headline.leading,
          letterSpacing: `${S.headline.tracking_em}em`,
          color: dark ? colors.white : colors.ink,
          maxWidth: 900,
        }}
      >
        {words.map((w, i) => {
          const k = interpolate(frame, [i * 2, i * 2 + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
          return (
            <span key={i} style={{ display: "inline-block", opacity: k, transform: `translateY(${(1 - k) * 28}px)`, marginRight: "0.24em" }}>
              {w}
            </span>
          );
        })}
      </div>
      {chips?.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 36 }}>
          {chips.map((c, i) => {
            const k = interpolate(frame, [10 + i * 4, 24 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
            return (
              <div
                key={c}
                style={{
                  opacity: k,
                  transform: `translateY(${(1 - k) * 16}px)`,
                  padding: "16px 28px",
                  borderRadius: S.chip.radius,
                  background: S.chip.bg,
                  border: "1.5px solid rgba(31,31,31,0.08)",
                  fontSize: S.chip.size,
                  fontWeight: 600,
                  color: colors.ink,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ width: 12, height: 12, borderRadius: 6, background: colors.teal }} />
                {c}
              </div>
            );
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// Финал: знак sil·icare, кнопка-действие, дисклеймер медизделия (если продукт в кадре)
const EndCard: React.FC<{ reel: Reel; lang: Lang; cta: string; dark: boolean }> = ({ reel, lang, cta, dark }) => {
  const frame = useCurrentFrame();
  const k = (a: number, b: number) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const ink = dark ? colors.white : colors.ink;
  const ctaParts = toCards(cta, 12);
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <AbsoluteFill
        style={{
          opacity: k(0, 16),
          background: dark
            ? "linear-gradient(180deg, rgba(43,43,43,0) 6%, rgba(43,43,43,0.6) 18%, rgba(43,43,43,0) 42%)"
            : `linear-gradient(180deg, rgba(255,255,255,0) 6%, ${hexA(backdropOf(reel), 0.9)} 17%, ${hexA(backdropOf(reel), 0)} 44%)`,
        }}
      />
      <div style={{ position: "absolute", top: 300, textAlign: "center", color: ink, opacity: k(2, 18), transform: `translateY(${(1 - k(2, 18)) * 20}px)` }}>
        <div style={{ fontSize: 118, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
          sil<span style={{ color: colors.teal }}>·</span>icare
        </div>
        <div style={{ fontSize: 36, fontWeight: 500, opacity: 0.7, marginTop: 10 }}>
          {brand.endorsement} · {brand.instagram}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 530,
          opacity: k(10, 26),
          transform: `translateY(${(1 - k(10, 26)) * 20}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            padding: "26px 52px",
            borderRadius: 999,
            background: dark ? colors.white : colors.ink,
            color: dark ? colors.ink : colors.white,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            maxWidth: 900,
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          {ctaParts[0]}
        </div>
        {ctaParts.slice(1).map((p) => (
          <div key={p} style={{ fontSize: 36, fontWeight: 500, color: ink, opacity: 0.8, maxWidth: 860, textAlign: "center", lineHeight: 1.25 }}>
            {p}
          </div>
        ))}
      </div>
      {reel.shows_product && reel.disclaimer ? (
        <div
          style={{
            position: "absolute",
            bottom: VIDEO.safe_bottom_px,
            left: VIDEO.safe_side_px,
            right: VIDEO.safe_side_px,
            opacity: k(14, 30) * 0.9,
            fontSize: 28,
            fontWeight: 500,
            lineHeight: 1.3,
            textAlign: "center",
            color: ink,
            padding: "14px 24px",
            borderRadius: 24,
            background: dark ? "rgba(43,43,43,0.55)" : "rgba(255,255,255,0.6)",
          }}
        >
          {brand.disclaimer[lang]}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// Лицензированный трек: тихо, с затуханием в конце
const Music: React.FC<{ src: string }> = ({ src }) => {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <Audio
      src={staticFile(src)}
      volume={(f) =>
        interpolate(f, [0, fps, durationInFrames - fps * 1.5, durationInFrames], [0, 0.35, 0.35, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
};

const SafeZones: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={zone(0, VIDEO.safe_top_px)} />
    <div style={zone(1920 - VIDEO.safe_bottom_px, VIDEO.safe_bottom_px)} />
  </AbsoluteFill>
);

const zone = (top: number, height: number): React.CSSProperties => ({
  position: "absolute",
  top,
  height,
  left: 0,
  right: 0,
  backgroundColor: "rgba(220, 0, 120, 0.18)",
  borderTop: "2px dashed rgba(220,0,120,0.6)",
  borderBottom: "2px dashed rgba(220,0,120,0.6)",
});

const hexA = (hex: string, a: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
};
