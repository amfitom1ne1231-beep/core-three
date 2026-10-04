#!/usr/bin/env bash
# Выкладка ретранслятора Bot API на Netlify (сайт corethree-relay,
# код — deploy/relay). Нужна, только когда меняется сама функция:
#
#   deploy/relay.sh
#
# Вход в Netlify — `npx netlify-cli login` под аккаунтом студии.
# Ключ ретранслятора здесь не участвует: он лежит в настройках сайта
# (RELAY_KEY) и в адресе TELEGRAM_API_ROOT на сервере.
set -euo pipefail
SITE="${RELAY_SITE_ID:-98e2cb89-70dc-473a-ab6a-7202cd6ad682}"

# Из копии вне репозитория и с явным сайтом: внутри репозитория netlify-cli
# считает любую папку привязанной к сайту превью и работает с ним.
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp -R "$(dirname "$0")/relay/." "$TMP/"
rm -rf "$TMP/.netlify"
cd "$TMP"

# Без --no-build: функцию упаковывает именно сборка, без неё уедет пустой сайт.
NETLIFY_SITE_ID="$SITE" npx --yes netlify-cli@latest deploy --prod --dir public --site "$SITE"
