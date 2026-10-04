# Сайт CoreThree в контейнере — для сервера в РФ (deploy/README.md).
#
#   docker build -t corethree \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://example.ru \
#     --build-arg NEXT_PUBLIC_YM_ID= .
#   docker run -p 3000:3000 --env-file .env.local corethree
#
# NEXT_PUBLIC_* вшиваются в клиентский код на сборке, поэтому это
# аргументы сборки. Серверные секреты (INTAKE_SECRET, TELEGRAM_*) —
# только при запуске.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_YM_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_YM_ID=$NEXT_PUBLIC_YM_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
