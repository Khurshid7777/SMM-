# Шрифты: покрытие кириллицы и узбекской латиницы

Файлы: `brand/fonts/` (Manrope, Inter — вариативные, SIL OFL).

| Роль | Семейство | Проверка | Результат |
|---|---|---|---|
| heading | Manrope | Русская кириллица | ✓ |
| heading | Manrope | Узбекская кириллица ў қ ғ ҳ | ✗ қ U+049B ғ U+0493 ҳ U+04B3 Қ U+049A Ғ U+0492 Ҳ U+04B2 |
| heading | Manrope | Узбекская латиница oʻ gʻ (ʻ U+02BB) | ✗ ʻ U+02BB ʻ U+02BB ʻ U+02BB ʻ U+02BB |
| heading | Manrope | Апостроф ʼ U+02BC | ✗ ʼ U+02BC |
| heading | Manrope | Апостроф ’ U+2019 | ✓ |
| heading | Manrope | Знаки № × – — «» ₽ | ✓ |
| heading | Manrope | Цифры и % | ✓ |
| heading_uz | Inter | Русская кириллица | ✓ |
| heading_uz | Inter | Узбекская кириллица ў қ ғ ҳ | ✓ |
| heading_uz | Inter | Узбекская латиница oʻ gʻ (ʻ U+02BB) | ✓ |
| heading_uz | Inter | Апостроф ʼ U+02BC | ✓ |
| heading_uz | Inter | Апостроф ’ U+2019 | ✓ |
| heading_uz | Inter | Знаки № × – — «» ₽ | ✓ |
| heading_uz | Inter | Цифры и % | ✓ |
| body | Inter | Русская кириллица | ✓ |
| body | Inter | Узбекская кириллица ў қ ғ ҳ | ✓ |
| body | Inter | Узбекская латиница oʻ gʻ (ʻ U+02BB) | ✓ |
| body | Inter | Апостроф ʼ U+02BC | ✓ |
| body | Inter | Апостроф ’ U+2019 | ✓ |
| body | Inter | Знаки № × – — «» ₽ | ✓ |
| body | Inter | Цифры и % | ✓ |

## Правила

- **Manrope SemiBold** — заголовки и логотип на русском и в латинице без узбекских букв.
- **Inter SemiBold** — заголовки на узбекском: и кириллица (қ ғ ҳ), и латиница (ʻ U+02BB). В Manrope этих знаков нет.
- **Inter Regular/Medium** — весь наборный текст на всех языках.
- Апостроф в oʻ gʻ — только ʻ U+02BB. Автопроверка отклоняет ' U+0027 и ’ U+2019 в узбекской латинице.
- Логотип и иконки — в кривых (`brand/logo/*.svg`), шрифты для них не нужны.
