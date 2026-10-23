import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { brand, colors, fontFamily, VIDEO } from "./brand";
import { toCards } from "./cards";
import type { Lang, Reel, Shot } from "./reels";
import { SkinSection } from "./SkinSection";

export type ReelProps = {
  reel: Reel;
  lang: Lang;
  // Показать рамки безопасных зон Instagram (верх 250, низ 300) для проверки
  showSafeZones: boolean;
};

const ease = Easing.bezier(0.33, 0, 0.2, 1);

export const ReelVideo: React.FC<ReelProps> = ({ reel, lang, showSafeZones }) => {
  const { fps } = useVideoConfig();
  const last = reel.shots[reel.shots.length - 1];

  return (
    <AbsoluteFill style={{ backgroundColor: colors.linen, fontFamily }}>
      {reel.kind === "animation" ? (
        <SkinSection reel={reel} />
      ) : (
        reel.shots.map((shot) => (
          <Sequence
            key={shot.n}
            from={Math.round(shot.start * fps)}
            durationInFrames={Math.round((shot.end - shot.start) * fps)}
            name={`Кадр ${shot.n}`}
          >
            <ShotBackground reel={reel} shot={shot} />
          </Sequence>
        ))
      )}

      {reel.shots.map((shot) => (
        <Sequence
          key={`t${shot.n}`}
          from={Math.round(shot.start * fps)}
          durationInFrames={Math.round((shot.end - shot.start) * fps)}
          name={`Титры ${shot.n}`}
        >
          <Titles text={lang === "ru" ? shot.text_ru : shot.text_uz} isHook={shot.n === 1} />
        </Sequence>
      ))}

      <Sequence
        from={Math.round(last.start * fps)}
        durationInFrames={Math.round((last.end - last.start) * fps)}
        name="Финал: логотип"
      >
        <EndCard reel={reel} lang={lang} />
      </Sequence>

      {reel.music ? <Music src={reel.music} /> : null}
      {showSafeZones ? <SafeZones /> : null}
    </AbsoluteFill>
  );
};

// Отснятый клип, а пока его нет — раскадровка в палитре ролика
const ShotBackground: React.FC<{ reel: Reel; shot: Shot }> = ({ reel, shot }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // Медленный наезд, как в стиле бренда: без резких движений
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.06], { extrapolateRight: "clamp" });

  if (shot.clip) {
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <OffthreadVideo
          src={staticFile(shot.clip)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            // Тёплая мягкая коррекция, без «пластика»
            filter: "saturate(0.94) sepia(0.06) contrast(0.98)",
          }}
        />
      </AbsoluteFill>
    );
  }

  const base = colors[reel.palette[0] ?? "linen"];
  const accent = colors[reel.palette[reel.palette.length - 1] ?? "teal"];
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          background: `radial-gradient(120% 80% at 20% 25%, ${colors.white} 0%, ${base} 55%, ${mix(base, accent)} 100%)`,
        }}
      />
      {/* Фактура льна */}
      <AbsoluteFill
        style={{
          opacity: 0.18,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(43,43,43,0.08) 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, rgba(43,43,43,0.06) 0 1px, transparent 1px 6px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 300,
          left: VIDEO.safe_side_px,
          right: VIDEO.safe_side_px,
          color: colors.graphite,
          opacity: 0.55,
          fontSize: 34,
          fontWeight: 500,
          lineHeight: 1.35,
        }}
      >
        <div style={{ fontSize: 26, letterSpacing: 4, marginBottom: 12 }}>
          РАСКАДРОВКА · КАДР {shot.n}
        </div>
        {shot.visual}
      </div>
    </AbsoluteFill>
  );
};

// Карточки титров: до 7 слов, мягкое появление, низ 300 px свободен
const Titles: React.FC<{ text: string; isHook: boolean }> = ({ text, isHook }) => {
  const { durationInFrames } = useVideoConfig();
  const cards = toCards(text, VIDEO.max_words_per_card);
  if (!cards.length) return null;
  const per = Math.floor(durationInFrames / cards.length);

  return (
    <>
      {cards.map((card, i) => (
        <Sequence key={i} from={i * per} durationInFrames={i === cards.length - 1 ? durationInFrames - i * per : per}>
          <Card text={card} big={isHook && i === 0} />
        </Sequence>
      ))}
    </>
  );
};

const Card: React.FC<{ text: string; big: boolean }> = ({ text, big }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 9], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const fadeOut = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 12], [18, 0], { extrapolateRight: "clamp", easing: ease });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: VIDEO.safe_bottom_px + 170,
        paddingLeft: VIDEO.safe_side_px,
        paddingRight: VIDEO.safe_side_px,
      }}
    >
      <div
        style={{
          opacity: Math.min(fadeIn, fadeOut),
          transform: `translateY(${y}px)`,
          backgroundColor: "rgba(243, 233, 225, 0.9)",
          color: colors.graphite,
          borderRadius: 28,
          padding: big ? "34px 44px" : "26px 38px",
          fontSize: big ? 84 : 64,
          fontWeight: 600,
          lineHeight: 1.18,
          textAlign: "center",
          maxWidth: 1080 - VIDEO.safe_side_px * 2,
          boxShadow: "0 10px 40px rgba(43,43,43,0.12)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// Логотип sil·icare by Yafho, дисклеймер медизделия — только если продукт в кадре
const EndCard: React.FC<{ reel: Reel; lang: Lang }> = ({ reel, lang }) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [6, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 520,
          opacity: appear,
          transform: `translateY(${(1 - appear) * 16}px)`,
          textAlign: "center",
          color: reel.kind === "animation" ? colors.white : colors.graphite,
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -2 }}>
          sil<span style={{ color: colors.teal }}>·</span>icare
        </div>
        <div style={{ fontSize: 40, fontWeight: 500, opacity: 0.75, marginTop: -6 }}>{brand.endorsement}</div>
      </div>
      {reel.shows_product && reel.disclaimer ? (
        <div
          style={{
            position: "absolute",
            bottom: VIDEO.safe_bottom_px,
            left: VIDEO.safe_side_px,
            right: VIDEO.safe_side_px,
            opacity: appear * 0.85,
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1.3,
            textAlign: "center",
            color: reel.kind === "animation" ? colors.linen : colors.graphite,
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

const mix = (a: string, b: string) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v * 0.82 + y[i] * 0.18)).join(",")})`;
};
