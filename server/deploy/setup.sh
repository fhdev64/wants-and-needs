#!/usr/bin/env bash
# One-time setup of the Хотелки server on a fresh Ubuntu 24.04 VPS (run as root).
# Afterwards put secrets into /opt/hotelki/server/.env and: systemctl restart hotelki
set -euo pipefail

REPO=https://github.com/fhdev64/wants-and-needs.git
DIR=/opt/hotelki

# swap: Chromium needs headroom on a 2 GB box
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git ufw fonts-liberation fonts-noto-color-emoji \
  libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libcups2t64 libdrm2 libgbm1 libgtk-3-0t64 libnss3 \
  libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 libpango-1.0-0 libcairo2

# Node.js 22 (node:sqlite is built in)
if ! node -v 2>/dev/null | grep -q '^v2[2-9]'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# app user + code
id hotelki >/dev/null 2>&1 || useradd -r -m -d /home/hotelki -s /usr/sbin/nologin hotelki
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone --depth 1 "$REPO" "$DIR"; fi
cd "$DIR/server"
sudo -u hotelki true 2>/dev/null || true
npm ci --omit=dev
npx puppeteer browsers install chrome
mkdir -p data && chown -R hotelki:hotelki "$DIR/server" /home/hotelki
# puppeteer downloads Chrome into root's cache; give the service user its own copy
sudo -u hotelki -H bash -c "cd $DIR/server && npx puppeteer browsers install chrome" >/dev/null

# the app listens on 8787; allow it through the firewall, keep SSH
ufw allow OpenSSH >/dev/null; ufw allow 8787/tcp >/dev/null; ufw --force enable >/dev/null

cat > /etc/systemd/system/hotelki.service <<'UNIT'
[Unit]
Description=Хотелки: API + Telegram bot
After=network-online.target
Wants=network-online.target

[Service]
User=hotelki
WorkingDirectory=/opt/hotelki/server
ExecStart=/usr/bin/node --no-warnings src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
MemoryMax=1500M

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable hotelki >/dev/null
echo "setup done"
