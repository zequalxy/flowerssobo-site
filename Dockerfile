# syntax=docker/dockerfile:1

# ---------- deps: только node_modules, кэшируется отдельно ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder: production-сборка Next ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner: минимальный образ со standalone-сервером ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Бинарники sharp/libvips кладём явно. Трассировщик Next подбирает их по
# особому правилу, но если оно не сработает (на Windows так и есть), sharp
# не загрузится — и оптимизатор картинок МОЛЧА отдаёт оригиналы вместо
# AVIF/WebP: в 5–7 раз тяжелее, без единой ошибки в логах.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

USER nextjs
EXPOSE 3000

# Заявки уходят в Telegram — передайте секреты при запуске:
#   docker run -p 3000:3000 \
#     -e TELEGRAM_BOT_TOKEN=... -e TELEGRAM_CHAT_ID=... flowerssobo
# С подключённой Posiflora добавьте -e TELEGRAM_NOTIFY_ONLY=1 (в Telegram —
# только уведомление без ПДн). Без Posiflora флаг НЕ ставить — см. README.
CMD ["node", "server.js"]
