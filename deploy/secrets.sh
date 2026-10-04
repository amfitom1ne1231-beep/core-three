#!/usr/bin/env bash
# Секреты на сервер — из настроек, с которыми бот и сайт работают сейчас
# (bot/.env.local и .env.local основной папки). Значения не печатаются.
#
#   SERVER=<логин>@<ip> deploy/secrets.sh
#
# Создаёт на сервере, если их ещё нет:
#   /opt/corethree/.env             — POSTGRES_PASSWORD (новый, случайный)
#   /opt/corethree/deploy/bot.env   — токен, владельцы, группа, ключи + новый WEBHOOK_SECRET
#   /opt/corethree/deploy/site.env  — секрет заявок и запасной Telegram
# Существующие файлы не трогает: перезаписать — удалить их на сервере.
#
# Google-таблица на сервер не переносится: копия заявок на серверах Google —
# передача персональных данных за границу, о ней в политике не сказано
# и Роскомнадзор не уведомлён. Включить осознанно — WITH_SHEETS=1.
set -euo pipefail
: "${SERVER:?укажите SERVER=<логин>@<ip>}"
KEY="${SSH_KEY:-$HOME/.ssh/corethree_vps}"
MAIN="${MAIN_DIR:-/Users/island001/CoreThree}"
DIR=/opt/corethree

get() { grep -E "^$1=" "$2" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

BOT_ENV="$MAIN/bot/.env.local"
SITE_ENV="$MAIN/.env.local"
[ -f "$BOT_ENV" ] && [ -f "$SITE_ENV" ] || { echo "нет $BOT_ENV или $SITE_ENV"; exit 1; }

bot=$(cat <<B
BOT_TOKEN=$(get BOT_TOKEN "$BOT_ENV")
WEBHOOK_SECRET=$(openssl rand -hex 32)
INTAKE_SECRET=$(get INTAKE_SECRET "$BOT_ENV")
SECRETS_KEY=$(get SECRETS_KEY "$BOT_ENV")
OWNER_TG_IDS=$(get OWNER_TG_IDS "$BOT_ENV")
GROUP_CHAT_ID=$(get GROUP_CHAT_ID "$BOT_ENV")
GROUP_THREAD_ID=${GROUP_THREAD_ID:-$(get GROUP_THREAD_ID "$BOT_ENV")}
MINI_APP_LINK=$(get MINI_APP_LINK "$BOT_ENV")
SHEETS_URL=$([ "${WITH_SHEETS:-}" = 1 ] && get SHEETS_URL "$BOT_ENV" || true)
SHEETS_SECRET=$([ "${WITH_SHEETS:-}" = 1 ] && get SHEETS_SECRET "$BOT_ENV" || true)
TELEGRAM_API_ROOT=${TELEGRAM_API_ROOT:-$(get TELEGRAM_API_ROOT "$BOT_ENV")}
WORK_TZ=Europe/Moscow
B
)
site=$(cat <<S
INTAKE_SECRET=$(get INTAKE_SECRET "$SITE_ENV")
TELEGRAM_BOT_TOKEN=$(get TELEGRAM_BOT_TOKEN "$SITE_ENV")
TELEGRAM_CHAT_ID=$(get TELEGRAM_CHAT_ID "$SITE_ENV")
TELEGRAM_THREAD_ID=$(get TELEGRAM_THREAD_ID "$SITE_ENV")
TELEGRAM_API_ROOT=${TELEGRAM_API_ROOT:-$(get TELEGRAM_API_ROOT "$SITE_ENV")}
S
)

ssh -i "$KEY" "$SERVER" "umask 077; mkdir -p $DIR/deploy
  [ -f $DIR/.env ] || echo POSTGRES_PASSWORD=\$(openssl rand -hex 24) > $DIR/.env
  [ -f $DIR/deploy/bot.env ] || cat > $DIR/deploy/bot.env
  echo готово" <<<"$bot"
ssh -i "$KEY" "$SERVER" "umask 077; [ -f $DIR/deploy/site.env ] || cat > $DIR/deploy/site.env" <<<"$site"
echo 'Секреты на сервере: .env, deploy/bot.env, deploy/site.env (права 600).'
