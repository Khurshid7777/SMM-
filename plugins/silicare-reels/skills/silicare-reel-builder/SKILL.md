---
name: silicare-reel-builder
description: Создание и сборка Reels Silicare в Remotion — от сценария в JSON до MP4 1080×1920 на RU и UZ. Используй, когда нужно написать новый сценарий, подставить отснятые клипы, собрать анимацию, проверить безопасные зоны или отрендерить ролики. Опирается на скилы плагина Remotion (remotion-best-practices, remotion-render).
---

# Сборка Reels Silicare

Один Reels = один JSON в `content/reels/`. Remotion-проект в `video/` читает эти файлы и сам строит две композиции на ролик: `<id>-ru` и `<id>-uz`. Тексты правятся в JSON, не в коде.

Перед работой с кодом загрузи скил `silicare-brand`; перед рендером на публикацию — `silicare-compliance`. По API Remotion — скилы плагина Remotion (`remotion-best-practices`, `remotion-render`).

## Структура

```
content/
  brand.json       палитра, шрифт, safe zones, дисклеймер RU/UZ
  forbidden.json   запрещённые фразы, валюты, запреты в кадре
  glossary.json    термины RU→UZ (проверяет носитель)
  schema.json      схема файла ролика
  reels/*.json     сценарии
scripts/check.mjs  автопроверка
schedule.csv       расписание; статус «утверждено» ставит владелец
video/
  src/Root.tsx         композиции из всех роликов × RU/UZ
  src/Reel.tsx         шаблон: фон кадра, карточки титров, финал с логотипом, музыка, safe zones
  src/SkinSection.tsx  анимация среза кожи (ролик 4)
  src/reels.ts         список роликов — новый JSON добавь сюда импортом
  public/fonts         Onest (OFL)
  public/footage       отснятые клипы
  public/music         лицензированные треки
```

## Новый ролик

1. Скопируй ближайший JSON, поменяй `id` (`reel-NN-slug`), `title`, кадры.
2. Кадры: `start`/`end` в секундах без дыр, 5–8 кадров, итог 15–25 с. Титр до 7 слов на карточку — длинный титр делится на карточки автоматически, но больше двух карточек на кадр — повод сократить.
3. Каждый факт — в `claims` с источником. Нет источника — «… — УТОЧНИТЬ».
4. `status: "draft"`, `reviewed_by_native_uz: false`, `approved_by_owner: false`.
5. Добавь импорт в `video/src/reels.ts`.
6. `node scripts/check.mjs` → ноль ошибок.

## Отснятый материал

Положи клипы в `video/public/footage/<id>/shot-<n>.mp4` и пропиши у кадра `"clip": "footage/<id>/shot-<n>.mp4"`. Без `clip` кадр рисуется раскадровкой (палитра + описание), так ролик можно согласовать до съёмки. Клип обрезается под 9:16, получает медленный наезд и тёплую коррекцию. Звук клипа сохраняется.

Музыка: `"music": "music/<file>.mp3"` в JSON — играет тихо (35%) с затуханием.

Анимационные ролики (`"kind": "animation"`) рисуются кодом, фазы привязаны к таймингам кадров. Пример — `SkinSection.tsx`: срез кожи, влага уходит, коллаген густеет, слой силикона, волокна выравниваются, без красного.

## Просмотр и рендер

```bash
cd video
npm i
npm run dev                       # Remotion Studio; переключатель showSafeZones в props
npx remotion render reel-01-how-to-apply-ru out/reel-01-ru.mp4
npm run render:all                # все ролики × RU/UZ в video/out (сначала автопроверка)
```

Рендерь только по просьбе пользователя. Ролик на публикацию — только после `check.mjs` без ошибок, проверки UZ носителем и утверждения владельца. Финальную проверку делай на телефоне: safe zones свободны, текст читается.

## Чего не делать

- Не показывать лица, раны, швы, кровь, «до/после».
- Не менять шрифт на Manrope (нет қ ғ ҳ).
- Не захардкоживать цвета и тексты в компонентах — только через `brand.json` и JSON ролика.
