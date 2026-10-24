import React, { useMemo } from "react";
import * as THREE from "three";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Lang, Shot } from "../reels";
import { CameraSpec, rand, Studio, useCanvasTexture } from "./studio";
import { Liner3D, Sheet3D } from "./sheet";
import {
  Arm3D,
  ARM_R,
  Calendar3D,
  Card3D,
  CottonPad3D,
  Cup3D,
  Drop3D,
  Fabric3D,
  Notebook3D,
  Pack3D,
  Phone3D,
  SoapDish3D,
  Socks3D,
  Towel3D,
} from "./objects";

// 3D-сцены продукта. Тип сцены — shot.scene в JSON ролика.
// Свет и фон — предметная студия (studio.tsx), камера плавно едет внутри кадра.

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

type P = { shot: Shot; lang: Lang; bg: string };

const ease = Easing.bezier(0.45, 0, 0.2, 1);
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

const useProgress = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return { p: frame / Math.max(1, durationInFrames - 1), t: frame / fps };
};

const phase = (p: number, a: number, b: number, e = ease) =>
  interpolate(p, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

type V3 = [number, number, number];
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// Плавная проводка камеры от a к b за кадр
const dolly = (p: number, a: CameraSpec, b: Partial<CameraSpec>): CameraSpec => {
  const k = phase(p, 0, 1, Easing.bezier(0.33, 0, 0.67, 1));
  return {
    position: lerp3(a.position, b.position ?? a.position, k),
    target: lerp3(a.target, b.target ?? a.target, k),
    fov: a.fov,
    shiftY: a.shiftY ?? 0.12,
  };
};

export const Scene3D: React.FC<P> = (props) => {
  const C = map[props.shot.scene as SceneName];
  return C ? <C {...props} /> : null;
};

// ——— Упаковка: герой-кадр ———
const Pack: React.FC<P> = ({ lang, bg }) => {
  const { p } = useProgress();
  return (
    <Studio bg={bg} camera={dolly(p, { position: [-6, 15, 66], target: [0, 7, 0] }, { position: [2, 13, 56] })}>
      <Pack3D lang={lang} position={[-1.5, 0, -2]} rotation={[0, 0.42 - p * 0.12, 0]} />
      <group position={[5.5, 0, 7]} rotation={[0, -0.55, 0]}>
        <Liner3D w={4} h={13} position={[0, 0.05, 0]} />
        <Sheet3D w={4} h={13} position={[0, 0.16, 0]} />
      </group>
    </Studio>
  );
};

const PackOpen: React.FC<P> = ({ lang, bg }) => {
  const { p } = useProgress();
  const open = phase(p, 0.05, 0.5);
  const rise = phase(p, 0.35, 1, easeOut);
  return (
    <Studio bg={bg} camera={dolly(p, { position: [4, 22, 70], target: [0, 11, 0] }, { position: [0, 20, 64] })}>
      <Pack3D lang={lang} rotation={[0, 0.25, 0]} open={open} />
      <group position={[0, 8 + rise * 10, -0.4]} rotation={[Math.PI / 2, 0.25, 0]} scale={rise > 0 ? 1 : 0}>
        <Sheet3D w={4} h={13} deform={{ wave: 0.15, waveT: p * 4 }} />
      </group>
    </Studio>
  );
};

// ——— Рука: камера-макро сверху-сбоку ———
const armCam = (p: number, push = 4): CameraSpec =>
  dolly(p, { position: [14, 50, 44], target: [0, ARM_R * 2 - 1, 0], fov: 24, shiftY: 0.14 }, { position: [12, 50 - push, 44 - push] });

const SkinPrep: React.FC<P> = ({ bg }) => {
  const { p, t } = useProgress();
  // Диск промакивает кожу вдоль линии: опустился — прижал — поднялся — сдвинулся
  const z = interpolate(p, [0, 1], [-5, 5]);
  const dab = Math.max(0, Math.sin(t * 5));
  const enter = phase(p, 0, 0.12, easeOut);
  const exit = phase(p, 0.88, 1);
  const lift = 0.15 + (1 - dab) * 1.4 + (1 - enter) * 8 + exit * 8;
  return (
    <Studio bg={bg} camera={armCam(p)}>
      <Arm3D rotation={[0, -0.55, 0]}>
        <CottonPad3D position={[0.2, lift, z]} rotation={[0.08, 0, 0.05]} press={dab} />
      </Arm3D>
    </Studio>
  );
};

const Apply: React.FC<P> = ({ bg }) => {
  const { p } = useProgress();
  const land = phase(p, 0.12, 0.8);
  return (
    <Studio bg={bg} camera={armCam(p, 3)}>
      <Arm3D rotation={[0, -0.55, 0]}>
        <Sheet3D w={6} h={15} onSkin deform={{ wrapR: ARM_R, land, lift: 4 * (1 - phase(p, 0, 0.45)) }} adhered={phase(p, 0.6, 1)} />
      </Arm3D>
    </Studio>
  );
};

const Flex: React.FC<P> = ({ bg }) => {
  const { t, p } = useProgress();
  const roll = Math.sin(t * 1.8) * 0.35;
  return (
    <Studio bg={bg} camera={armCam(p, 2)}>
      <Arm3D rotation={[0, -0.55, 0]} roll={roll}>
        <Sheet3D w={6} h={15} onSkin deform={{ wrapR: ARM_R, land: 1 }} adhered={1} />
      </Arm3D>
    </Studio>
  );
};

const EdgeLift: React.FC<P> = ({ bg }) => {
  const { p } = useProgress();
  const curl = phase(p, 0.1, 0.8) * 3.2;
  return (
    <Studio bg={bg} camera={armCam(p, 5)}>
      <Arm3D rotation={[0, -0.55, 0]}>
        <Sheet3D w={6} h={15} onSkin deform={{ wrapR: ARM_R, land: 1, curl, curlDir: [0.45, -0.9], curlR: 0.9 }} adhered={0.8} />
      </Arm3D>
    </Studio>
  );
};

// ——— Снятие плёнки: вид сверху ———
const Peel: React.FC<P> = ({ bg }) => {
  const { p } = useProgress();
  const curl = phase(p, 0.05, 0.75) * 9;
  const away = phase(p, 0.7, 1);
  return (
    <Studio bg={bg} camera={dolly(p, { position: [0, 44, 26], target: [0, 0, 1], fov: 24, shiftY: 0.1 }, { position: [2, 40, 22] })}>
      <group rotation={[0, -0.4, 0]}>
        <Sheet3D w={6} h={13} position={[0, 0.06, 0]} />
        <Liner3D
          w={6}
          h={13}
          position={[away * 8, 0.2 + away * 6, -away * 4]}
          rotation={[0, 0, away * 0.4]}
          deform={{ curl, curlDir: [0.55, -0.85], curlR: 1.1 }}
          opacity={1 - away * 0.4}
        />
      </group>
    </Studio>
  );
};

// ——— Карточки «Миф или факт» ———
const Card: React.FC<P> = ({ shot, lang, bg }) => {
  const { p } = useProgress();
  const label = shot.label?.[lang] ?? "";
  const flip = label ? phase(p, 0.18, 0.55) : 0;
  const fact = /факт|ҳақиқат/i.test(label);
  const drop = phase(p, 0, 0.15, easeOut);
  return (
    <Studio bg={bg} camera={dolly(p, { position: [0, 40, 24], target: [0, 0, 0], fov: 26, shiftY: 0.1 }, { position: [0, 36, 21] })}>
      <Card3D front="?" back={label.toUpperCase()} fact={fact} flip={flip} position={[0, (1 - drop) * 3, 0]} rotation={[0, 0.08, 0]} />
    </Studio>
  );
};

const CardFan: React.FC<P> = ({ lang, bg }) => {
  const { p } = useProgress();
  const labels = lang === "ru" ? ["МИФ", "МИФ", "ФАКТ", "ФАКТ"] : ["МИФ", "МИФ", "ҲАҚИҚАТ", "ҲАҚИҚАТ"];
  return (
    <Studio bg={bg} camera={{ position: [0, 84, 32], target: [0, 0, 1], fov: 26, shiftY: 0.07 }}>
      {labels.map((l, i) => {
        const k = phase(p, i * 0.08, 0.25 + i * 0.08, easeOut);
        const x = (i % 2 === 0 ? -1 : 1) * 4.6;
        const z = (i < 2 ? -1 : 1) * 6.2;
        return (
          <group key={i} position={[x, (1 - k) * 4, z]} rotation={[0, (i % 2 ? -1 : 1) * 0.06, 0]} scale={k > 0 ? 1 : 0}>
            <Card3D front="?" back={l} fact={i > 1} flip={1} />
          </group>
        );
      })}
    </Studio>
  );
};

// ——— Вода, уход, хранение ———
const Drop: React.FC<P> = ({ bg }) => {
  const { p } = useProgress();
  const drops = [0, 1, 2, 3].map((i) => ({
    x: -1.6 + i * 1.1 + rand(i + 3) * 0.3,
    z: interpolate(p, [0, 1], [-5 + i * 0.8, 1 + i * 1.3 + rand(i + 9)]),
    r: 0.35 + rand(i + 5) * 0.3,
  }));
  return (
    <Studio bg={bg} camera={dolly(p, { position: [0, 22, 38], target: [0, 0, 0], fov: 24, shiftY: 0.12 }, { position: [3, 20, 33] })}>
      <group rotation={[0, -0.35, 0]}>
        <Liner3D w={6} h={13} position={[0, 0.04, 0]} />
        <Sheet3D w={6} h={13} position={[0, 0.14, 0]} />
        {drops.map((d, i) => (
          <Drop3D key={i} position={[d.x, 0.2 + d.r * 0.25, d.z]} r={d.r} stretch={1.3} />
        ))}
      </group>
    </Studio>
  );
};

const Wash: React.FC<P> = ({ bg }) => {
  const { p, t } = useProgress();
  const foam = phase(p, 0.1, 0.6);
  return (
    <Studio bg={bg} camera={dolly(p, { position: [0, 24, 34], target: [0, 4, 0], fov: 26, shiftY: 0.1 }, { position: [2, 22, 30] })}>
      <group rotation={[0, -0.3, 0]}>
        <Sheet3D w={6} h={13} position={[0, 0.1, 0]} deform={{ wave: 0.25, waveT: t * 3 }} />
        <WaterStream t={t} />
        {new Array(36).fill(0).map((_, i) =>
          rand(i + 70) < foam ? (
            <mesh key={i} position={[(rand(i + 80) - 0.5) * 4, 0.3 + rand(i + 90) * 0.4, (rand(i + 100) - 0.5) * 6]} scale={0.18 + rand(i + 110) * 0.35}>
              <sphereGeometry args={[1, 16, 12]} />
              <meshPhysicalMaterial color="#FFFFFF" transmission={0.5} roughness={0.15} clearcoat={1} transparent opacity={0.9} />
            </mesh>
          ) : null,
        )}
      </group>
    </Studio>
  );
};

const WaterStream: React.FC<{ t: number }> = ({ t }) => {
  const stream = useCanvasTexture(
    64,
    512,
    (g) => {
      const grad = g.createLinearGradient(0, 0, 64, 0);
      grad.addColorStop(0, "rgba(255,255,255,0.1)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.85)");
      grad.addColorStop(1, "rgba(255,255,255,0.1)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 512);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = "rgba(255,255,255,0.6)";
        g.fillRect(rand(i) * 64, rand(i + 50) * 512, 4, 30);
      }
    },
    [],
  );
  useMemo(() => {
    stream.wrapT = THREE.RepeatWrapping;
    stream.repeat.set(1, 2);
  }, [stream]);
  stream.offset.y = t * 3;
  return (
    <mesh position={[0, 14, 0]}>
      <cylinderGeometry args={[0.35, 0.45, 28, 24, 1, true]} />
      <meshPhysicalMaterial map={stream} transparent opacity={0.85} transmission={0.6} roughness={0.05} depthWrite={false} />
    </mesh>
  );
};

const Dry: React.FC<P> = () => {
  const { p } = useProgress();
  const a = interpolate(p, [0, 1], [-0.2, 0.15]);
  return (
    <Studio bg="#F6F3EE" contact={false} shadowOpacity={0.3} camera={{ position: [Math.sin(a) * 30, 34, Math.cos(a) * 30], target: [0, 0, 0], fov: 26, shiftY: 0.1 }}>
      <Towel3D />
      <Sheet3D w={6} h={13} position={[0, 0.9, 0]} rotation={[0, -0.4, 0]} deform={{ wave: 0.12 }} />
    </Studio>
  );
};

const Store: React.FC<P> = ({ lang, bg }) => {
  const { p } = useProgress();
  const down = phase(p, 0.1, 0.75);
  return (
    <Studio bg={bg} camera={dolly(p, { position: [0, 34, 58], target: [0, 3, 0], fov: 26, shiftY: 0.12 }, { position: [-2, 32, 53] })}>
      <Pack3D lang={lang} position={[3.5, 0, -11]} rotation={[0, -0.3, 0]} scale={0.85} />
      <group rotation={[0, 0.3, 0]} position={[-2, 0, 2]}>
        <Liner3D w={6} h={13} position={[0, 0.05, 0]} />
        <Sheet3D w={6} h={13} position={[0, 0.16 + (1 - down) * 6, 0]} rotation={[(1 - down) * 0.3, 0, 0]} />
      </group>
    </Studio>
  );
};

const Shelf: React.FC<P> = ({ bg }) => {
  const { p } = useProgress();
  return (
    <Studio bg={bg} camera={dolly(p, { position: [-4, 18, 40], target: [1, 1, 0], fov: 26, shiftY: 0.12 }, { position: [3, 17, 36] })}>
      <SoapDish3D position={[-5, 0, 0]} />
      <group position={[6, 0, 2]} rotation={[0, -0.6, 0]}>
        <Sheet3D w={5} h={11} position={[0, 0.06, 0]} />
      </group>
    </Studio>
  );
};

const Stretch: React.FC<P> = ({ bg }) => {
  const { p, t } = useProgress();
  const s = interpolate(p, [0, 0.35, 0.55, 0.85], [1, 1.3, 1.3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  return (
    <Studio bg={bg} camera={{ position: [0, 30, 44], target: [0, 2, 0], fov: 26, shiftY: 0.12 }}>
      <Sheet3D w={7} h={9} position={[0, 2.5, 0]} rotation={[0.5, 0, 0]} deform={{ stretch: s, wave: 0.2 * (s - 1) * 3, waveT: t * 2 }} />
    </Studio>
  );
};

// ——— Свет из окна скользит по стене и полу ———
const WindowLight: React.FC<P> = ({ shot, bg }) => {
  const { p } = useProgress();
  const evening = shot.mood === "evening";
  return (
    <Studio bg={bg} contact={false} warm={evening ? 1 : 0.5} camera={{ position: [0, 14, 60], target: [0, 12, 0], fov: 30, shiftY: 0.05 }}>
      <mesh position={[0, 50, -12]}>
        <planeGeometry args={[200, 100]} />
        <meshBasicMaterial color={bg} toneMapped={false} />
      </mesh>
      <WindowPatch x={interpolate(p, [0, 1], [-14, 6])} evening={evening} />
    </Studio>
  );
};

// Пятно света из окна с тенью рамы: аддитивный слой на стене
const WindowPatch: React.FC<{ x: number; evening: boolean }> = ({ x, evening }) => {
  const gobo = useCanvasTexture(
    512,
    768,
    (g) => {
      g.clearRect(0, 0, 512, 768);
      g.filter = "blur(14px)";
      g.fillStyle = "#fff";
      for (const [gx, gy] of [
        [60, 60],
        [270, 60],
        [60, 400],
        [270, 400],
      ])
        g.fillRect(gx, gy, 182, 310);
      g.filter = "none";
    },
    [],
  );
  return (
    <mesh position={[x, 22, -11.9]} rotation-z={0.12}>
      <planeGeometry args={[26, 39]} />
      <meshBasicMaterial
        map={gobo}
        color={evening ? "#FFB070" : "#FFD9A0"}
        transparent
        opacity={evening ? 0.45 : 0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};

// ——— Календарь ———
const Calendar: React.FC<P> = ({ shot, lang, bg }) => {
  const { p } = useProgress();
  const flip = phase(p, 0, 0.3);
  const evening = shot.mood === "evening";
  return (
    <Studio
      bg={bg}
      warm={evening ? 1 : shot.accent ? 0.6 : 0}
      camera={evening ? dolly(p, { position: [-2, 18, 96], target: [0, 7, 0], fov: 26, shiftY: 0.05 }, { position: [2, 17, 90] }) : dolly(p, { position: [-4, 18, 70], target: [0, 7, 0], fov: 26, shiftY: 0.12 }, { position: [2, 17, 63] })}
    >
      <Calendar3D label={shot.label?.[lang] ?? ""} sub={shot.sub?.[lang] ?? ""} accent={!!shot.accent} flip={flip} rotation={[0, 0.18, 0]} />
      {shot.props?.includes("pack") ? <Pack3D lang={lang} position={[11, 0, 3]} rotation={[0, -0.45, 0]} scale={0.8} /> : null}
    </Studio>
  );
};

// ——— Натюрморт ———
const StillLife: React.FC<P> = ({ shot, lang, bg }) => {
  const { p } = useProgress();
  const props = shot.props ?? ["pack", "cup"];
  const hasPack = props.includes("pack");
  const high = props.includes("socks");
  const cam: CameraSpec = high
    ? { position: [-4, 70, 44], target: [0, 2, 0], fov: 26, shiftY: 0.14 }
    : { position: [-8, 24, 84], target: [0, 6, 0], fov: 26, shiftY: 0.17 };
  return (
    <Studio bg={bg} camera={dolly(p, cam, { position: [cam.position[0] + 8, cam.position[1] - 2, cam.position[2] - 6] })}>
      {hasPack ? <Pack3D lang={lang} position={[3, 0, -3]} rotation={[0, -0.35, 0]} /> : null}
      {props.includes("cup") ? <Cup3D position={hasPack ? [-9, 0, 0] : [-2, 0, -5]} rotation={[0, 0.8, 0]} /> : null}
      {props.includes("socks") ? <Socks3D position={hasPack ? [8, 0, 6] : [-6, 0, 5]} rotation={[0, -0.25, 0]} /> : null}
      {props.includes("sheet") ? (
        <group position={[-5, 0, 8]} rotation={[0, 0.5, 0]}>
          <Sheet3D w={4} h={9} position={[0, 0.06, 0]} />
        </group>
      ) : null}
    </Studio>
  );
};

const Notebook: React.FC<P> = ({ bg }) => {
  const { p } = useProgress();
  return (
    <Studio bg={bg} camera={dolly(p, { position: [0, 66, 36], target: [0, 0, 1], fov: 26, shiftY: 0.12 }, { position: [2, 61, 33] })}>
      <Notebook3D turn={phase(p, 0.05, 0.4)} rotation={[0, -0.12, 0]} position={[0, 0.25, 0]} />
    </Studio>
  );
};

const Strip: React.FC<P> = ({ bg }) => {
  const { p } = useProgress();
  return (
    <Studio bg={bg} camera={dolly(p, { position: [-6, 20, 30], target: [0, 0, 0], fov: 24, shiftY: 0.1 }, { position: [4, 18, 26] })}>
      <group rotation={[0, 0.7, 0]}>
        <Liner3D w={5} h={15} position={[0, 0.05, 0]} />
        <Sheet3D w={5} h={15} position={[0, 0.15, 0]} />
      </group>
    </Studio>
  );
};

const Blanket: React.FC<P> = ({ bg }) => {
  const { p, t } = useProgress();
  return (
    <Studio bg={bg} contact={false} camera={dolly(p, { position: [-4, 30, 56], target: [0, 2, -4], fov: 26, shiftY: 0.1 }, { position: [2, 28, 50] })}>
      <Fabric3D w={60} h={60} color="#D3A89D" sheenColor="#EBD0C8" t={t} folds={1.6} rotation={[-Math.PI / 2, 0, 0.5]} position={[6, 1.5, -8]} />
    </Studio>
  );
};

const Phone: React.FC<P> = ({ bg }) => {
  const { p } = useProgress();
  return (
    <Studio bg={bg} camera={dolly(p, { position: [0, 56, 42], target: [0, 0, 2], fov: 26, shiftY: 0.17 }, { position: [2, 53, 39] })}>
      <Phone3D send={phase(p, 0.25, 0.5, easeOut)} rotation={[0, -0.25, 0]} position={[2, 0, 2]} />
      <Cup3D position={[-11, 0, -6]} />
    </Studio>
  );
};

const map: Record<SceneName, React.FC<P>> = {
  pack: Pack,
  "pack-open": PackOpen,
  "skin-prep": SkinPrep,
  peel: Peel,
  apply: Apply,
  flex: Flex,
  card: Card,
  "card-fan": CardFan,
  drop: Drop,
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
