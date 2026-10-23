import r01 from "../../content/reels/reel-01-how-to-apply.json";
import r02 from "../../content/reels/reel-02-myth-or-fact.json";
import r03 from "../../content/reels/reel-03-care.json";
import r04 from "../../content/reels/reel-04-why-scar-thickens.json";
import r05 from "../../content/reels/reel-05-when-to-start.json";
import r06 from "../../content/reels/reel-06-after-c-section.json";
import r07 from "../../content/reels/reel-07-asmr.json";
import type { PaletteKey } from "./brand";

export type Lang = "ru" | "uz";

export type Shot = {
  n: number;
  start: number;
  end: number;
  visual: string;
  text_ru: string;
  text_uz: string;
  sound: string;
  // Путь к отснятому клипу внутри video/public, например "footage/reel-01/shot-1.mp4"
  clip?: string;
};

export type Reel = {
  id: string;
  title: string;
  status: string;
  kind: "footage" | "animation";
  length_sec: number;
  fps: number;
  palette: PaletteKey[];
  shots: Shot[];
  shows_product: boolean;
  disclaimer: boolean;
  music?: string;
};

// Новый ролик: положите JSON в content/reels и добавьте импорт сюда
export const reels = [r01, r02, r03, r04, r05, r06, r07] as Reel[];
