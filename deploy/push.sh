#!/usr/bin/env bash
# Выкладка: собрать образы здесь (под процессор сервера), отправить
# на сервер и перезапустить. Сервер ничего не собирает — хватает
# дешёвого тарифа.
#
#   SERVER=<логин>@<ip> deploy/push.sh
#
# Номер счётчика Метрики, когда появится: NEXT_PUBLIC_YM_ID=… перед командой.
#
# Пока corethree.ru не указывает на сервер, сайт открывается по адресу
# машины без HTTPS (deploy/Caddyfile.ip). Как только записи домена
# на месте — следующая выкладка сама включает основной Caddyfile и HTTPS.
# Выбрать руками: CADDYFILE=deploy/Caddyfile перед командой.
set -euo pipefail
: "${SERVER:?укажите SERVER=<логин>@<ip>}"
KEY="${SSH_KEY:-$HOME/.ssh/corethree_vps}"
PLATFORM="${PLATFORM:-linux/amd64}"
DIR=/opt/corethree
cd "$(dirname "$0")/.."

HOST="${SERVER#*@}"
if [ -z "${CADDYFILE:-}" ]; then
  if [ "$(dig +short A corethree.ru 2>/dev/null | tail -1)" = "$HOST" ]; then
    CADDYFILE=deploy/Caddyfile
  else
    CADDYFILE=deploy/Caddyfile.ip
    echo "Домен ещё не указывает на $HOST — сайт будет открыт по http://$HOST, без HTTPS."
  fi
fi

echo "Сборка под $PLATFORM…"
# Сборка под процессор сервера идёт в эмуляции и изредка падает сама по себе:
# сайт — на загрузке шрифтов с Google Fonts («An error occurred in next/font»),
# бот — на установке зависимостей. Повтор проходит.
build() {
  local n
  for n in 1 2 3; do
    docker buildx build --platform "$PLATFORM" --load "$@" && return 0
    echo "Сборка не удалась (попытка $n из 3)…"
  done
  echo 'Не собралось с трёх попыток.'
  return 1
}
build -t corethree-site:latest \
  --build-arg NEXT_PUBLIC_SITE_URL=https://corethree.ru \
  --build-arg NEXT_PUBLIC_YM_ID="${NEXT_PUBLIC_YM_ID:-}" .
build -t corethree-bot:latest -f bot/Dockerfile .

echo 'Файлы запуска…'
rsync -az -e "ssh -i $KEY" docker-compose.yml "$SERVER:$DIR/"
# --inplace: файл подключён в контейнер поштучно, и подменённый целиком
# он бы остался для работающего Caddy прежним
rsync -az --inplace -e "ssh -i $KEY" "$CADDYFILE" "$SERVER:$DIR/deploy/Caddyfile"

echo 'Образы на сервер…'
docker save corethree-site:latest corethree-bot:latest | gzip | ssh -i "$KEY" "$SERVER" 'gunzip | docker load'

echo 'Перезапуск…'
# Без домена webhook невозможен (Telegram некуда стучаться) — бот опрашивает
# Telegram сам. Строку BOT_MODE в .env скрипт ставит и снимает только свою:
# о ней помнит файл .no-domain; заданную руками не трогает.
if [ "$CADDYFILE" = deploy/Caddyfile.ip ]; then
  MODE="grep -q '^BOT_MODE=' .env || { echo BOT_MODE=polling >> .env; touch .no-domain; }"
else
  MODE="if [ -f .no-domain ]; then sed -i '/^BOT_MODE=polling\$/d' .env; rm -f .no-domain; fi"
fi

# reload — чтобы работающий Caddy перечитал свой файл; у только что созданного это лишнее, не ошибка
ssh -i "$KEY" "$SERVER" "cd $DIR && $MODE && docker compose up -d --no-build --remove-orphans \
  && { docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true; } \
  && docker image prune -f >/dev/null && docker compose ps"
