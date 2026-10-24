import React, { useMemo } from "react";
import * as THREE from "three";
import { useCanvasTexture } from "./studio";

// Силиконовая пластина Yafho: тонкая, прозрачная, со скруглёнными углами.
// Геометрия — сетка, которую каждый кадр деформируем: обхват руки, загиб угла, растяжение.

export type Deform = {
  // Обхват цилиндра (руки) радиусом R; land 0..1 — пластина ложится от центра к краям
  wrapR?: number;
  land?: number;
  // Подъём над поверхностью, см
  lift?: number;
  // Загиб угла: направление к углу и сколько сантиметров загнуто
  curl?: number;
  curlDir?: [number, number];
  curlR?: number;
  // Растяжение по ширине
  stretch?: number;
  // Лёгкая волна, «живой» материал
  wave?: number;
  waveT?: number;
};

const deformPoint = (x: number, z: number, w: number, h: number, d: Deform) => {
  const sx = d.stretch ?? 1;
  let X = x * sx;
  let Z = z;
  let Y = 0;

  // Загиб угла: точки за линией сгиба наматываются на цилиндр радиуса curlR
  const curl = d.curl ?? 0;
  if (curl > 0) {
    const [dx, dz] = d.curlDir ?? [0.6, -0.8];
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const smax = Math.abs(ux) * (w * sx) / 2 + Math.abs(uz) * h / 2;
    const s0 = smax - curl;
    const s = X * ux + Z * uz;
    if (s > s0) {
      const r = d.curlR ?? 1.2;
      const dist = s - s0;
      const phi = dist / r;
      let along: number;
      let up: number;
      if (phi < Math.PI) {
        along = s0 + r * Math.sin(phi);
        up = r * (1 - Math.cos(phi));
      } else {
        along = s0 - (dist - Math.PI * r);
        up = 2 * r;
      }
      X += (along - s) * ux;
      Z += (along - s) * uz;
      Y += up;
    }
  }

  if (d.wave) Y += Math.sin(X * 0.5 + (d.waveT ?? 0)) * Math.cos(Z * 0.35) * d.wave;

  // Обхват руки: центр касается первым, края — позже
  const R = d.wrapR ?? 0;
  const land = d.land ?? 1;
  const lift = d.lift ?? 0;
  if (R > 0) {
    const half = (w * sx) / 2;
    const a = THREE.MathUtils.clamp(land * 1.7 - (Math.abs(X) / half) * 0.7, 0, 1);
    const a2 = a * a * (3 - 2 * a);
    const theta = X / R;
    const wx = (R + Y) * Math.sin(theta);
    const wy = (R + Y) * Math.cos(theta) - R;
    const fx = X;
    const fy = Y + lift * (1 - a2) + (1 - a2) * 0.0;
    return [fx + (wx - fx) * a2, fy + (wy - fy) * a2, Z] as const;
  }
  return [X, Y + lift, Z] as const;
};

const roundedOutline = (w: number, h: number, r: number, n = 24) => {
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [w / 2 - r, -h / 2 + r, -Math.PI / 2],
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
  }
  return pts;
};

const useGrid = (w: number, h: number, d: Deform, nx: number, nz: number) =>
  useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h, nx, nz);
    // Плоскость XY → лёжа в XZ
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = -pos.getY(i);
      const [X, Y, Z] = deformPoint(x, z, w, h, d);
      pos.setXYZ(i, X, Y, Z);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [w, h, nx, nz, JSON.stringify(d)]);

// Маска скруглённых углов
const useCornerMask = (w: number, h: number, r: number) =>
  useCanvasTexture(
    256,
    Math.round((256 * h) / w),
    (g) => {
      const W = g.canvas.width;
      const H = g.canvas.height;
      const rr = (r / w) * W;
      g.fillStyle = "#000";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#fff";
      g.beginPath();
      g.roundRect(1, 1, W - 2, H - 2, rr);
      g.fill();
    },
    [w, h, r],
    { srgb: false },
  );

type SheetProps = {
  w: number;
  h: number;
  deform?: Deform;
  position?: [number, number, number];
  rotation?: [number, number, number];
  // Доля прилегания к коже: прилипший силикон почти невидим, виден только блик
  adhered?: number;
  // Пластина на коже (иначе — на фоне студии)
  onSkin?: boolean;
};

export const Sheet3D: React.FC<SheetProps> = ({ w, h, deform = {}, position = [0, 0, 0], rotation = [0, 0, 0], adhered = 0, onSkin = false }) => {
  const r = Math.min(w, h) * 0.14;
  const geo = useGrid(w, h, deform, 40, Math.round(40 * (h / w)));
  const mask = useCornerMask(w, h, r);
  const rim = useMemo(() => {
    const pts = roundedOutline(w, h, r).map(([x, z]) => {
      const [X, Y, Z] = deformPoint(x, z, w, h, deform);
      return new THREE.Vector3(X, Y + 0.02, Z);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 320, 0.045, 6, true);
  }, [w, h, r, JSON.stringify(deform)]);

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo} castShadow={!onSkin} receiveShadow>
        {onSkin ? (
          // На коже — пропускание: кожа видна сквозь силикон, на поверхности блик
          <meshPhysicalMaterial
            color="#FFFFFF"
            transmission={1}
            thickness={0.15}
            ior={1.41}
            roughness={0.08 + adhered * 0.12}
            clearcoat={1}
            clearcoatRoughness={0.08}
            specularIntensity={1}
            alphaMap={mask}
            alphaTest={0.5}
            side={THREE.DoubleSide}
            envMapIntensity={1.2}
          />
        ) : (
          // На фоне — прозрачное стекловидное покрытие с отражениями софтбокса
          <meshPhysicalMaterial
            color="#FFFFFF"
            transparent
            opacity={0.38}
            roughness={0.1}
            clearcoat={1}
            clearcoatRoughness={0.05}
            ior={1.41}
            specularIntensity={1}
            alphaMap={mask}
            side={THREE.DoubleSide}
            envMapIntensity={1.6}
            depthWrite={false}
          />
        )}
      </mesh>
      {/* Скошенная кромка — светится в контровом свете */}
      <mesh geometry={rim} castShadow={!onSkin}>
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.85}
          roughness={0.04}
          clearcoat={1}
          ior={1.41}
          thickness={0.1}
          envMapIntensity={1.6}
          transparent
          opacity={0.75 - adhered * 0.4}
        />
      </mesh>
    </group>
  );
};

// Защитная плёнка: голубоватая, с сантиметровой сеткой
export const Liner3D: React.FC<SheetProps & { opacity?: number }> = ({
  w,
  h,
  deform = {},
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  opacity = 1,
}) => {
  const r = Math.min(w, h) * 0.14;
  const geo = useGrid(w + 0.3, h + 0.3, deform, 36, Math.round(36 * (h / w)));
  const grid = useCanvasTexture(
    512,
    Math.round((512 * h) / w),
    (g) => {
      const W = g.canvas.width;
      const H = g.canvas.height;
      g.clearRect(0, 0, W, H);
      g.fillStyle = "rgba(205,228,236,0.85)";
      g.beginPath();
      g.roundRect(0, 0, W, H, (r / w) * W);
      g.fill();
      g.strokeStyle = "rgba(60,120,140,0.35)";
      g.lineWidth = 2;
      const step = W / w;
      for (let x = step; x < W; x += step) {
        g.beginPath();
        g.moveTo(x, 4);
        g.lineTo(x, H - 4);
        g.stroke();
      }
      for (let y = step; y < H; y += step) {
        g.beginPath();
        g.moveTo(4, y);
        g.lineTo(W - 4, y);
        g.stroke();
      }
    },
    [w, h, r],
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={grid}
          transparent
          opacity={0.92 * opacity}
          roughness={0.32}
          clearcoat={0.7}
          clearcoatRoughness={0.2}
          side={THREE.DoubleSide}
          alphaTest={0.05}
          envMapIntensity={1}
        />
      </mesh>
    </group>
  );
};
