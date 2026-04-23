# max-wedding

Веб-приложение для свадебного лендинга: расписание, карта, медиа и **форма ответа гостей** (придёт / не придёт, меню, напитки, комментарии). Клиент на **Next.js** и **Ant Design**, сервер — **Express** с общим процессом Next, данные в **PostgreSQL** через **TypeORM**, опционально **Telegram-бот** (вебхук и уведомления).

Поддерживается **i18n** (русский по умолчанию, английский): ключи локализации в `src/locales/`.

## Стек

| Слой | Технологии |
|------|------------|
| UI | React 19, Next.js 16, Ant Design 6 |
| API | Express, валидация (yup), axios на клиенте |
| БД | PostgreSQL, TypeORM |
| Прочее | Telegraf, Winston, i18next |

## Требования

- **Node.js** 20+ (в Docker-образах используется Node 25)
- **PostgreSQL**
- Для продакшена: Docker и учётная запись Docker Hub (см. деплой)

## Локальная разработка

1. Установить зависимости:

   ```bash
   npm ci
   ```

2. Создать файл `.env` в корне репозитория (см. раздел [Переменные окружения](#переменные-окружения)). Обязательно задайте `DATABASE_URL` под вашу локальную БД.

3. Применить миграции:

   ```bash
   npm run migration:run
   ```

4. Запустить сервер разработки (Next в dev-режиме + Express):

   ```bash
   npm run dev
   ```

По умолчанию порт задаётся переменной `PORT` (если не задан — **3015**). Укажите нужный порт в `.env`, например `PORT=3016`.

Откройте в браузере `http://localhost:<PORT>`.

## Переменные окружения

Создайте `.env` по образцу (значения подставьте свои; секреты в репозиторий не коммитьте).

| Переменная | Назначение |
|------------|------------|
| `PORT` | Порт HTTP-сервера |
| `NODE_ENV` | `development` \| `production` |
| `DATABASE_URL` | Строка подключения PostgreSQL, например `postgresql://user:pass@localhost:5432/dbname` |
| `DB` | `LOCAL` — логи в консоль; иначе при продакшене логи пишутся в файлы (например `/srv/logs`) |
| `IS_DOCKER` | `TRUE` в Docker: для `localhost` в `DATABASE_URL` подставляется `host.docker.internal` |
| `TELEGRAM_BOT_TOKEN` | Токен бота (если пусто — маршрут вебхука не регистрируется) |
| `TELEGRAM_WEBHOOK_URL` | Публичный URL вебхука для `setWebhook` в продакшене |
| `TELEGRAM_DEVELOPER_CHAT_ID` | Чат для уведомлений об ошибках бэкенда (в рабочем режиме `production`) |
| `NEXT_PUBLIC_APP_NAME` | Имя приложения (бандл клиента) |
| `NEXT_PUBLIC_APP_URL` | Базовый URL сайта |
| `NEXT_PUBLIC_LANGUAGE_KEY` | Ключ хранения языка в `localStorage` |
| `NEXT_PUBLIC_DEFAULT_LANGUAGE` | Язык по умолчанию, например `ru` |
| `PROXY_HOST`, `PROXY_USER`, `PROXY_PASS` | Настройки прокси для исходящих запросов (если используются) |

Публичные переменные с префиксом `NEXT_PUBLIC_*` для production-сборки должны быть доступны на этапе `next build` (локально через `.env`, в CI — через секреты workflow / build-args).

## База данных и миграции

- Источник данных: `server/db/data-source.ts`. `synchronize` отключён — схема только через миграции.
- Создать миграцию: `npm run migration:create` или `npm run migration:create:name`.
- Применить (dev): `npm run migration:run`.
- Применить (prod, скомпилированный CLI): `npm run migration:run:prod`.
- Откат последней миграции (dev): `npm run migration:revert`.

В Docker для dev при `DATABASE_URL` с `localhost` хост БД автоматически преобразуется в `host.docker.internal` (см. `resolveDatabaseUrl` в `data-source.ts`).

## Сборка и запуск production локально

```bash
npm run build
npm run start
```

Для проверки production-сборки с локальной БД без Docker:

```bash
npm run dev-prod
```

## Docker

**Разработка** (`Dockerfile.dev`, порт контейнера по умолчанию 3016):

```bash
docker compose -f docker-compose.dev.yml up --build
```

В `docker-compose.dev.yml` указаны тома и `extra_hosts` для доступа к PostgreSQL на хосте. Пути томов при необходимости измените под свою машину.

**Продакшен** описан в `docker-compose.prod.yml`: отдельный сервис `migrations` выполняет `migration:run:prod`, затем поднимается `server` с `start:server:prod`. Образ собирается из `Dockerfile`. На сервере ожидаются каталоги вроде `/srv/logs` и примонтированный `public` — см. compose-файл.

## Деплой (CI/CD)

При пуше в ветку **`production`** (или ручной запуск workflow) GitHub Actions:

1. Собирает Docker-образ и пушит в Docker Hub (`<DOCKER_USERNAME>/max-wedding:latest`).
2. Копирует `docker-compose.prod.yml` на VPS по SSH и выполняет `docker compose pull/up`.

Нужные секреты репозитория: Docker Hub, SSH к серверу, параметры `NEXT_PUBLIC_*` для билда и др. — см. `.github/workflows/deploy.yml`.

## Скрипты npm

| Скрипт | Описание |
|--------|----------|
| `npm run dev` | Разработка: tsx + Next dev |
| `npm run build` | Сборка Next и компиляция сервера в `dist/` |
| `npm run start` | Продакшен: `node server/server.js` |
| `npm run dev-prod` | Продакшен-режим Node с локальной БД (`DB=LOCAL`) |
| `npm run start:server:prod` | Старт с `DB=HOST` (типично для хоста с файловыми логами) |
| `npm run start:server:docker:dev` | Старт в Docker dev (`DB=LOCAL`, `IS_DOCKER=TRUE`) |
| `npm run lint` | ESLint для `src`, `server`, `shared` |
| `npm run migration:*` | См. раздел про миграции |

## Структура репозитория (кратко)

- `src/app/` — страницы и UI Next.js (главная — лендинг).
- `src/locales/` — переводы.
- `server/` — Express, маршруты API, TypeORM, Telegram.
- `shared/` — код, общий для клиента и сервера (конфиг сайта, коды меню и т.д.).

## Лицензия

Проект помечен как `private` в `package.json`; условия распространения задайте при необходимости отдельно.
