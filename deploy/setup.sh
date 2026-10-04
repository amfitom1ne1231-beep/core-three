#!/usr/bin/env bash
# Первая подготовка сервера (Ubuntu 22.04/24.04). Запускается один раз:
#
#   SERVER=<логин>@<ip> deploy/setup.sh
#
# Логин — тот, что задан при создании машины: в Yandex Cloud входа под root
# нет, скрипт сам поднимает права через sudo. У обычного VPS — root@<ip>.
#
# Docker — из репозиториев самой Ubuntu, без сторонних скриптов.
# Открыты только SSH, 80 и 443. Вход по паролю выключается: только ключ.
# В Yandex Cloud порты 80 и 443 должны быть открыты ещё и в группе
# безопасности сети — проверить: deploy/README.md, «Yandex Cloud».
set -euo pipefail
: "${SERVER:?укажите SERVER=<логин>@<ip>}"
KEY="${SSH_KEY:-$HOME/.ssh/corethree_vps}"

ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$SERVER" \
  'if [ "$(id -u)" = 0 ]; then bash -s; else sudo bash -s; fi' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
# тот, под кем вошли: ему — Docker без sudo и папка проекта
OWNER="${SUDO_USER:-root}"

apt-get update -q
apt-get install -y -q docker.io docker-compose-v2 ufw unattended-upgrades rsync curl
systemctl enable --now docker
[ "$OWNER" = root ] || usermod -aG docker "$OWNER"

# память: на дешёвом тарифе Postgres, сайт и бот вместе — подстрахуемся подкачкой
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
ufw --force enable

# только по ключу: ключ уже добавлен при создании сервера
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd

mkdir -p /opt/corethree/deploy /opt/corethree/backups
chown -R "$OWNER": /opt/corethree
docker --version && docker compose version

# Telegram в России заблокирован, и с сервера до него может быть не достать.
# От ответа зависит, нужен ли ретранслятор — deploy/README.md, «Telegram».
if curl -sS -m 10 -o /dev/null https://api.telegram.org; then
  echo 'Telegram с сервера доступен.'
else
  echo 'ВНИМАНИЕ: api.telegram.org с сервера не отвечает — нужен ретранслятор (deploy/README.md, «Telegram»).'
fi
REMOTE
echo 'Сервер готов: Docker, подкачка, файрвол, вход только по ключу.'
