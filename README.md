# craft-overlay

Оверлей-помощник для **Path of Exile 2** (Windows). Первый этап — парсер текста предмета: из скопированного в игре текста (`Ctrl+C` / `Ctrl+Alt+C`) получаем нормализованный JSON с классом, редкостью, свойствами, модами, тирами и флагами.

Репозиторий: **https://github.com/ggwpaspera-main/craft-overlay** (public).

> Статус: **M4 — приложение с глобальным хоткеем**. Парсер v0.2.0 (11 фикстур), данные: 1881 база и 145 валют, Desktop UI на Electron. 14 тестов.

## Зачем парсер первым

Парсер — это чистая логика «текст → данные», без окон, хуков и сети. Он:
- быстро тестируется (`npm test`);
- переиспользуется в CLI, Electron-интерфейсе и будущем price-check;
- не зависит от версии игры, кроме формата текста.

Оверлей и Electron добавляются после того, как парсер стабилен.

## Структура

```
docs/                 архитектура, формат, источники данных
fixtures/ru/          реальные тексты предметов (русский клиент)
data/reference/       снимки из соседнего воркспейса
data/bases.json       базовые типы предметов (poe2db)
data/currency.json    валюта и её эффекты
scripts/              сборка out/ через esbuild
src/core/             парсер (чистый TS)
src/main/             Electron main-процесс
src/preload/          preload: буфер обмена
src/renderer/         окно приложения (HTML/CSS/TS)
src/cli.ts            CLI для отладки парсера
test/                 тесты
```

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — архитектура MVP и этапы.
- [docs/FORMAT-RU.md](docs/FORMAT-RU.md) — разобранный формат русского advanced-copy.
- [docs/DATA.md](docs/DATA.md) — схема `bases.json` и `currency.json`, источники, лицензия.
- [docs/REFERENCES.md](docs/REFERENCES.md) — что полезного лежит в `default-workspace`.

## Требования и окружение

Инструменты уже установлены локально (без прав администратора):

| Инструмент | Версия | Путь |
|---|---|---|
| Node.js LTS | v26.13.0 | `%LOCALAPPDATA%\Programs\nodejs` |
| npm | 11.20.0 | вместе с Node |
| Git | 2.56.0 | из GitHub Desktop: `%LOCALAPPDATA%\GitHubDesktop\app-<версия>\resources\app\git\cmd` |
| GitHub CLI | 2.103.3 | `%LOCALAPPDATA%\Programs\gh\bin` |

В новом терминале PATH уже настроен: `node`, `npm.cmd`, `gh` и `git` добавлены в пользовательский PATH. Если терминал был открыт до настройки — перезапусти его.

Особенность: в PowerShell включена политика выполнения, которая блокирует `npm.ps1`. Поэтому используй **`npm.cmd`** — он работает без изменения политики. Git и gh настроены: `gh auth login` выполнен для аккаунта `ggwpaspera-main`, git credential helper указывает на gh, push/pull работают.

## Быстрый старт

```powershell
npm.cmd install
npm.cmd test
npm.cmd run parse -- fixtures/ru/rare-helmet-advanced.txt
```

`npm.cmd run parse` печатает `ParseResult` в JSON: `item` со всеми полями и диагностику (`warnings`, `unknownLines`).

## Запуск приложения

Готовый portable exe (собран локально):

```
release\craft-overlay-0.1.0.exe
```

Двойной клик — откроется окно. Вставляешь текст предмета (`Ctrl+V`) или жмёшь «Вставить из буфера», приложение сразу показывает карточку предмета и моды.

Глобальный хоткей: **`Ctrl+Shift+D`** — показывает окно и сразу разбирает предмет из буфера обмена. Сценарий: скопировал предмет в игре (`Ctrl+C` / `Ctrl+Alt+C`) → нажал `Ctrl+Shift+D` → увидел карточку. Приложение **не отправляет клавиши в игру** — это безопасный вариант. Это пока обычное окно, не оверлей.

Особенности:

- exe **не коммитится** в git (папка `release/` в `.gitignore`, ~110 МБ). Его можно передать файлом или пересобрать.
- сборка без подписи: Windows SmartScreen может показать «Windows защитила ваш компьютер» → «Подробнее» → «Выполнить всё равно».
- пересобрать: `npm.cmd run dist`; запуск dev-версии: `npm.cmd run app` (нужен `ELECTRON_RUN_AS_NODE` не установленный в окружении).

## Фикстуры

Первые реальные образцы (2026-11-05, клиент RU, advanced copy):

- `fixtures/ru/rare-helmet-advanced.txt` — редкий шлем, гибридные префиксы, очернённый префикс, руны, осквернение;
- `fixtures/ru/rare-boots-advanced.txt` — редкая обувь, руна, фиксированные значения;
- `fixtures/ru/waystone-advanced.txt` — путевой камень: свойства, тир в базе, моды без тегов, описание;
- `fixtures/ru/unique-amulet-advanced.txt` — уникальный амулет: имплисит, уникальные моды, лор.

Вторая партия:

- `fixtures/ru/rare-amulet-quality-advanced.txt` — качество «чародейские свойства», `Расколотое`/`Ремесленное` префиксы, granted skill, аннотации, `Освящено` + `Расколотый предмет`;
- `fixtures/ru/unique-wand-advanced.txt` — жезл, `Улучшение от осквернения`, 5 сокетов, 4 руны, granted skill, `Дважды осквернено`;
- `fixtures/ru/rare-jewel-advanced.txt` — самоцвет, пустое имя ремесленного префикса, fixed value, описание;
- `fixtures/ru/normal-body-armour-advanced.txt` — обычный доспех, `Уклонение`, `(augmented)` в требованиях;
- `fixtures/ru/rare-ring-advanced.txt` — кольцо, качество чародейских свойств, аннотации;
- `fixtures/ru/magic-belt-advanced.txt` — волшебный пояс, два имплисита в одной секции;
- `fixtures/ru/rare-tablet-advanced.txt` — плитка, имплисит с двумя строками, описание.

## Данные

- [`data/bases.json`](data/bases.json) — **1881 базовый тип** в **36 классах** (оружие, доспехи, бижутерия, флаконы, обереги, самоцветы, waystone, реликвии). Источник: poe2db.ru, снимок 2026-11-05. Свойства, требования, имплиситы, иконки.
- [`data/currency.json`](data/currency.json) — **145 валют**, из них **11 основных сфер** с описанием эффекта. Источник: соседний проект `poe2-craft-guide/orbs.html`.

Схемы, ограничения и лицензия — в [docs/DATA.md](docs/DATA.md).

## Roadmap

| Этап | Что | Статус |
|---|---|---|
| M0 | Среда, репозиторий, фикстуры, формат | готово |
| M1 | Парсер: заголовок, свойства, требования, моды, флаги + тесты | готово |
| M2 | CLI + 40+ фикстур, устойчивость к мусору | в работе: 11 фикстур + данные |
| M3 | Electron-окно: вставка текста → карточка | готово (portable exe) |
| M4 | Хоткей и буфер обмена | готово: `Ctrl+Shift+D`, без авто-`Ctrl+C` |
| M5 | Прозрачный оверлей поверх игры | следующее |
| M6 | Trade API / цены | — |

## Ограничения и ToS

- Только чтение буфера обмена и игрового лога; без чтения памяти, инъекций и автоматизации кликов.
- Один хоткей — одно действие.
- Trade API — позже и с уважением к лимитам.
- Проект не аффилирован с Grinding Gear Games.
