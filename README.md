# max-wedding

Веб-приложение для свадебного лендинга: расписание, карта, медиа и **форма ответа гостей** (придёт / не придёт, меню, напитки, комментарии). Клиент на **Next.js** и **Ant Design**, сервер — **Express** с общим процессом Next, данные в **PostgreSQL** через **TypeORM**, опционально **Telegram-бот** (вебхук, уведомления и **админка в личке** для управления меню, настройками сайта и заявками).

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
- Для продакшена: Docker, учётная запись Docker Hub и VPS с Docker (см. деплой)

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

На VPS для `docker compose -f docker-compose.prod.yml` в `.env` на сервере также нужен **`DOCKER_USERNAME`** — тот же логин Docker Hub, что и в образе `<DOCKER_USERNAME>/max-wedding:latest` (его подставляет CI перед `docker compose up`).

Публичные переменные с префиксом `NEXT_PUBLIC_*` для production-сборки должны быть доступны на этапе `next build` (локально через `.env`, в CI — через секреты GitHub Environment / build-args).

## Telegram-бот: гости и админка

При первом обращении к боту (команда **`/start`**) в таблице **`user`** создаётся или обновляется запись по **Telegram ID**; по умолчанию роль **`USER`**. Обычным гостям в меню команд бота доступен только **`/start`** — бот отвечает ссылкой на сайт (`NEXT_PUBLIC_APP_URL`).

**Админка** доступна пользователям с ролью **`ADMIN`** в той же таблице **`user`**, без мягкого удаления (`deleted` пусто). Роль назначается вручную в PostgreSQL (после того как человек хотя бы раз написал боту, чтобы появилась строка с его `telegram_id`). Список команд для админов задаётся в `server/telegram/telegram-bot-command-menu.ts`; при старте сервера бот синхронизирует меню команд в личке для каждого известного админа, а при **`/start`** админу дополнительно показывается краткая шпаргалка по командам.

Для администраторов (кратко):

| Команда | Назначение |
|---------|------------|
| `/miniapp` | Кнопка **Web App** — Mini App редактора меню по пути `/tg-miniapp/menu-admin` относительно `NEXT_PUBLIC_APP_URL` (если URL не задан, команда сообщит об ошибке) |
| `/settings` | Настройки сайта (например фон с сердечками), переключатели в чате |
| `/menu` | Редактор каталога блюд и напитков прямо в чате (инлайн-кнопки и черновики) |
| `/list` | Последние заявки гостей |
| `/last` | Последняя заявка |
| `/summary` | Сводка по анкетам |
| `/export` | Выгрузка заявок в Excel |

О **новой заявке** с сайта все активные админы из БД получают сообщение в Telegram (если задан `TELEGRAM_BOT_TOKEN`). Реализация команд и проверка прав — в `server/services/telegram/telegram-wedding-bot-commands.service.ts`.

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

Образ собирается из `Dockerfile`: multi-stage сборка, `ENTRYPOINT ["npm", "run"]`, команды в compose — имена npm-скриптов (`migration:run:prod`, `start:server:prod`).

**Разработка** (`Dockerfile.dev`, порт контейнера по умолчанию 3016):

```bash
docker compose -f docker-compose.dev.yml up --build
```

В `docker-compose.dev.yml` заданы `extra_hosts` для доступа к PostgreSQL на хосте и тома для логов и каталога `public` — пути при необходимости измените под свою машину (в репозитории могут быть примеры под Windows).

**Продакшен** (`docker-compose.prod.yml`):

- Сервис **`migrations`** — одноразовый запуск `npm run migration:run:prod` (образ тот же, что у приложения).
- Сервис **`server`** — `npm run start:server:prod`, стартует только после успешного завершения миграций (`depends_on` с `condition: service_completed_successfully`).
- Оба сервиса используют **`network_mode: "host"`** (приложение слушает порт хоста из `PORT` в `.env`, обычно 3015).
- Тома: логи (`/srv/logs`), статический `public` сайта, при необходимости монтирование `/etc/localtime` и `/etc/timezone` для часового пояса. Пути вроде `/var/www/…/public` в файле — пример под конкретный сервер; под свою установку скорректируйте их и положите рядом с compose актуальный `.env`.

## Деплой (CI/CD)

Workflow **Deploy to VPS [max-wedding]** (`.github/workflows/deploy.yml`):

- **Триггеры:** push в ветку **`production`** или ручной запуск (**workflow_dispatch**).
- **Сборка:** job `build` в GitHub Environment **`production`** (секреты и protection rules задаются для этого environment). Собирается образ **linux/amd64**, пушится в Docker Hub: `<DOCKER_USERNAME>/max-wedding:latest`.
- **Деплой:** на VPS по SSH копируется `docker-compose.prod.yml` в каталог приложения (в workflow — `/var/www/veremevs.ru/`), затем выполняется `docker login`, `docker pull`, экспорт `DOCKER_USERNAME`, `docker compose … down` и `up -d`, в конце `docker image prune -f`.

Секреты репозитория / environment (имена из workflow): **`DOCKER_USERNAME`**, **`DOCKER_TOKEN`**, **`NEXT_PUBLIC_APP_NAME`**, **`NEXT_PUBLIC_APP_URL`**, **`NEXT_PUBLIC_LANGUAGE_KEY`**, **`NEXT_PUBLIC_DEFAULT_LANGUAGE`** (build-args), **`SERVER_HOST`**, **`SERVER_USER`**, **`AM_PROJECTS_SSH_PRIVATE_KEY`**.

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
| `npm run test` | Тесты Node (`tsx --test`, `server/**/*.test.ts`) |
| `npm run migration:*` | См. раздел про миграции |

## Структура репозитория (кратко)

- `src/app/` — страницы и UI Next.js (главная — лендинг).
- `src/locales/` — переводы.
- `server/` — Express, маршруты API, TypeORM, Telegram.
- `shared/` — код, общий для клиента и сервера (конфиг сайта, коды меню и т.д.).

## Лицензия

Проект помечен как `private` в `package.json`; условия распространения задайте при необходимости отдельно.
