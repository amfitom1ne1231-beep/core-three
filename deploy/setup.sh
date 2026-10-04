#!/usr/bin/env bash
# Первая подготовка сервера (Ubuntu 22.04/24.04). Запускается один раз:
#
#   SERVER=root@<ip> deploy/setup.sh
#
# Docker — из репозиториев самой Ubuntu, без сторонних скриптов.
# Открыты только SSH, 80 и 443. Вход по паролю выключается: только ключ.
set -euo pipefail
: "${SERVER:?укажите SERVER=root@<ip>}"
KEY="${SSH_KEY:-$HOME/.ssh/corethree_vps}"

ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$SERVER" 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q docker.io docker-compose-v2 ufw unattended-upgrades
systemctl enable --now docker

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
docker --version && docker compose version
REMOTE
echo 'Сервер готов: Docker, подкачка, файрвол, вход только по ключу.'
