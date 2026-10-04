#!/usr/bin/env bash
# Выкладка: собрать образы здесь (под процессор сервера), отправить
# на сервер и перезапустить. Сервер ничего не собирает — хватает
# дешёвого тарифа.
#
#   SERVER=root@<ip> deploy/push.sh
#
# Номер счётчика Метрики, когда появится: NEXT_PUBLIC_YM_ID=… перед командой.
set -euo pipefail
: "${SERVER:?укажите SERVER=root@<ip>}"
KEY="${SSH_KEY:-$HOME/.ssh/corethree_vps}"
PLATFORM="${PLATFORM:-linux/amd64}"
DIR=/opt/corethree
cd "$(dirname "$0")/.."

echo "Сборка под $PLATFORM…"
docker buildx build --platform "$PLATFORM" --load -t corethree-site:latest \
  --build-arg NEXT_PUBLIC_SITE_URL=https://corethree.ru \
  --build-arg NEXT_PUBLIC_YM_ID="${NEXT_PUBLIC_YM_ID:-}" .
docker buildx build --platform "$PLATFORM" --load -t corethree-bot:latest -f bot/Dockerfile .

echo 'Файлы запуска…'
rsync -az -e "ssh -i $KEY" docker-compose.yml "$SERVER:$DIR/"
rsync -az -e "ssh -i $KEY" deploy/Caddyfile "$SERVER:$DIR/deploy/"

echo 'Образы на сервер…'
docker save corethree-site:latest corethree-bot:latest | gzip | ssh -i "$KEY" "$SERVER" 'gunzip | docker load'

echo 'Перезапуск…'
ssh -i "$KEY" "$SERVER" "cd $DIR && docker compose up -d --no-build --remove-orphans && docker image prune -f >/dev/null && docker compose ps"
