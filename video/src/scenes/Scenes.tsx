import React from "react";
import { AbsoluteFill, interpolate, random } from "remotion";
import { colors, fontFamily } from "../brand";
import type { Lang, Shot } from "../reels";
import {
  Camera,
  Cup,
  Drop,
  H,
  Light,
  Linen,
  Pack,
  phase,
  SCAR,
  Sheet,
  Skin,
  Soap,
  Socks,
  Towel,
  useShotTime,
  W,
  easeOut,
} from "./kit";

// Сцены продукта. Тип сцены задаётся в JSON ролика полем shot.scene,
// подписи на предметах (календарь, карточки) — полями shot.label и shot.sub.
export const SCENES = [
  "pack",
  "pack-open",
  "skin-prep",
  "peel",
  "apply",
  "flex",
  "card",
  "card-fan",
  "drop",
  "wash",
  "dry",
  "store",
  "shelf",
  "edge-lift",
  "stretch",
  "window",
  "calendar",
  "still-life",
  "notebook",
  "strip",
  "blanket",
  "phone",
] as const;
export type SceneName = (typeof SCENES)[number];

type SceneProps = { shot: Shot; lang: Lang; tint: string };

export const Scene: React.FC<SceneProps> = (props) => {
  const C = map[props.shot.scene as SceneName];
  return C ? <C {...props} /> : null;
};

// 1. Упаковка на льне, медленный наезд, контровой свет по краю
const PackScene: React.FC<SceneProps> = ({ lang, tint }) => {
  const { p } = useShotTime();
  return (
    <>
      <Camera push={0.1}>
        <Linen tint={tint} />
        <Pack x={W / 2 - 20} y={820} scale={1.25} lang={lang} rotate={-4} />
        <Sheet id="pk" x={770} y={1170} w={260} h={170} rotate={14} sheen={0.2 + p * 0.6} />
      </Camera>
      <Light />
    </>
  );
};

// Упаковка открывается, пластина выходит наружу
const PackOpen: React.FC<SceneProps> = ({ lang, tint }) => {
  const { p } = useShotTime();
  const open = phase(p, 0.05, 0.55);
  const rise = phase(p, 0.35, 1, easeOut);
  return (
    <>
      <Camera push={0.08}>
        <Linen tint={tint} />
        <Sheet id="po" x={W / 2 + 20} y={720 - rise * 260} w={300} h={420} rotate={-4} sheen={0.3 + p * 0.5} lift={0.3} />
        <Pack x={W / 2} y={940} scale={1.2} lang={lang} open={open} rotate={-2} />
      </Camera>
      <Light />
    </>
  );
};

// 2. Кожа чистая и сухая: мягкая ткань промакивает предплечье
const SkinPrep: React.FC<SceneProps> = () => {
  const { p } = useShotTime();
  const cx = interpolate(p, [0, 0.5, 1], [260, 760, 380]);
  const cy = interpolate(p, [0, 0.5, 1], [640, 820, 980]);
  const shine = phase(p, 0.55, 1);
  return (
    <>
      <Camera push={0.05} slide={-30}>
        <Skin />
        <AbsoluteFill
          style={{
            background: `radial-gradient(40% 25% at ${(cx / W) * 100}% ${(cy / H) * 100}%, rgba(255,255,255,${0.12 * shine}) 0%, rgba(255,255,255,0) 100%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: cx - 260,
            top: cy - 200,
            width: 520,
            height: 400,
            borderRadius: "48% 52% 44% 56%",
            background: "radial-gradient(70% 70% at 40% 35%, #FFFFFF 0%, #F4F1EC 60%, #E6E0D8 100%)",
            boxShadow: "0 30px 60px rgba(70,45,30,0.22)",
            opacity: interpolate(p, [0, 0.08, 0.85, 1], [0, 1, 1, 0]),
            transform: `rotate(${interpolate(p, [0, 1], [-12, 10])}deg)`,
            filter: "blur(1.5px)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 80 + i * 110,
                top: 60,
                width: 30,
                height: 280,
                borderRadius: 20,
                background: "linear-gradient(90deg, rgba(0,0,0,0), rgba(110,90,70,0.10), rgba(0,0,0,0))",
                transform: `rotate(${10 + i * 6}deg)`,
              }}
            />
          ))}
        </div>
      </Camera>
      <Light />
    </>
  );
};

// 3. Защитная плёнка отходит за край, свет проходит сквозь силикон
const Peel: React.FC<SceneProps> = ({ tint }) => {
  const { p } = useShotTime();
  const curl = phase(p, 0.05, 0.45) * 220;
  const away = phase(p, 0.45, 0.95);
  return (
    <>
      <Camera push={0.07}>
        <Linen tint={tint} />
        <Sheet
          id="pe"
          x={W / 2}
          y={820}
          w={420}
          h={720}
          rotate={-8}
          sheen={0.15 + p * 0.7}
          lift={0.15}
          film={1 - away * 0.9}
          filmOffset={{ x: away * 520, y: -away * 420, r: away * 22 }}
          curl={away > 0 ? 0 : curl}
        />
      </Camera>
      <Light />
    </>
  );
};

// 4. Пластина ложится от центра к краям и перекрывает линию на 1 см
const Apply: React.FC<SceneProps> = ({ lang }) => {
  const { p } = useShotTime();
  const land = phase(p, 0.08, 0.5);
  const adhere = phase(p, 0.4, 0.85);
  const guide = interpolate(p, [0, 0.12, 0.45, 0.6], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cx = (SCAR.x1 + SCAR.x2) / 2 + 4;
  const cy = (SCAR.y1 + SCAR.y2) / 2;
  return (
    <>
      <Camera push={0.04} slide={24}>
        <Skin />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <g transform={`rotate(-12 ${cx} ${cy})`} opacity={guide}>
            <rect x={cx - 150} y={cy - 420} width={300} height={840} rx={40} fill="none" stroke={colors.teal} strokeWidth={4} strokeDasharray="18 14" />
            <text x={cx + 170} y={cy - 360} fontFamily={fontFamily} fontWeight={600} fontSize={40} fill={colors.teal}>
              +1 {lang === "ru" ? "см" : "см"}
            </text>
          </g>
        </svg>
        <Sheet
          id="ap"
          x={cx}
          y={cy - (1 - land) * 160}
          w={300 + (1 - land) * 30}
          h={840 + (1 - land) * 60}
          rotate={-12}
          lift={1 - land}
          adhered={adhere}
          sheen={0.2 + p * 0.6}
        />
      </Camera>
      <Light />
    </>
  );
};

// 5. Рука сгибается — пластина держится
const Flex: React.FC<SceneProps> = () => {
  const { t } = useShotTime();
  const bend = (Math.sin(t * 2.2 - Math.PI / 2) + 1) / 2;
  const cx = (SCAR.x1 + SCAR.x2) / 2 + 4;
  const cy = (SCAR.y1 + SCAR.y2) / 2;
  return (
    <>
      <AbsoluteFill style={{ transform: `perspective(1600px) rotateX(${bend * 14}deg) scaleY(${1 - bend * 0.05})` }}>
        <Skin creases={bend} />
        <Sheet id="fl" x={cx} y={cy} w={300} h={840} rotate={-12} adhered={1} sheen={0.35 + bend * 0.3} />
      </AbsoluteFill>
      <Light />
    </>
  );
};

// Карточка «Миф или факт» из плотной бумаги, переворот в замедлении
const Card: React.FC<SceneProps> = ({ shot, lang, tint }) => {
  const { p } = useShotTime();
  const label = shot.label?.[lang];
  const flip = label ? phase(p, 0.2, 0.55) : 0;
  const isFact = !!label && /факт|ҳақиқат/i.test(label);
  const showBack = flip > 0.5;
  const drop = phase(p, 0, 0.15, easeOut);
  return (
    <>
      <Camera push={0.05}>
        <Linen tint={tint} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 260 }}>
          <div
            style={{
              width: 620,
              height: 820,
              borderRadius: 24,
              transform: `perspective(1800px) translateY(${(1 - drop) * -60}px) rotateY(${flip * 180}deg) rotate(-3deg)`,
              background: showBack ? (isFact ? "#E4EFEC" : "#FBF8F4") : "#FBF8F4",
              boxShadow: "0 40px 80px rgba(70,45,30,0.22), 0 4px 10px rgba(70,45,30,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily,
              opacity: drop,
            }}
          >
            <div style={{ transform: showBack ? "scaleX(-1)" : undefined, textAlign: "center" }}>
              {showBack ? (
                <div style={{ fontSize: 132, fontWeight: 700, color: isFact ? colors.teal : colors.graphite, letterSpacing: 4 }}>
                  {label!.toUpperCase()}
                </div>
              ) : (
                <div style={{ fontSize: 260, fontWeight: 600, color: colors.graphite, opacity: 0.18 }}>?</div>
              )}
            </div>
          </div>
        </AbsoluteFill>
      </Camera>
      <Light />
    </>
  );
};

// Карточки веером
const CardFan: React.FC<SceneProps> = ({ tint, lang }) => {
  const { p } = useShotTime();
  const spread = phase(p, 0, 0.5, easeOut);
  const labels = lang === "ru" ? ["МИФ", "МИФ", "ФАКТ", "ФАКТ"] : ["МИФ", "МИФ", "ҲАҚИҚАТ", "ҲАҚИҚАТ"];
  return (
    <>
      <Camera push={0.04}>
        <Linen tint={tint} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 260 }}>
          {labels.map((l, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 380,
                height: 500,
                borderRadius: 20,
                background: i > 1 ? "#E4EFEC" : "#FBF8F4",
                boxShadow: "0 30px 60px rgba(70,45,30,0.2)",
                transform: `rotate(${(i - 1.5) * 14 * spread}deg) translateX(${(i - 1.5) * 120 * spread}px)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily,
                fontWeight: 700,
                fontSize: l.length > 5 ? 52 : 72,
                color: i > 1 ? colors.teal : colors.graphite,
              }}
            >
              {l}
            </div>
          ))}
        </AbsoluteFill>
      </Camera>
      <Light />
    </>
  );
};

// Капли воды стекают по прозрачной поверхности
const DropScene: React.FC<SceneProps> = ({ tint }) => {
  const { p } = useShotTime();
  const drops = [0, 1, 2, 3].map((i) => ({
    x: 360 + i * 120 + random(`dx${i}`) * 40,
    y: interpolate(p, [0, 1], [380 + i * 90, 900 + i * 140 + random(`dy${i}`) * 120]),
    r: 18 + random(`dr${i}`) * 22,
  }));
  return (
    <>
      <Camera push={0.08}>
        <Linen tint={tint} />
        <Sheet id="dr" x={W / 2} y={820} w={640} h={1000} rotate={6} sheen={0.2 + p * 0.6} lift={0.1} />
        {drops.map((d, i) => (
          <Drop key={i} x={d.x} y={d.y} r={d.r} stretch={1.25} />
        ))}
      </Camera>
      <Light />
    </>
  );
};

// Мойка мягким мылом под краном
const Wash: React.FC<SceneProps> = () => {
  const { p, t } = useShotTime();
  const foam = phase(p, 0.1, 0.6);
  return (
    <>
      <Camera push={0.05}>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, #EEF1F0 0%, #DDE4E2 100%)" }} />
        <AbsoluteFill
          style={{
            left: 470,
            width: 110,
            background: "linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.75), rgba(255,255,255,0.2))",
            backgroundSize: "100% 80px",
            maskImage: "linear-gradient(180deg, #000 0%, #000 45%, transparent 60%)",
            WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 45%, transparent 60%)",
            backgroundPositionY: `${t * 400}px`,
          }}
        />
        <Sheet id="wa" x={W / 2} y={900} w={420} h={600} rotate={-6} sheen={0.3 + Math.sin(t * 2) * 0.15} lift={0.2} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {new Array(40).fill(0).map((_, i) => {
            const show = random(`fb${i}`) < foam;
            return show ? (
              <circle
                key={i}
                cx={400 + random(`fx${i}`) * 300 + Math.sin(t + i) * 4}
                cy={760 + random(`fy${i}`) * 260}
                r={8 + random(`fr${i}`) * 22}
                fill="rgba(255,255,255,0.55)"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            ) : null;
          })}
        </svg>
      </Camera>
      <Light />
    </>
  );
};

// Сушка на полотенце клейкой стороной вверх
const Dry: React.FC<SceneProps> = () => {
  const { p } = useShotTime();
  return (
    <>
      <Camera push={0.06}>
        <Towel />
        <Sheet id="dy" x={W / 2} y={840} w={440} h={640} rotate={-10} sheen={0.1 + p * 0.8} />
      </Camera>
      <Light />
    </>
  );
};

// Пластина возвращается на защитную плёнку в упаковку
const Store: React.FC<SceneProps> = ({ lang, tint }) => {
  const { p } = useShotTime();
  const down = phase(p, 0.1, 0.75);
  return (
    <>
      <Camera push={0.05}>
        <Linen tint={tint} />
        <Sheet
          id="st"
          x={W / 2}
          y={520 + down * 300}
          w={360}
          h={480}
          rotate={-4 + down * 4}
          lift={1 - down}
          film={1}
          filmOffset={{ x: 0, y: 0, r: 0 }}
          sheen={0.2 + p * 0.6}
        />
        <Pack x={W / 2 + 120} y={1180} scale={0.75} lang={lang} rotate={6} />
      </Camera>
      <Light />
    </>
  );
};

// Пластырь на полке рядом с мыльницей
const Shelf: React.FC<SceneProps> = () => {
  const { p } = useShotTime();
  return (
    <>
      <Camera push={0.05} slide={-20}>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, #F1EEEA 0%, #E7E2DC 62%, #D8D1C9 62.2%, #E9E4DE 100%)" }} />
        <Soap x={360} y={1120} />
        <Sheet id="sh" x={720} y={1110} w={300} h={170} rotate={-6} sheen={0.2 + p * 0.6} />
      </Camera>
      <Light />
    </>
  );
};

// Пластырь уже не липнет: край загибается
const EdgeLift: React.FC<SceneProps> = () => {
  const { p } = useShotTime();
  const curl = phase(p, 0.1, 0.8) * 200;
  const cx = (SCAR.x1 + SCAR.x2) / 2 + 4;
  const cy = (SCAR.y1 + SCAR.y2) / 2;
  return (
    <>
      <Camera push={0.08}>
        <Skin />
        <Sheet id="el" x={cx} y={cy} w={360} h={840} rotate={-12} adhered={0.7} curl={curl} lift={curl / 200} sheen={0.4} />
      </Camera>
      <Light />
    </>
  );
};

// Два пальца растягивают лист — он возвращается в форму
const Stretch: React.FC<SceneProps> = ({ tint }) => {
  const { p } = useShotTime();
  const s = interpolate(p, [0, 0.35, 0.55, 0.85], [1, 1.32, 1.32, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  return (
    <>
      <Camera push={0.04}>
        <Linen tint={tint} />
        <Sheet id="sr" x={W / 2} y={820} w={420} h={560} scaleX={s} lift={0.3} sheen={0.3 + (s - 1) * 1.2} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {[-1, 1].map((k) => (
            <ellipse key={k} cx={W / 2 + k * 210 * s} cy={820} rx={46} ry={70} fill="#E3B89C" opacity={0.95} />
          ))}
        </svg>
      </Camera>
      <Light />
    </>
  );
};

// Окно на рассвете: свет скользит по бежевой стене
const WindowLight: React.FC<SceneProps> = ({ shot }) => {
  const { p } = useShotTime();
  const evening = shot.mood === "evening";
  const x = interpolate(p, [0, 1], [-120, 160]);
  return (
    <>
      <AbsoluteFill style={{ background: evening ? "#E9DCCF" : "#F1E6DA" }} />
      <AbsoluteFill style={{ transform: `translateX(${x}px) skewX(-14deg)`, filter: "blur(14px)" }}>
        <div
          style={{
            position: "absolute",
            left: 260,
            top: 360,
            width: 520,
            height: 900,
            background: evening ? "rgba(255,196,140,0.55)" : "rgba(255,226,170,0.7)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 26,
          }}
        />
        <div style={{ position: "absolute", left: 506, top: 360, width: 26, height: 900, background: evening ? "#E9DCCF" : "#F1E6DA" }} />
        <div style={{ position: "absolute", left: 260, top: 790, width: 520, height: 26, background: evening ? "#E9DCCF" : "#F1E6DA" }} />
      </AbsoluteFill>
      <Light warm={evening ? 1 : 0.5} />
    </>
  );
};

// Лист календаря без дат, переворачивается в начале кадра
const Calendar: React.FC<SceneProps> = ({ shot, lang }) => {
  const { p } = useShotTime();
  const evening = shot.mood === "evening";
  const accent = !!shot.accent;
  const flip = phase(p, 0, 0.22);
  const label = shot.label?.[lang] ?? "";
  const sub = shot.sub?.[lang] ?? "";
  const showPack = shot.props?.includes("pack");
  return (
    <>
      <Camera push={0.05}>
        <AbsoluteFill style={{ background: evening ? "#E6D6C6" : accent ? "#F4E3C8" : "#F1E6DA" }} />
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 330 }}>
          <div style={{ position: "relative", width: 600, height: 760 }}>
            <Page label={label} sub={sub} accent={accent} />
            {flip < 1 ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transformOrigin: "50% 0%",
                  transform: `perspective(1600px) rotateX(${flip * 170}deg)`,
                  opacity: 1 - flip * 0.6,
                }}
              >
                <Page label="" sub="" accent={false} />
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
        {showPack ? <Pack x={820} y={1180} scale={0.62} lang={lang} rotate={-6} /> : null}
      </Camera>
      <Light warm={evening ? 1 : accent ? 0.8 : 0.3} />
    </>
  );
};

const Page: React.FC<{ label: string; sub: string; accent: boolean }> = ({ label, sub, accent }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: "#FFFDF9",
      borderRadius: 14,
      boxShadow: "0 30px 60px rgba(70,45,30,0.16)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily,
    }}
  >
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 70, background: accent ? colors.teal : colors.graphite, borderRadius: "14px 14px 0 0" }} />
    {[0, 1, 2, 3, 4].map((i) => (
      <div key={i} style={{ position: "absolute", top: -16, left: 90 + i * 100, width: 18, height: 50, borderRadius: 9, background: "#B9B2AA" }} />
    ))}
    <div style={{ fontSize: label.length > 4 ? 170 : 240, fontWeight: 700, color: accent ? colors.teal : colors.graphite, letterSpacing: -4, marginTop: 40 }}>
      {label}
    </div>
    <div style={{ fontSize: 56, fontWeight: 500, color: colors.graphite, opacity: 0.7 }}>{sub}</div>
  </div>
);

// Натюрморт: упаковка, чашка чая, носочки, мыльница — по списку shot.props
const StillLife: React.FC<SceneProps> = ({ shot, lang, tint }) => {
  const { t, p } = useShotTime();
  const props = shot.props ?? ["pack", "cup"];
  return (
    <>
      <Camera push={0.05} slide={-24}>
        <Linen tint={tint} />
        {props.includes("cup") ? <Cup x={props.includes("pack") ? 290 : 420} y={1130} scale={0.95} t={t} /> : null}
        {props.includes("socks") ? <Socks x={props.includes("pack") ? 740 : 620} y={1010} scale={1.05} /> : null}
        {props.includes("pack") ? <Pack x={760} y={1060} scale={0.62} lang={lang} rotate={-5} /> : null}
        {props.includes("sheet") ? <Sheet id="sl" x={560} y={1290} w={300} h={130} rotate={-10} sheen={0.2 + p * 0.6} /> : null}
      </Camera>
      <Light warm={0.4} />
    </>
  );
};

// Блокнот: рука листает, текст размыт
const Notebook: React.FC<SceneProps> = ({ tint }) => {
  const { p } = useShotTime();
  const turn = phase(p, 0.05, 0.35);
  return (
    <>
      <Camera push={0.05}>
        <Linen tint={tint} />
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 340 }}>
          <div style={{ position: "relative", width: 640, height: 860, transform: "rotate(-4deg)" }}>
            <NotePage seed="a" />
            {turn < 1 ? (
              <div style={{ position: "absolute", inset: 0, transformOrigin: "0% 50%", transform: `perspective(1800px) rotateY(${-turn * 160}deg)`, opacity: 1 - turn * 0.5 }}>
                <NotePage seed="b" />
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
      </Camera>
      <Light warm={0.4} />
    </>
  );
};

const NotePage: React.FC<{ seed: string }> = ({ seed }) => (
  <div style={{ position: "absolute", inset: 0, background: "#FFFDF8", borderRadius: 10, boxShadow: "0 30px 60px rgba(70,45,30,0.18)", overflow: "hidden" }}>
    {new Array(14).fill(0).map((_, i) => (
      <div key={i} style={{ position: "absolute", left: 60, right: 60, top: 90 + i * 52, height: 2, background: "rgba(31,111,107,0.15)" }} />
    ))}
    {new Array(11).fill(0).map((_, i) => (
      <div
        key={`w${i}`}
        style={{
          position: "absolute",
          left: 70,
          top: 70 + i * 52,
          width: 200 + random(`${seed}${i}`) * 300,
          height: 14,
          borderRadius: 7,
          background: "rgba(43,43,43,0.35)",
          filter: "blur(5px)",
        }}
      />
    ))}
  </div>
);

// Тонкая полоска телесного цвета на льне
const Strip: React.FC<SceneProps> = ({ tint }) => {
  const { p } = useShotTime();
  return (
    <>
      <Camera push={0.09}>
        <Linen tint={tint} />
        <Sheet id="sp" x={W / 2} y={800} w={190} h={900} rotate={28} sheen={0.1 + p * 0.8} lift={0.15} />
      </Camera>
      <Light warm={0.4} />
    </>
  );
};

// Детское одеяло, мягкие складки
const Blanket: React.FC<SceneProps> = () => {
  const { t } = useShotTime();
  return (
    <>
      <AbsoluteFill style={{ background: colors.powder }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -200,
              right: -200,
              top: 200 + i * 300 + Math.sin(t * 0.8 + i) * 18,
              height: 180,
              borderRadius: "50%",
              background: "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(160,110,100,0.18))",
              filter: "blur(28px)",
              transform: `rotate(${-8 + i * 3}deg)`,
            }}
          />
        ))}
      </AbsoluteFill>
      <Light warm={0.5} />
    </>
  );
};

// Сообщение отправляется, экран не читается
const Phone: React.FC<SceneProps> = ({ tint }) => {
  const { p } = useShotTime();
  const send = phase(p, 0.25, 0.5, easeOut);
  return (
    <>
      <Camera push={0.04}>
        <Linen tint={tint} />
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 620 }}>
          <div style={{ width: 380, height: 760, borderRadius: 60, background: colors.graphite, padding: 18, transform: "rotate(-6deg) scale(0.62)", boxShadow: "0 40px 80px rgba(43,43,43,0.3)" }}>
            <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 44, background: "#F6F2EE", overflow: "hidden" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ position: "absolute", left: 24, top: 80 + i * 110, width: 220, height: 70, borderRadius: 24, background: "#E2DBD3", filter: "blur(4px)" }} />
              ))}
              <div
                style={{
                  position: "absolute",
                  right: 24,
                  top: 420 - send * 60,
                  width: 230,
                  height: 80,
                  borderRadius: 24,
                  background: colors.teal,
                  opacity: send,
                  filter: "blur(3px)",
                }}
              />
            </div>
          </div>
        </AbsoluteFill>
      </Camera>
      <Light warm={0.4} />
    </>
  );
};

const map: Record<SceneName, React.FC<SceneProps>> = {
  pack: PackScene,
  "pack-open": PackOpen,
  "skin-prep": SkinPrep,
  peel: Peel,
  apply: Apply,
  flex: Flex,
  card: Card,
  "card-fan": CardFan,
  drop: DropScene,
  wash: Wash,
  dry: Dry,
  store: Store,
  shelf: Shelf,
  "edge-lift": EdgeLift,
  stretch: Stretch,
  window: WindowLight,
  calendar: Calendar,
  "still-life": StillLife,
  notebook: Notebook,
  strip: Strip,
  blanket: Blanket,
  phone: Phone,
};
