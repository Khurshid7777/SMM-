import React, { useLayoutEffect, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { continueRender, delayRender, useVideoConfig } from "remotion";
import { fontFamily } from "../brand";

// Предметная студия в духе DTC-брендов (Hims & Hers): один предмет на бесшовном пастельном фоне,
// мягкий верхний софтбокс, контактная тень. Единицы — сантиметры, пол — y = 0.

export type CameraSpec = {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
  // Сдвиг кадра вниз (доля высоты), чтобы предмет стоял ниже заголовка
  shiftY?: number;
};

export const Rig: React.FC<CameraSpec> = ({ position, target, fov = 26, shiftY = 0 }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    camera.position.set(...position);
    camera.fov = fov;
    camera.near = 1;
    camera.far = 1000;
    camera.lookAt(...target);
    if (shiftY) camera.setViewOffset(size.width, size.height, 0, -shiftY * size.height, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, size, fov, shiftY, ...position, ...target]);
  return null;
};

type StudioProps = {
  bg: string;
  camera: CameraSpec;
  children: React.ReactNode;
  // 0 — нейтральный дневной свет, 1 — тёплый вечерний
  warm?: number;
  shadowOpacity?: number;
  contact?: boolean;
  floor?: boolean;
};

export const Studio: React.FC<StudioProps> = ({
  bg,
  camera,
  children,
  warm = 0,
  shadowOpacity = 0.22,
  contact = true,
  floor = true,
}) => {
  const { width, height } = useVideoConfig();
  const keyColor = new THREE.Color("#FFF6EC").lerp(new THREE.Color("#FFD9B0"), warm);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      shadows="soft"
      flat
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ fov: camera.fov ?? 26, position: camera.position }}
    >
      <Rig {...camera} />
      <color attach="background" args={[bg]} />
      <hemisphereLight args={["#FFFFFF", bg, 0.85]} />
      <directionalLight
        position={[-26, 46, 22]}
        intensity={1.45}
        color={keyColor}
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
      <directionalLight position={[30, 20, -10]} intensity={0.35} color="#FFFFFF" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={[new THREE.Color(bg).lerp(new THREE.Color("#FFFFFF"), 0.25).getStyle()]} />
        <Lightformer form="rect" intensity={1.6} position={[0, 40, 10]} scale={[60, 30, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.2} color={keyColor} position={[-40, 14, 10]} scale={[16, 50, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.8} position={[40, 10, 0]} scale={[10, 40, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" intensity={1.2} position={[0, 10, 50]} scale={14} />
      </Environment>
      {floor ? <Floor bg={bg} shadowOpacity={shadowOpacity} /> : null}
      {contact ? <ContactShadows position={[0, 0.02, 0]} opacity={0.42} scale={90} blur={2.2} far={14} resolution={512} color="#3B2A20" /> : null}
      {children}
    </ThreeCanvas>
  );
};

// Бесшовный пол: неосвещённый, с мягким световым пятном; тени — отдельным слоем
const Floor: React.FC<{ bg: string; shadowOpacity: number }> = ({ bg, shadowOpacity }) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    const light = new THREE.Color(bg).lerp(new THREE.Color("#FFFFFF"), 0.35);
    grad.addColorStop(0, `#${light.getHexString()}`);
    grad.addColorStop(1, bg);
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [bg]);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <planeGeometry args={[260, 260]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[260, 260]} />
        <shadowMaterial opacity={shadowOpacity} color="#3B2A20" />
      </mesh>
    </>
  );
};

// Текстура из canvas. Если рисует текст — ждёт шрифт, перерисовывает GL-кадр и только потом отпускает рендер
export const useCanvasTexture = (
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
  deps: unknown[],
  opts: { text?: boolean; srgb?: boolean } = {},
) => {
  const advance = useThree((s) => s.advance);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const t = new THREE.CanvasTexture(c);
    if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [w, h]);
  const paint = () => {
    const c = tex.image as HTMLCanvasElement;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    draw(g);
    tex.needsUpdate = true;
  };
  // Без текста рисуем сразу, синхронно
  useMemo(() => {
    if (!opts.text) paint();
  }, [tex, ...deps]);
  useLayoutEffect(() => {
    if (!opts.text) return;
    const handle = delayRender("шрифт для текстуры");
    fontsReady().then(() => {
      paint();
      advance(performance.now());
      requestAnimationFrame(() => continueRender(handle));
    });
  }, [tex, ...deps]);
  return tex;
};

let fontsPromise: Promise<unknown> | null = null;
const fontsReady = () => {
  fontsPromise ??= Promise.all([
    document.fonts.load(`500 80px ${fontFamily}`, "АаЎўҚқҒғҲҳ"),
    document.fonts.load(`600 80px ${fontFamily}`, "АаЎўҚқҒғҲҳ"),
    document.fonts.load(`700 80px ${fontFamily}`, "АаЎўҚқҒғҲҳ"),
  ]);
  return fontsPromise;
};

// Детерминированный шум для фактур
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
