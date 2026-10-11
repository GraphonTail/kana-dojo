# KanaDojo RU — неофициальная русская версия

_English: this is an unofficial Russian-language fork of [lingdojo/kana-dojo](https://github.com/lingdojo/kana-dojo), modified in October 2026. It is not affiliated with or endorsed by the KanaDojo team._

Это изменённая версия KanaDojo (AGPL-3.0). Изменения сделаны в октябре 2026 года и живут в ветке `deploy`; ветка `main` остаётся зеркалом оригинала.

## Что изменено

**Русский интерфейс.** `core/i18n/ru-overlay/` подменяет английские строки интерфейса русскими прямо на странице. Словарь лежит в `data/ru/ui.tsv`, строки со значениями внутри (баллы, проценты, «Раздел 3») обрабатываются шаблонами из `patterns.ts`. Японский текст, ромадзи и ввод пользователя не трогаются. Код компонентов оригинала почти не меняется, поэтому обновления из upstream сливаются без конфликтов.

**Русские значения кандзи и слов (JLPT N5–N1).** Переводы лежат в `data/ru/kanji-*.tsv` и `data/ru/vocab-*.tsv`. Команда `npm run ru:build` собирает из них `public/data-kanji-ru/` и `public/data-vocab-ru/`. Приложение ставит русские значения первыми, английские остаются после них: на экране показывается русский, а при вводе засчитываются оба языка (ё и е считаются одной буквой).

**Настройки развёртывания** (для личного проекта на Vercel Hobby):

- из `vercel.json` убран частый cron;
- добавлен заголовок `X-Robots-Tag: noindex`;
- Sentry, аналитика и AdSense включаются только своими переменными окружения: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `ANALYTICS_ENABLED=true`, `NEXT_PUBLIC_ADSENSE_ENABLED=true`;
- удалены `public/ads.txt` и музыкальный файл `mariah-carey.opus`;
- кнопки GitHub ведут на исходный код именно этой сборки (`shared/config/sourceCode.ts`), как требует раздел 13 AGPL.

**Android.** `public/.well-known/assetlinks.json` связывает сайт с Android-приложением `ua.kanadojo.ru` (Trusted Web Activity). Приложение открывает сайт https://kanadojo-ru.vercel.app в Chrome на весь экран и работает только онлайн. Настройки сборки лежат в `scripts/ru/android/` (`twa-manifest.json` и `build-apk.sh`). Ключ подписи `kanadojo-ru.keystore` в Git не хранится: новые версии приложения нужно подписывать тем же ключом.

**Автономное Android-приложение (без интернета).** `scripts/ru/standalone/` собирает версию 2.x того же приложения `ua.kanadojo.ru`, которой сайт не нужен. `build-web.mjs` копирует репозиторий во временную папку и оставляет там только учебные экраны. Затем он собирает статическую копию сайта (Next.js `output: 'export'`) и кладёт её в `android/app/src/main/assets/www`. Android-оболочка (`android/`) показывает эти файлы в WebView. Произношение идёт через системный синтез речи Android (`bridge.js` и `TtsBridge.java`), ссылки на другие сайты открываются в браузере, резервная копия прогресса сохраняется через системный диалог. Собрать: `scripts/ru/standalone/build-apk.sh` (нужны JDK 17, Android SDK и ключ подписи). Перед каждым выпуском нужно поднять `versionCode` в `android/app/build.gradle`.

## Обновление из оригинала

```bash
git switch main && git fetch upstream && git merge --ff-only upstream/main && git push origin main
git switch deploy && git merge main
npm run ru:build   # если обновились данные
git push origin deploy
```

Если после обновления на экране появились английские строки, добавьте их в `data/ru/ui.tsv` и запустите `npm run ru:build`.

## Лицензии

- Код: GNU AGPL-3.0, как и у оригинала (`LICENSE.md`).
- Русские значения кандзи переведены с английских значений KANJIDIC (© EDRDG, CC BY-SA 4.0). Русские значения слов переведены с английских определений из JLPT-списков Jonathan Waller (CC BY). Поэтому файлы `data/ru/kanji-*.tsv`, `data/ru/vocab-*.tsv` и собранные из них JSON распространяются на условиях CC BY-SA 4.0 с указанием этих источников.
