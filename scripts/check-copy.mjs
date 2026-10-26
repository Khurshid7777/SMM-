#!/usr/bin/env node
// Автопроверка текстов data/copy.*.json (ТЗ-1 раздел 1, ТЗ-2 раздел 1).
// Запуск: node scripts/check-copy.mjs   → ERROR останавливает передачу текстов, warn — ручная проверка.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const forbidden = read("content/forbidden.json");

// Запрещено ТЗ-1: обещания и слабые доказательства
const BAN = {
  ru: [...forbidden.phrases_ru, "убирает шрам", "удаляет шрам", "убирает рубц", "удаляет рубц", "избавляет от", "от растяжек", "100 %", "лечит", "излечива", "до и после", "до/после"],
  "uz-latn": ["chandiqni yoʻqotadi", "izlarni yoʻqotadi", "100 %", "davolaydi", "kafolat", "strijadan", "oldin va keyin"],
  uz: [...forbidden.phrases_uz, "чандиқни йўқотади", "даволайди", "кафолат", "олдин ва кейин"],
};
// «Проверено врачами» — только при реальном враче (ТЗ-1, слайд 8)
const DOCTOR = { ru: /проверено врачами/i, "uz-latn": /shifokorlar tavsiyasi/i, uz: /шифокорлар тавсияси/i };
const PLACEHOLDER = /\[(ЗАПОЛНИТЬ|СВЕРИТЬ|ЮРИСТ|ЗАМЕР|СЧИТАТЬ|TEKSHIRISH|TOʻLDIRISH|YURIST|OʻLCHASH|HISOBLASH|ТЕКШИРИШ|ҲИСОБЛАШ|DOSYE|TASDIQLASH|YAFHO)[^\]]*\]/g;
// слово — токен с буквой или цифрой; × — · • и т.п. не считаем
const words = (s) => s.replace(PLACEHOLDER, "").split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
// служебные поля (заметки для дизайнера и источники) не публикуются
const SERVICE = /(^|\.)(visual|footnote_source|title_note|_[a-z]+)$/;

let errors = 0;
let warns = 0;
const err = (m) => (errors++, console.log("  ERROR  " + m));
const warn = (m) => (warns++, console.log("  warn   " + m));

// обход всех строк с путём
function* strings(obj, path = "") {
  if (typeof obj === "string") yield [path, obj];
  else if (Array.isArray(obj)) for (const [i, v] of obj.entries()) yield* strings(v, `${path}[${i}]`);
  else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) if (!k.startsWith("_")) yield* strings(v, path ? `${path}.${k}` : k);
}

for (const lang of ["ru", "uz-latn", "uz"]) {
  const d = read(`data/copy.${lang}.json`);
  console.log(`\n● copy.${lang}.json`);
  const placeholders = new Set();
  for (const [path, s] of strings(d)) {
    if (SERVICE.test(path)) continue;
    const low = s.toLocaleLowerCase("ru");
    for (const b of BAN[lang]) if (low.includes(b.toLocaleLowerCase("ru"))) err(`${path}: запрещённая фраза «${b}»`);
    if (DOCTOR[lang].test(s) && !/\[(ЮРИСТ|YURIST)/.test(s)) err(`${path}: «проверено врачами» без реального врача`);
    for (const c of forbidden.currencies) if (new RegExp(c, "u").test(low)) err(`${path}: цена не в сумах («${c}»)`);
    for (const m of s.matchAll(PLACEHOLDER)) placeholders.add(m[0]);
    if (lang === "uz-latn") {
      if (/[oOgG]['’ʼ`]/.test(s)) err(`${path}: апостроф в oʻ/gʻ должен быть ʻ U+02BB`);
      if (/[а-яА-ЯёЁ]/.test(s.replace(PLACEHOLDER, "")) && !/^(_|box\.legal|marketplace\.specs)/.test(path)) warn(`${path}: кириллица в латинском тексте`);
    }
    if (lang === "uz" && /[a-zA-Z]{4,}/.test(s.replace(PLACEHOLDER, "").replace(/Uzum|Mustoe|sil\.icare|SC-\d+|@\S+/g, ""))) warn(`${path}: латиница в кириллическом тексте`);
  }
  // слайды: заголовок до 6 слов
  for (const sl of d.slides ?? []) if (words(sl.title) > 6) err(`slides[${sl.n}].title: ${words(sl.title)} слов, максимум 6`);
  // описание 1500–2500 знаков
  if (d.marketplace) {
    const len = d.marketplace.description.map((b) => b.h + "\n" + b.p).join("\n\n").replace(PLACEHOLDER, "").length;
    if (len < 1500 || len > 2500) err(`marketplace.description: ${len} знаков, нужно 1500–2500`);
    else console.log(`  ok     описание ${len} знаков, ${d.marketplace.description.length} блоков`);
    if (d.marketplace.description.length !== 7) err(`marketplace.description: ${d.marketplace.description.length} блоков, нужно 7`);
  }
  // видео: подпись до 7 слов, фраза ≥ 1,5 с; энд-карта есть
  for (const [id, r] of Object.entries(d.video ?? {})) {
    if (id === "end_card") continue;
    if (!r.shots.at(-1)?.end) err(`video.${id}: нет энд-карты последним кадром`);
    let total = 0;
    for (const sh of r.shots) {
      const [a, b] = sh.t.split("–").map((x) => parseFloat(x.replace(",", ".")));
      if (b - a < 1.5 && (sh.text || sh.icons)) err(`video.${id} ${sh.t}: кадр короче 1,5 с`);
      total = b;
      for (const t of [sh.text, ...(sh.icons ?? []), ...(sh.sizes ?? []), ...(sh.timeline ?? []).map((x) => x.text)]) {
        if (t && words(t) > 7) warn(`video.${id} ${sh.t}: «${t}» — ${words(t)} слов (> 7, удлиняем кадр или режем)`);
      }
    }
    if (total !== r.length_sec) err(`video.${id}: таймкоды кончаются на ${total}, а length_sec = ${r.length_sec}`);
  }
  console.log(`  метки  ${placeholders.size}: ${[...placeholders].join(" · ") || "нет"}`);
}

console.log(`\nИтого: ошибок ${errors}, предупреждений ${warns}`);
process.exit(errors ? 1 : 0);
