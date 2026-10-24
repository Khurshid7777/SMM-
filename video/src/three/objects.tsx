import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { brand, colors, fontFamily } from "../brand";
import type { Lang } from "../reels";
import { rand, useCanvasTexture } from "./studio";

// Предметы студии. Размеры в сантиметрах, близко к реальным.

// ——— Упаковка (макет до фото реальной коробки Yafho) ———
const PACK = { w: 9, h: 14, d: 2.4 };

const usePackFront = (lang: Lang, size: string) =>
  useCanvasTexture(
    900,
    1400,
    (g) => {
      const W = 900;
      const H = 1400;
      g.fillStyle = "#FBF8F4";
      g.fillRect(0, 0, W, H);
      g.fillStyle = colors.graphite;
      g.font = `700 150px ${fontFamily}`;
      g.textBaseline = "alphabetic";
      const sil = "sil";
      g.fillText(sil, 70, 230);
      const x1 = 70 + g.measureText(sil).width;
      g.fillStyle = colors.teal;
      g.fillText("·", x1, 230);
      g.fillStyle = colors.graphite;
      g.fillText("icare", x1 + g.measureText("·").width, 230);
      g.font = `500 44px ${fontFamily}`;
      g.globalAlpha = 0.7;
      g.fillText(brand.endorsement, 76, 300);
      g.globalAlpha = 1;
      const [l1, l2] = lang === "ru" ? ["Силиконовый пластырь", "для ухода за рубцом"] : ["Силикон пластир", "чандиқ парвариши учун"];
      g.font = `600 60px ${fontFamily}`;
      g.fillText(l1, 70, 440);
      g.font = `500 60px ${fontFamily}`;
      g.globalAlpha = 0.6;
      g.fillText(l2, 70, 515);
      g.globalAlpha = 1;
      // Окошко с пластиной
      g.fillStyle = "#EEF3F1";
      g.beginPath();
      g.roundRect(70, 600, W - 140, 470, 36);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.strokeStyle = "#FFFFFF";
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(180, 660, W - 360, 350, 40);
      g.fill();
      g.stroke();
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.beginPath();
      g.roundRect(180, 660, (W - 360) * 0.4, 350, 40);
      g.fill();
      // Размер — пилюлей, как бейджи DTC-брендов
      g.fillStyle = colors.teal;
      g.beginPath();
      g.roundRect(70, 1140, 300, 92, 46);
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.font = `600 48px ${fontFamily}`;
      g.fillText(size, 108, 1203);
      g.fillStyle = colors.graphite;
      g.globalAlpha = 0.55;
      g.font = `500 36px ${fontFamily}`;
      g.fillText(lang === "ru" ? "Медицинское изделие" : "Тиббий буюм", 70, 1310);
      g.globalAlpha = 1;
      g.fillStyle = colors.teal;
      g.fillRect(0, H - 30, W, 30);
    },
    [lang, size],
    { text: true },
  );

export const Pack3D: React.FC<{
  lang: Lang;
  position?: [number, number, number];
  rotation?: [number, number, number];
  open?: number;
  size?: string;
  scale?: number;
}> = ({ lang, position = [0, 0, 0], rotation = [0, 0, 0], open = 0, size = "4 × 13 см", scale = 1 }) => {
  const front = usePackFront(lang, size);
  const { w, h, d } = PACK;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[w, h, d]} radius={0.25} smoothness={4} position={[0, h / 2, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#F7F2EC" roughness={0.62} clearcoat={0.15} sheen={0.3} sheenColor="#FFFFFF" />
      </RoundedBox>
      <mesh position={[0, h / 2, d / 2 + 0.004]}>
        <planeGeometry args={[w - 0.5, h - 0.5]} />
        <meshPhysicalMaterial map={front} roughness={0.55} clearcoat={0.25} clearcoatRoughness={0.4} />
      </mesh>
      {/* Крышка на петле у задней кромки */}
      <group position={[0, h, -d / 2]} rotation-x={-open * 2.1}>
        <RoundedBox args={[w, 0.18, d]} radius={0.08} position={[0, 0.09, d / 2]} castShadow>
          <meshPhysicalMaterial color="#F3EDE6" roughness={0.6} />
        </RoundedBox>
      </group>
    </group>
  );
};

// ——— Предплечье крупным планом ———
export const ARM_R = 4.3;

const useSkinMaps = () => {
  const map = useCanvasTexture(
    1024,
    1024,
    (g) => {
      g.fillStyle = "#D8A98A";
      g.fillRect(0, 0, 1024, 1024);
      // Неровный тон кожи: тёплые и чуть розовые пятна
      for (let i = 0; i < 140; i++) {
        const x = rand(i + 1) * 1024;
        const y = rand(i + 200) * 1024;
        const r = 40 + rand(i + 400) * 160;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const warm = rand(i + 600) > 0.5;
        gr.addColorStop(0, warm ? "rgba(214,150,120,0.16)" : "rgba(240,200,175,0.18)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        for (const ox of [-1024, 0, 1024])
          for (const oy of [-1024, 0, 1024]) {
            g.save();
            g.translate(ox, oy);
            g.fillRect(x - r, y - r, r * 2, r * 2);
            g.restore();
          }
      }
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = `rgba(150,95,70,${0.05 + rand(i + 900) * 0.07})`;
        g.beginPath();
        g.arc(rand(i + 3000) * 1024, rand(i + 7000) * 1024, 0.8 + rand(i + 11000) * 1.6, 0, Math.PI * 2);
        g.fill();
      }
    },
    [],
  );
  const bump = useCanvasTexture(
    1024,
    1024,
    (g) => {
      g.fillStyle = "#808080";
      g.fillRect(0, 0, 1024, 1024);
      // Поры и тонкий рисунок кожи
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(0,0,0,${0.25 + rand(i + 50) * 0.3})`;
        g.beginPath();
        g.arc(rand(i + 13000) * 1024, rand(i + 17000) * 1024, 0.7 + rand(i + 19000) * 1.4, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = "rgba(0,0,0,0.12)";
      g.lineWidth = 1.2;
      for (let i = 0; i < 700; i++) {
        const x = rand(i + 23000) * 1024;
        const y = rand(i + 29000) * 1024;
        const a = rand(i + 31000) * Math.PI;
        const l = 10 + rand(i + 37000) * 30;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
    },
    [],
    { srgb: false },
  );
  useMemo(() => {
    for (const t of [map, bump]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 4);
    }
  }, [map, bump]);
  return { map, bump };
};

export const Arm3D: React.FC<{
  position?: [number, number, number];
  rotation?: [number, number, number];
  line?: boolean;
  // Поворот руки вокруг своей оси — кожа и пластина двигаются вместе
  roll?: number;
  children?: React.ReactNode;
}> = ({ position = [0, 0, 0], rotation = [0, 0, 0], line = true, roll = 0, children }) => {
  const { map, bump } = useSkinMaps();
  const lineGeo = useMemo(() => {
    const pts = new Array(30).fill(0).map((_, i) => {
      const z = -6 + (i / 29) * 12;
      const a = Math.sin(i * 0.35) * 0.03;
      return new THREE.Vector3(Math.sin(a) * (ARM_R + 0.01), Math.cos(a) * (ARM_R + 0.01), z);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.045, 5, false);
  }, []);
  return (
    <group position={position} rotation={rotation}>
      <group position={[0, ARM_R, 0]} rotation-z={roll}>
        <mesh rotation-x={Math.PI / 2} castShadow receiveShadow>
          <capsuleGeometry args={[ARM_R, 70, 16, 64]} />
          <meshPhysicalMaterial
            map={map}
            bumpMap={bump}
            bumpScale={0.6}
            roughness={0.55}
            sheen={0.25}
            sheenColor="#FFC8A6"
            sheenRoughness={0.6}
            clearcoat={0.08}
            clearcoatRoughness={0.6}
          />
        </mesh>
        {line ? (
          <mesh geometry={lineGeo}>
            <meshStandardMaterial color="#6A5E58" roughness={0.95} transparent opacity={0.75} />
          </mesh>
        ) : null}
        {/* Детей кладём на верх руки: y = 0 — точка касания */}
        <group position={[0, ARM_R, 0]}>{children}</group>
      </group>
    </group>
  );
};

// ——— Чашка чая ———
export const Cup3D: React.FC<{ position?: [number, number, number]; rotation?: [number, number, number] }> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) => {
  const cup = useMemo(() => {
    const p = [
      [0, 0.6],
      [2.6, 0.6],
      [2.8, 0],
      [3.2, 0],
      [3.5, 0.6],
      [4.1, 4.5],
      [4.3, 7.4],
      [4.05, 7.5],
      [3.85, 4.6],
      [3.3, 1.0],
      [0, 1.0],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(p, 96);
  }, []);
  const saucer = useMemo(() => {
    const p = [
      [0, 0.2],
      [5.5, 0.2],
      [7.2, 0.9],
      [7.3, 1.05],
      [5.6, 0.55],
      [0, 0.5],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(p, 96);
  }, []);
  const ceramic = <meshPhysicalMaterial color="#FBFAF7" roughness={0.18} clearcoat={0.9} clearcoatRoughness={0.1} />;
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={saucer} castShadow receiveShadow>
        {ceramic}
      </mesh>
      <group position={[0, 0.5, 0]}>
        <mesh geometry={cup} castShadow receiveShadow>
          {ceramic}
        </mesh>
        <mesh position={[0, 6.4, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[3.95, 64]} />
          <meshPhysicalMaterial color="#8E5530" roughness={0.05} clearcoat={1} />
        </mesh>
        <mesh position={[4.3, 4.2, 0]} rotation-z={-Math.PI / 2}>
          <torusGeometry args={[1.7, 0.42, 16, 48, Math.PI]} />
          {ceramic}
        </mesh>
      </group>
    </group>
  );
};

// ——— Капля воды ———
export const Drop3D: React.FC<{ position: [number, number, number]; r: number; stretch?: number }> = ({ position, r, stretch = 1 }) => (
  <mesh position={position} scale={[r, r * 0.5, r * stretch]} castShadow>
    <sphereGeometry args={[1, 32, 24]} />
    <meshPhysicalMaterial color="#FFFFFF" transmission={1} roughness={0.02} ior={1.33} thickness={r} clearcoat={1} envMapIntensity={1.8} />
  </mesh>
);

// ——— Карточка из плотной бумаги: лицевая и оборотная сторона ———
const useCardFace = (text: string, color: string, bg: string, big: boolean) =>
  useCanvasTexture(
    800,
    1100,
    (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, 800, 1100);
      g.fillStyle = color;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const size = big ? (text.length > 5 ? 130 : 180) : 420;
      g.font = `${big ? 700 : 600} ${size}px ${fontFamily}`;
      g.globalAlpha = big ? 1 : 0.28;
      g.fillText(text, 400, 560);
    },
    [text, color, bg, big],
    { text: true },
  );

export const Card3D: React.FC<{
  front: string;
  back?: string;
  fact?: boolean;
  flip?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}> = ({ front, back = "", fact = false, flip = 0, position = [0, 0, 0], rotation = [0, 0, 0] }) => {
  const w = 8;
  const h = 11;
  const frontTex = useCardFace(front, colors.graphite, "#FBF8F4", front !== "?");
  const backTex = useCardFace(back, fact ? colors.teal : colors.graphite, fact ? "#E3EEEB" : "#FBF8F4", true);
  const lift = Math.sin(flip * Math.PI) * 4;
  return (
    <group position={position} rotation={rotation}>
      <group position={[0, 0.06 + lift, 0]} rotation-z={flip * Math.PI}>
        <RoundedBox args={[w, 0.1, h]} radius={0.04} smoothness={2} castShadow receiveShadow>
          <meshPhysicalMaterial color="#E4DCD1" roughness={0.9} sheen={0.3} />
        </RoundedBox>
        <mesh position={[0, 0.052, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[w - 0.1, h - 0.1]} />
          <meshStandardMaterial map={frontTex} color="#E9E3DA" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.052, 0]} rotation-x={Math.PI / 2} rotation-z={Math.PI}>
          <planeGeometry args={[w - 0.1, h - 0.1]} />
          <meshStandardMaterial map={backTex} color="#E9E3DA" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
};

// ——— Настольный календарь-домик без дат ———
const useCalPage = (label: string, sub: string, accent: boolean) =>
  useCanvasTexture(
    1000,
    1080,
    (g) => {
      g.fillStyle = "#FFFDF9";
      g.fillRect(0, 0, 1000, 1080);
      g.fillStyle = accent ? colors.teal : colors.graphite;
      g.fillRect(0, 0, 1000, 110);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = accent ? colors.teal : colors.graphite;
      g.font = `700 ${label.length > 4 ? 300 : 400}px ${fontFamily}`;
      g.fillText(label, 500, 560);
      g.globalAlpha = 0.65;
      g.font = `500 90px ${fontFamily}`;
      g.fillText(sub, 500, 860);
      g.globalAlpha = 1;
    },
    [label, sub, accent],
    { text: true },
  );

export const Calendar3D: React.FC<{
  label: string;
  sub: string;
  accent?: boolean;
  flip?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}> = ({ label, sub, accent = false, flip = 1, position = [0, 0, 0], rotation = [0, 0, 0] }) => {
  const W = 13;
  const H = 14;
  const lean = 0.32;
  const page = useCalPage(label, sub, accent);
  const blank = useCalPage("", "", false);
  const top = H * Math.cos(lean);
  const paper = <meshPhysicalMaterial color="#F4EEE6" roughness={0.8} />;
  return (
    <group position={position} rotation={rotation}>
      {/* Задняя опора: верх у петли, низ уходит назад */}
      <mesh position={[0, top / 2, -Math.sin(lean) * H * 0.5]} rotation-x={lean} castShadow receiveShadow>
        <boxGeometry args={[W, H, 0.15]} />
        {paper}
      </mesh>
      <group position={[0, top, 0]}>
        {/* Лицевая страница: низ выдвинут вперёд */}
        <group rotation-x={-lean}>
          <mesh position={[0, -H / 2, 0.08]} castShadow receiveShadow>
            <planeGeometry args={[W, H]} />
            <meshStandardMaterial map={page} roughness={0.85} />
          </mesh>
        </group>
        {/* Переворачиваемый лист: с задней стороны через верх вперёд */}
        {flip < 1 ? (
          <group rotation-x={lean + flip * (2 * Math.PI - 2 * lean)}>
            <mesh position={[0, -H / 2, 0]} castShadow>
              <planeGeometry args={[W, H]} />
              <meshStandardMaterial map={blank} roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ) : null}
        {/* Пружина */}
        {new Array(9).fill(0).map((_, i) => (
          <mesh key={i} position={[-W / 2 + 1 + i * ((W - 2) / 8), 0.1, 0]} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.45, 0.08, 8, 20]} />
            <meshStandardMaterial color="#9C948C" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// ——— Махровое полотенце ———
export const Towel3D: React.FC<{ color?: string }> = ({ color = "#FAF7F2" }) => {
  const bump = useCanvasTexture(
    1024,
    1024,
    (g) => {
      g.fillStyle = "#808080";
      g.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 14000; i++) {
        g.strokeStyle = `rgba(${rand(i) > 0.5 ? "255,255,255" : "0,0,0"},0.35)`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(rand(i + 41000) * 1024, rand(i + 43000) * 1024, 2 + rand(i + 47000) * 3, 0, Math.PI * 2);
        g.stroke();
      }
    },
    [],
    { srgb: false },
  );
  useMemo(() => {
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.set(4, 4);
  }, [bump]);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(90, 90, 90, 90);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setZ(i, Math.sin(x * 0.12 + 1) * 0.5 + Math.sin(y * 0.09) * 0.4 + Math.sin((x + y) * 0.2) * 0.2);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[0, -0.3, 0]} receiveShadow>
      <meshPhysicalMaterial color={color} bumpMap={bump} bumpScale={1.2} roughness={1} sheen={1} sheenColor="#FFFFFF" sheenRoughness={0.8} />
    </mesh>
  );
};

// ——— Мыльница с мылом ———
export const SoapDish3D: React.FC<{ position?: [number, number, number] }> = ({ position = [0, 0, 0] }) => {
  const dish = useMemo(() => {
    const p = [
      [0, 0],
      [5, 0],
      [6.4, 0.9],
      [6.5, 1.2],
      [5.2, 0.5],
      [0, 0.4],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(p, 80);
  }, []);
  return (
    <group position={position}>
      <mesh geometry={dish} scale={[1.3, 1, 0.9]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#E6ECEA" roughness={0.2} clearcoat={0.8} />
      </mesh>
      <RoundedBox args={[8, 2.2, 5]} radius={1} smoothness={6} position={[0, 1.6, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#F7F0E6" roughness={0.45} sheen={0.4} clearcoat={0.2} />
      </RoundedBox>
    </group>
  );
};

// ——— Телефон: сообщение отправляется, экран не читается ———
export const Phone3D: React.FC<{ send: number; position?: [number, number, number]; rotation?: [number, number, number] }> = ({
  send,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) => {
  const k = Math.round(send * 20) / 20;
  const screen = useCanvasTexture(
    600,
    1240,
    (g) => {
      g.fillStyle = "#F6F2EE";
      g.fillRect(0, 0, 600, 1240);
      g.filter = "blur(6px)";
      g.fillStyle = "#E2DBD3";
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.roundRect(40, 160 + i * 180, 340, 110, 40);
        g.fill();
      }
      g.fillStyle = colors.teal;
      g.globalAlpha = k;
      g.beginPath();
      g.roundRect(220, 760 - k * 90, 340, 120, 40);
      g.fill();
      g.globalAlpha = 1;
      g.filter = "none";
    },
    [k],
  );
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[7.4, 0.8, 15.2]} radius={0.38} smoothness={4} position={[0, 0.4, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color={colors.graphite} roughness={0.25} metalness={0.4} clearcoat={1} />
      </RoundedBox>
      <mesh position={[0, 0.81, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[6.8, 14.4]} />
        <meshPhysicalMaterial map={screen} roughness={0.1} clearcoat={1} />
      </mesh>
    </group>
  );
};

// ——— Блокнот: размытый текст ———
const useNotePage = (seed: number) =>
  useCanvasTexture(
    800,
    1100,
    (g) => {
      g.fillStyle = "#FFFDF8";
      g.fillRect(0, 0, 800, 1100);
      g.strokeStyle = "rgba(31,111,107,0.18)";
      g.lineWidth = 3;
      for (let i = 0; i < 16; i++) {
        g.beginPath();
        g.moveTo(60, 120 + i * 60);
        g.lineTo(740, 120 + i * 60);
        g.stroke();
      }
      g.filter = "blur(7px)";
      g.fillStyle = "rgba(43,43,43,0.4)";
      for (let i = 0; i < 13; i++) {
        g.beginPath();
        g.roundRect(70, 92 + i * 60, 200 + rand(seed + i) * 380, 16, 8);
        g.fill();
      }
      g.filter = "none";
    },
    [seed],
  );

export const Notebook3D: React.FC<{ turn: number; position?: [number, number, number]; rotation?: [number, number, number] }> = ({
  turn,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) => {
  const a = useNotePage(1);
  const b = useNotePage(50);
  const W = 11;
  const H = 15;
  const paper = (map: THREE.Texture) => <meshStandardMaterial map={map} roughness={0.9} side={THREE.DoubleSide} />;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[-W / 2, 0.3, 0]} rotation-x={-Math.PI / 2} rotation-y={0.06} receiveShadow castShadow>
        <planeGeometry args={[W, H]} />
        {paper(a)}
      </mesh>
      <mesh position={[W / 2, 0.3, 0]} rotation-x={-Math.PI / 2} rotation-y={-0.06} receiveShadow castShadow>
        <planeGeometry args={[W, H]} />
        {paper(b)}
      </mesh>
      <group position={[0, 0.35, 0]} rotation-z={turn * Math.PI}>
        <mesh position={[W / 2, 0, 0]} rotation-x={-Math.PI / 2} castShadow>
          <planeGeometry args={[W, H]} />
          {paper(b)}
        </mesh>
      </group>
      <RoundedBox args={[W * 2 + 0.6, 0.5, H + 0.6]} radius={0.2} position={[0, 0, 0]} receiveShadow castShadow>
        <meshPhysicalMaterial color={colors.teal} roughness={0.7} />
      </RoundedBox>
    </group>
  );
};

// ——— Ткань: одеяло, салфетка ———
export const Fabric3D: React.FC<{
  w: number;
  h: number;
  color: string;
  sheenColor?: string;
  t?: number;
  folds?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}> = ({ w, h, color, sheenColor = "#FFFFFF", t = 0, folds = 1, position = [0, 0, 0], rotation = [0, 0, 0] }) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h, 80, 80);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z =
        (Math.sin(x * 0.25 + y * 0.08 + t * 0.6) * 1.1 + Math.sin(y * 0.33 - t * 0.4) * 0.6 + Math.sin((x - y) * 0.5) * 0.25) * folds;
      p.setZ(i, z);
    }
    g.computeVertexNormals();
    return g;
  }, [w, h, Math.round(t * 24), folds]);
  return (
    <mesh geometry={geo} position={position} rotation={rotation} castShadow receiveShadow>
      <meshPhysicalMaterial color={color} roughness={0.95} sheen={0.8} sheenColor={sheenColor} sheenRoughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
};

// ——— Детские носочки ———
export const Socks3D: React.FC<{ position?: [number, number, number]; rotation?: [number, number, number] }> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) => {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(3.2, 0);
    s.lineTo(3.2, 5.2);
    s.quadraticCurveTo(3.2, 7.3, 5.4, 7.4);
    s.quadraticCurveTo(6.9, 7.5, 6.9, 8.7);
    s.quadraticCurveTo(6.9, 10, 5.1, 10);
    s.lineTo(1.9, 10);
    s.quadraticCurveTo(0, 10, 0, 7.8);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 6, curveSegments: 24 });
  }, []);
  return (
    <group position={position} rotation={rotation}>
      {[0, 1].map((i) => (
        <group key={i} position={[i * 4.8, 0.5, i * 0.8]} rotation-y={-(i * 0.14 - 0.08)}>
          <mesh geometry={geo} rotation-x={-Math.PI / 2} castShadow receiveShadow>
            <meshPhysicalMaterial color="#D2A194" roughness={1} sheen={0.6} sheenColor="#EBCFC6" />
          </mesh>
          {/* Резинка */}
          {new Array(5).fill(0).map((_, k) => (
            <mesh key={k} position={[0.35 + k * 0.62, 0.42, -0.8]} castShadow>
              <boxGeometry args={[0.3, 0.12, 1.6]} />
              <meshPhysicalMaterial color="#DDB5AA" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

// ——— Ватный диск: промакивает кожу ———
export const CottonPad3D: React.FC<{ position?: [number, number, number]; rotation?: [number, number, number]; press?: number }> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  press = 0,
}) => {
  const geo = useMemo(() => {
    const p: THREE.Vector2[] = [];
    const R = 2.9;
    const H = 0.55;
    p.push(new THREE.Vector2(0, 0));
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI;
      p.push(new THREE.Vector2(R - H / 2 + Math.cos(a) * (H / 2), H / 2 + Math.sin(a) * (H / 2)));
    }
    p.push(new THREE.Vector2(0, H));
    return new THREE.LatheGeometry(p, 64);
  }, []);
  const bump = useCanvasTexture(
    512,
    512,
    (g) => {
      g.fillStyle = "#808080";
      g.fillRect(0, 0, 512, 512);
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.lineWidth = 1.5;
      for (let i = 0; i < 2500; i++) {
        const x = rand(i + 60000) * 512;
        const y = rand(i + 61000) * 512;
        const a = rand(i + 62000) * Math.PI * 2;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * 8, y + Math.sin(a + 1) * 8, x + Math.cos(a) * 16, y + Math.sin(a) * 16);
        g.stroke();
      }
    },
    [],
    { srgb: false },
  );
  return (
    <mesh geometry={geo} position={position} rotation={rotation} scale={[1 + press * 0.04, 1 - press * 0.35, 1 + press * 0.04]} castShadow>
      <meshPhysicalMaterial color="#F7F5F1" roughness={1} bumpMap={bump} bumpScale={0.8} sheen={1} sheenColor="#FFFFFF" sheenRoughness={0.9} />
    </mesh>
  );
};
