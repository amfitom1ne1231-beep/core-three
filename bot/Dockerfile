# Сервис бота CoreThree и его мини-приложение — одним образом.
#
# Собирается из корня репозитория: сервис вшивает общий с сайтом код
# (`lib/lead.ts`, `lib/intake-sign.ts`), поэтому контекст — весь проект.
#
#   docker build -f bot/Dockerfile -t corethree-bot .
#
# Настройки — только при запуске (`deploy/bot.env`, docker-compose.yml).

FROM node:22-alpine AS admin
WORKDIR /src/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY admin/ ./
RUN npm run build

FROM node:22-alpine AS build
WORKDIR /src/bot
COPY bot/package.json bot/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY bot/ ./
COPY lib/ /src/lib/
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    ADMIN_DIST=/app/admin \
    BOT_MIGRATIONS_DIR=/app/drizzle
COPY bot/package.json bot/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /src/bot/dist ./dist
COPY --from=build /src/bot/drizzle ./drizzle
COPY --from=admin /src/admin/dist ./admin
USER node
EXPOSE 8787
CMD ["node", "dist/main.js"]
