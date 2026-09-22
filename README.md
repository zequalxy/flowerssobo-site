# Flowerssobo — сайт цветочной студии

Одностраничный сайт флористической студии **Flowerssobo** (Липецк): авторские букеты
из сезонных цветов с доставкой за 60–90 минут. Живой сайт: [flowerssobo.ru](https://flowerssobo.ru).

<p>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-087ea4">
  <img alt="Tailwind CSS v4" src="https://img.shields.io/badge/Tailwind-v4-38bdf8">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6">
</p>

## Что внутри

- **Hero с фоновым видео** — цветочный прелоадер, устойчивый автоплей
  (повтор `play()` по первому жесту и возврату на вкладку, страховочный таймаут).
- **Витрина с поштучным ценообразованием** — у монобукетов селектор количества
  стеблей, цена пересчитывается на лету; доплата за упаковку (коробки L/XL)
  подставляется автоматически; «витринное» округление цен вверх до `…90`.
- **Каталог-коллаж** (бенто-сетка), секция сезонности, FAQ-аккордеон,
  бесконечная карусель отзывов с ручным drag/свайпом и инерцией.
- **Форма заявки → Posiflora + Telegram**: заказ создаётся в Posiflora
  (JSON:API, `POST /v1/orders`), в Telegram уходит уведомление с номером
  документа. zod-валидация на клиенте и сервере, honeypot, rate-limit
  (5 заявок / 10 минут / IP), аккуратные состояния ошибок.
- **SEO**: метаданные, OG-картинка, JSON-LD (Florist + FAQPage), robots,
  sitemap, фирменный favicon через `ImageResponse`.
- **Безопасность**: CSP и набор security-заголовков, лимит размера тела
  запроса, секреты только в env.

## Стек

| Слой | Технологии |
| --- | --- |
| Фреймворк | Next.js 16 (App Router, Turbopack), React 19 |
| Стили | Tailwind CSS v4 (`@theme`-токены в `globals.css`) |
| Анимации | framer-motion (морф карточек, JS-марки отзывов, reveal-эффекты) |
| Формы | react-hook-form + zod (+ повторная серверная валидация) |
| Прочее | @phosphor-icons/react, sonner (тосты), next/font (Onest + DaysSans) |

## Запуск

```bash
npm install
cp .env.example .env.local   # подставьте свои значения
npm run dev                  # http://localhost:3000
```

Переменные окружения (см. `.env.example`):

- `POSIFLORA_API_URL` — база API **вместе с `/api`**, например
  `https://ваш-аккаунт.posiflora.com/api`; `POSIFLORA_USERNAME` и
  `POSIFLORA_PASSWORD` — учётка; `POSIFLORA_STORE_ID` — UUID точки продаж
  (обязателен, если интеграция включена); `POSIFLORA_SOURCE_ID` и
  `POSIFLORA_WORKER_ID` — источник заказа и сотрудник-создатель,
  необязательные (сотрудник по умолчанию берётся из сессии).
  Где взять UUID — ниже, «Как найти идентификаторы Posiflora»;
- `TELEGRAM_BOT_TOKEN` — токен бота, которому уходят уведомления;
- `TELEGRAM_CHAT_ID` — chat_id получателя; несколько — через запятую.

Если переменные Posiflora не заданы, интеграция считается выключённой и
заявка уходит только в Telegram. Без Telegram-переменных сайт тоже
работает, но при выключенной Posiflora отправка формы вернёт ошибку.

Продакшен-сборка: `npm run build && npm start`. Линт: `npm run lint`.

## Как найти идентификаторы Posiflora

В личном кабинете UUID точки продаж и источника заказа не показываются —
их отдаёт API. Если знаете только логин и пароль, достаточно одной команды:

```bash
node scripts/posiflora-ids.mjs https://ваш-аккаунт.posiflora.com/api ЛОГИН ПАРОЛЬ
```

Скрипт залогинится, выведет точки продаж, источники заказа и сотрудников,
а в конце — готовый блок для `.env.local`. Он ничего не меняет, только
читает; пароль и токен не печатает. Без аргументов значения берутся из
окружения или из `.env.local`.

То же самое вручную, через `curl`. **1. Логин** — в ответе нужны
`data.attributes.accessToken` и `data.relationships.worker.data.id`
(это и есть сотрудник для `createdBy`):

```bash
curl -sS -X POST "https://ваш-аккаунт.posiflora.com/api/v1/sessions" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Accept: application/vnd.api+json" \
  -d '{"data":{"type":"sessions","attributes":{"username":"ЛОГИН","password":"ПАРОЛЬ"}}}'
```

**2. Справочники** — подставьте токен из первого шага. Точки продаж дадут
`POSIFLORA_STORE_ID`, источники — `POSIFLORA_SOURCE_ID`:

```bash
TOKEN="вставьте_accessToken"
BASE="https://ваш-аккаунт.posiflora.com/api"

curl -sS "$BASE/v1/stores"        -H "Accept: application/vnd.api+json" -H "Authorization: Bearer $TOKEN"
curl -sS "$BASE/v1/order-sources" -H "Accept: application/vnd.api+json" -H "Authorization: Bearer $TOKEN"
curl -sS "$BASE/v1/workers?activeOnly=true" -H "Accept: application/vnd.api+json" -H "Authorization: Bearer $TOKEN"
```

**3. Источник «Сайт»**, если его ещё нет. UUID придумываете сами — API
принимает клиентский идентификатор и возвращает его же:

```bash
curl -sS -X POST "$BASE/v1/order-sources" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Accept: application/vnd.api+json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"data":[{"type":"order-sources","id":"ПРИДУМАННЫЙ-UUID","attributes":{"title":"Сайт"}}]}'
```

Access-токен живёт около часа — для разовой настройки этого хватает.

### Docker

```bash
docker build -t flowerssobo .
docker run -p 3000:3000 \
  -e POSIFLORA_API_URL=... \
  -e POSIFLORA_USERNAME=... \
  -e POSIFLORA_PASSWORD=... \
  -e POSIFLORA_STORE_ID=... \
  -e TELEGRAM_BOT_TOKEN=... \
  -e TELEGRAM_CHAT_ID=... \
  flowerssobo
```

Multi-stage образ на `node:22-alpine` со standalone-выводом Next
(итоговый слой — только `server.js`, статика и `public/`), запуск от
непривилегированного пользователя. Секреты в образ не попадают —
только через переменные окружения при запуске.

## Структура

```
app/
  page.tsx           # единственная страница-лендинг (композиция секций)
  layout.tsx         # шрифты, метаданные, JSON-LD, тосты
  privacy/           # политика обработки персональных данных (152-ФЗ)
  api/order/         # приём заявки: rate-limit → zod → Posiflora → Telegram
  icon.tsx, robots.ts, sitemap.ts, not-found.tsx, error.tsx
components/
  Hero, Season, Categories, Showcase, ProductCard, ProductDetail,
  Faq, Reviews, OrderForm, Contacts, Footer, Nav, FloatingContacts, ui/
lib/
  site.ts            # единая точка правды: контакты, ссылки, реквизиты
  products.ts        # витрина: цена за штуку, варианты количества, упаковка
  posiflora.ts       # сессия Posiflora (логин/refresh) + создание заказа
  catalog.ts, faq.ts, reviews.ts, schema.ts, telegram.ts, utils.ts
scripts/
  posiflora-ids.mjs  # поиск UUID точки продаж, источника и сотрудника
public/
  images/, video/, og.jpg
```

## Заметки по реализации

- **Маршрут заявки.** `POST /api/order` сначала создаёт заказ в Posiflora и
  только потом шлёт уведомление в Telegram. Если Posiflora вернула ошибку,
  клиент видит ошибку — заявки нет. Если заказ создан, а Telegram отвалился,
  клиент видит успех (заказ-то на месте), а сбой уходит в лог. Когда Posiflora
  не настроена, Telegram снова становится единственным адресатом, и его сбой
  опять означает ошибку для клиента.
- **Сессия Posiflora.** Access-токен кэшируется в памяти инстанса до `expireAt`
  (со сдвигом 30 c); параллельные заявки схлопываются в один логин. Протухший
  refresh-токен не роняет заявку — клиент логинится заново. На 401 делается
  один повтор с новой сессией. Пароль и токены вычищаются из логов.
- **Состав заказа.** С сайта приходит пожелание, а не корзина, поэтому заказ
  создаётся без позиций и с `budget: 0`, без привязки клиента: контакты
  (ФИО, телефон, ник, способ связи, категория, комментарий) складываются в
  `description`, который менеджер видит в карточке заказа.
- **Связи заказа.** Отправляем только то, что объявлено в схеме
  `POST /v1/orders`: `store`, `source`, `customer`, `createdBy`, `florist`.
  `lines`, `images`, `courier` и `updatedBy` есть лишь в примере из
  документации и несут пустые значения — не шлём, чтобы не ловить 422.
  `docNo` не задаём: номер документа присваивает Posiflora.

- Цены поштучных позиций: `итог = prettyPrice(кол-во × цена/шт + упаковка)`,
  где `prettyPrice` округляет вверх до ближайшего `…90`.
- Карусель отзывов держит позицию в `(-half, 0]` по модулю половины ленты —
  контент задублирован, поэтому стык невидим; автопрокрутка и палец двигают
  одну и ту же координату.
- На Windows с кириллицей в пути проекта Turbopack требует явный
  `turbopack.root` в `next.config.ts` — иначе паника «char boundary»
  в именах чанков.

## Лицензия

Код открыт для чтения и обучения. Фотографии букетов, видео, логотип и
тексты принадлежат Flowerssobo (ИП Соболев Г. О.) — использование
контента без разрешения запрещено.
