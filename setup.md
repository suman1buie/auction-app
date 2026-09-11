# Ubuntu Hosting Guide For Live Auction App (No Docker)

This guide runs the app directly on Ubuntu using Node.js, systemd, and Caddy.
It also includes a no-domain path.

## 1) Update system and install base packages

Run:
    sudo apt update
    sudo apt upgrade -y
    sudo apt install -y curl ca-certificates gnupg lsb-release git ufw

## 2) Install Node.js (system-wide)

Run:
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs

Verify:
    node -v
    npm -v
    which node

## 3) Go to project directory and install dependencies

If project is already present:
    cd /path/to/chat-app

If cloning:
    git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
    cd YOUR_REPO

Install:
    npm ci

## 4) Create frontend build env

Create:
    cat > .env.production <<'EOT'
    VITE_SERVER_URL=/
    EOT

Why:
- Slash means same-origin.
- Frontend and backend stay on same host URL.

## 5) Create runtime server env (used by systemd)

Create:
    sudo tee /etc/live-auction-floor.env > /dev/null <<'EOT'
    NODE_ENV=production
    PORT=3001
    BASIC_AUTH_ENABLED=true
    BASIC_AUTH_USER=your_admin_user
    BASIC_AUTH_PASS=change_this_to_a_strong_password
    EOT

Secure file:
    sudo chmod 600 /etc/live-auction-floor.env

## 6) Build frontend

Run:
    npm run build

This creates dist, and server serves it from server/index.js.

## 7) Quick local run test

Run:
    set -a
    source <(sudo cat /etc/live-auction-floor.env)
    set +a
    node server/index.js

In another terminal:
    curl http://127.0.0.1:3001/health

Stop with Ctrl+C after test.

## 8) Create systemd service

Set helper variables:
    APP_DIR="$(pwd)"
    APP_USER="$(whoami)"
    NODE_BIN="$(command -v node)"

Create service:
    sudo tee /etc/systemd/system/live-auction-floor.service > /dev/null <<EOT
    [Unit]
    Description=Live Auction Floor
    After=network.target
    
    [Service]
    Type=simple
    WorkingDirectory=$APP_DIR
    EnvironmentFile=/etc/live-auction-floor.env
    ExecStart=$NODE_BIN server/index.js
    Restart=always
    RestartSec=3
    User=$APP_USER
    Group=$APP_USER
    
    [Install]
    WantedBy=multi-user.target
    EOT

Enable and start:
    sudo systemctl daemon-reload
    sudo systemctl enable --now live-auction-floor

Verify:
    sudo systemctl status live-auction-floor --no-pager
    journalctl -u live-auction-floor -n 100 --no-pager

## 9) Install Caddy reverse proxy

Run:
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install -y caddy

## 10) Caddy config

Option A: You have hostname or DDNS hostname

Replace YOUR_HOSTNAME:
    sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOT'
    YOUR_HOSTNAME {
      reverse_proxy 127.0.0.1:3001
    }
    EOT

Apply:
    sudo systemctl reload caddy
    sudo systemctl status caddy --no-pager

Test:
    curl https://YOUR_HOSTNAME/health

Option B: No domain and no hostname

HTTP only on port 80:
    sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOT'
    :80 {
      reverse_proxy 127.0.0.1:3001
    }
    EOT

Apply:
    sudo systemctl reload caddy

Note:
- Voice/microphone works best on HTTPS.
- If you have no domain, use Cloudflare Tunnel for HTTPS URL.

## 11) Open Ubuntu firewall

Run:
    sudo ufw allow OpenSSH
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw enable
    sudo ufw status

## 12) Get LAN details for router forwarding

Run:
    IFACE=$(ip route get 1.1.1.1 | awk '{print $5; exit}')
    echo Interface: $IFACE
    ip -4 addr show "$IFACE" | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){3}/\\d+'
    cat /sys/class/net/"$IFACE"/address
    ip route | awk '/default/ {print "Gateway:", $3}'
    curl -4 ifconfig.me ; echo

## 13) Router settings (manual in router UI)

Configure:
- DHCP reservation for your laptop MAC to fixed LAN IP (example 192.168.1.50)
- Port forward external 80 to 192.168.1.50:80
- Port forward external 443 to 192.168.1.50:443

## 14) Verify external reachability

From phone mobile data:
- Open health URL first.
- Then open app URL.

## 15) No-domain HTTPS alternative (recommended)

Install cloudflared:
    wget -O /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i /tmp/cloudflared.deb

Start tunnel:
    cloudflared tunnel --url http://localhost:3001

Use the generated https URL.

## 16) Daily operation

Start service:
    sudo systemctl start live-auction-floor

Stop service:
    sudo systemctl stop live-auction-floor

Restart service:
    sudo systemctl restart live-auction-floor

Service status:
    sudo systemctl status live-auction-floor --no-pager

App logs:
    journalctl -u live-auction-floor -f

After code update:
    git pull
    npm ci
    npm run build
    sudo systemctl restart live-auction-floor

## 17) Optional backup

Backup SQLite file:
    cp server/data/auction.sqlite "$HOME/auction_$(date +%F).sqlite"

Notes:
- Keep laptop plugged in and sleep disabled.
- Keep strong BASIC_AUTH credentials.
- Keep VITE_SERVER_URL as slash for same-origin routing.