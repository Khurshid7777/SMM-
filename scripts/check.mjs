#!/usr/bin/env node
// Автопроверка контента Silicare. Любая ошибка (ERROR) останавливает публикацию.
// Запуск: node scripts/check.mjs [файлы...]   (по умолчанию — все content/reels/*.json)
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const brand = read("content/brand.json");
const forbidden = read("content/forbidden.json");
const schema = read("content/schema.json");

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(root, "content/reels"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => `content/reels/${f}`);

const lower = (s) => s.toLocaleLowerCase("ru");
// Разбивка титра на карточки по предложениям и до N слов — та же логика, что в video/src/cards.ts
const toCards = (text, max) => {
  const out = [];
  for (const sentence of text.split(/(?<=[^\d\s][.!?])\s+/).filter(Boolean)) {
    const w = sentence.split(/\s+/);
    // Делим ровно, чтобы не оставлять «висящее» слово на отдельной карточке
    const parts = Math.ceil(w.length / max);
    const size = Math.ceil(w.length / parts);
    for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size).join(" "));
  }
  return out;
};

let totalErrors = 0;
let totalWarnings = 0;

for (const file of files) {
  const errors = [];
  const warnings = [];
  let reel;
  try {
    reel = read(file);
  } catch (e) {
    console.log(`\n✖ ${file}\n  ERROR  не читается как JSON: ${e.message}`);
    totalErrors++;
    continue;
  }

  // 1. Схема: обязательные поля и типы
  for (const key of schema.required) {
    if (!(key in reel)) errors.push(`нет обязательного поля «${key}»`);
  }
  if (!schema.properties.status.enum.includes(reel.status)) errors.push(`неизвестный статус «${reel.status}»`);
  if (reel.fps !== brand.video.fps) errors.push(`fps должен быть ${brand.video.fps}`);
  if (reel.length_sec < brand.video.min_sec || reel.length_sec > brand.video.max_sec)
    errors.push(`длина ${reel.length_sec} с вне диапазона ${brand.video.min_sec}–${brand.video.max_sec} с`);

  // 2. Кадры: 5–8, без дыр и наложений, последний кадр = длине ролика
  const shots = reel.shots ?? [];
  if (shots.length < 5 || shots.length > 8) errors.push(`кадров ${shots.length}, нужно 5–8`);
  shots.forEach((s, i) => {
    if (s.end <= s.start) errors.push(`кадр ${s.n}: конец раньше начала`);
    if (i > 0 && Math.abs(s.start - shots[i - 1].end) > 0.001)
      errors.push(`кадр ${s.n}: начинается в ${s.start}, а предыдущий кончается в ${shots[i - 1].end}`);
    if (s.text_ru && !s.text_uz) errors.push(`кадр ${s.n}: есть титр RU, нет титра UZ`);
    for (const lang of ["text_ru", "text_uz"]) {
      const long = toCards(s[lang] ?? "", brand.video.max_words_per_card).length;
      if (long > 2) warnings.push(`кадр ${s.n} ${lang}: титр делится на ${long} карточек — сократите`);
    }
    const visual = lower(s.visual ?? "");
    for (const ban of forbidden.visual_bans) {
      if (visual.includes(ban)) errors.push(`кадр ${s.n}: в кадре запрещённое «${ban}»`);
    }
    const scenes = schema.properties.shots.items.properties.scene.enum;
    if (s.scene && !scenes.includes(s.scene)) errors.push(`кадр ${s.n}: неизвестная сцена «${s.scene}»`);
    if (reel.kind === "footage" && !s.clip && !s.scene) warnings.push(`кадр ${s.n}: нет ни клипа, ни сцены — в ролике будет текстовая раскадровка`);
  });
  if (shots.length && Math.abs(shots.at(-1).end - reel.length_sec) > 0.001)
    errors.push(`последний кадр кончается в ${shots.at(-1).end}, а length_sec = ${reel.length_sec}`);

  // 3. Тексты: запрещённые фразы, валюта, рана вне разрешённого контекста
  const texts = [
    ["hook.ru", reel.hook?.ru],
    ["hook.uz", reel.hook?.uz],
    ["caption_ru", reel.caption_ru],
    ["caption_uz", reel.caption_uz],
    ...shots.flatMap((s) => [
      [`кадр ${s.n} RU`, s.text_ru],
      [`кадр ${s.n} UZ`, s.text_uz],
    ]),
  ];
  for (const [where, raw] of texts) {
    if (!raw) continue;
    const t = lower(raw);
    for (const p of [...forbidden.phrases_ru, ...forbidden.phrases_uz]) {
      if (t.includes(lower(p))) errors.push(`${where}: запрещённая фраза «${p}»`);
    }
    for (const c of forbidden.currencies) {
      if (new RegExp(c, "u").test(t)) errors.push(`${where}: цена не в сумах («${c}»)`);
    }
    const hasWound = forbidden.wound_words.some((w) => new RegExp(`(^|[^а-яёқғўҳ])${w}([^а-яёқғўҳ]|$)`, "u").test(t));
    const allowed = forbidden.wound_allowed_context.some((c) => t.includes(c));
    if (hasWound && !allowed) warnings.push(`${where}: слово о ране вне контекста «после заживления» — проверьте вручную`);
  }

  // 4. Подписи, хэштеги, дисклеймер, UZ
  if (!reel.caption_uz?.trim()) errors.push("нет подписи на узбекском");
  if (!reel.caption_ru?.trim()) errors.push("нет подписи на русском");
  const tags = reel.hashtags ?? [];
  if (tags.length < 3 || tags.length > 5) errors.push(`хэштегов ${tags.length}, нужно 3–5`);
  if (tags.some((t) => !t.startsWith("#"))) errors.push("хэштег без #");
  if (reel.shows_product && reel.disclaimer !== true) errors.push("продукт в кадре, а дисклеймер выключен");
  if (reel.disclaimer && !(brand.disclaimer.ru && brand.disclaimer.uz)) errors.push("в brand.json нет дисклеймера RU/UZ");
  const firstTwo = (s) => s.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  if (reel.caption_ru && !/(рубец|рубц|пластыр|силикон)/i.test(firstTwo(reel.caption_ru)))
    warnings.push("в первых двух предложениях подписи RU нет поисковой фразы (рубец / пластырь / силикон)");

  // 5. Утверждения с источником
  const claims = reel.claims ?? [];
  if (!claims.length) warnings.push("нет ни одного утверждения в claims — точно ли в ролике нет фактов?");
  for (const c of claims) {
    if (!c.source || c.source.trim().length < 3) errors.push(`утверждение «${c.text}» без источника`);
    else if (/уточнить|todo|\?\?\?/i.test(c.source)) warnings.push(`источник «${c.text}» не сверен: ${c.source}`);
  }

  // 6. Статус не выше draft без носителя UZ и владельца
  if (reel.status !== "draft") {
    if (!reel.reviewed_by_native_uz) errors.push(`статус «${reel.status}», но UZ не проверен носителем`);
    if (!reel.approved_by_owner) errors.push(`статус «${reel.status}», но нет утверждения владельца`);
    const unverified = claims.filter((c) => /уточнить|todo/i.test(c.source ?? ""));
    if (unverified.length) errors.push(`статус «${reel.status}», но ${unverified.length} источник(ов) не сверены с инструкцией`);
  }

  totalErrors += errors.length;
  totalWarnings += warnings.length;
  const mark = errors.length ? "✖" : "✔";
  console.log(`\n${mark} ${file}  [${reel.status}]`);
  for (const e of errors) console.log(`  ERROR  ${e}`);
  for (const w of warnings) console.log(`  warn   ${w}`);
}

console.log(`\nИтого: ${files.length} файл(ов), ошибок ${totalErrors}, предупреждений ${totalWarnings}`);
process.exit(totalErrors ? 1 : 0);
