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
- **Форма заявки → Telegram**: zod-валидация на клиенте и сервере,
  honeypot, rate-limit (5 заявок / 10 минут / IP), рассылка нескольким
  получателям, аккуратные состояния ошибок.
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

- `TELEGRAM_BOT_TOKEN` — токен бота, которому уходят заявки;
- `TELEGRAM_CHAT_ID` — chat_id получателя; несколько — через запятую;
- `TELEGRAM_NOTIFY_ONLY` — `1`, если заявки хранятся в Posiflora: тогда в
  Telegram уходит только уведомление «новая заявка» без персональных данных.
  **Включать только там, где подключена интеграция с Posiflora** — в этом
  репозитории её нет, и без неё заявка целиком никуда бы не попала;
- `TELEGRAM_API_BASE` — необязательно: адрес прокси/зеркала Bot API, если
  хостинг не выпускает трафик к `api.telegram.org` напрямую.

Без токена и chat_id сайт работает, но отправка формы вернёт ошибку.

Продакшен-сборка: `npm run build && npm start`. Линт: `npm run lint`.

### Docker

```bash
docker build -t flowerssobo .
docker run -p 3000:3000 \
  -e TELEGRAM_BOT_TOKEN=... \
  -e TELEGRAM_CHAT_ID=... \
  -e TELEGRAM_NOTIFY_ONLY=1 \
  flowerssobo
# TELEGRAM_NOTIFY_ONLY=1 — только при подключённой Posiflora (см. выше)
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
  privacy/, consent/ # Положение о конфиденциальности и Согласие на обработку ПДн (152-ФЗ)
  api/order/         # приём заявки: rate-limit → лимит тела → zod → Telegram
  icon.tsx, robots.ts, sitemap.ts, not-found.tsx, error.tsx, global-error.tsx
components/
  Hero, Season, Categories, CategoryCard, CategoryDetail, Showcase,
  ProductCard, ProductDetail, Faq, Reviews, OrderForm, Contacts, Footer,
  Nav, FloatingContacts, LegalPage, ui/
lib/
  site.ts            # единая точка правды: контакты, ссылки, реквизиты
  products.ts        # витрина: цена за штуку, варианты количества, упаковка
  catalog.ts, faq.ts, reviews.ts, schema.ts, telegram.ts, utils.ts
public/
  images/            # detail/ — кадры 4:5 для витрины и раскрытых карточек
  video/, og.jpg
```

## Заметки по реализации

- Цены поштучных позиций: `итог = prettyPrice(кол-во × цена/шт + упаковка)`,
  где `prettyPrice` округляет вверх до ближайшего `…90`.
- Карусель отзывов держит позицию в `(-half, 0]` по модулю половины ленты —
  контент задублирован, поэтому стык невидим; автопрокрутка и палец двигают
  одну и ту же координату.
- Фото витрины и раскрытых карточек — заранее скадрированные кадры 4:5 в
  `public/images/detail/` (композиция целиком, без полей). Заменили фото —
  нужен новый кадр там же; исходники без кропа лежат в `products/` и
  `catalog/`.
- На Windows с кириллицей в пути проекта Turbopack требует явный
  `turbopack.root` в `next.config.ts` — иначе паника «char boundary»
  в именах чанков.

## Лицензия

Код открыт для чтения и обучения. Фотографии букетов, видео, логотип и
тексты принадлежат Flowerssobo (ИП Соболев Г. О.) — использование
контента без разрешения запрещено.
