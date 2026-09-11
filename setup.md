cat > ubuntu-hosting-complete-guide.md <<'EOF'
# Ubuntu Hosting Guide For Live Auction App

This guide is command-first and end-to-end for hosting on one Ubuntu laptop with Docker, Caddy reverse proxy, and public access through router forwarding.

## 1) Update system and install base tools

Run:
    sudo apt update
    sudo apt upgrade -y
    sudo apt install -y curl ca-certificates gnupg lsb-release git ufw

## 2) Install Docker and Docker Compose plugin

Run:
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER

Log out and log in again, then verify:
    docker --version
    docker compose version

## 3) Go to your project folder

If you already have the project:
    cd /path/to/chat-app

If you need to clone:
    git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
    cd YOUR_REPO

## 4) Create production environment files

Create app auth credentials:
    cat > .env <<'EOT'
    BASIC_AUTH_USER=your_admin_user
    BASIC_AUTH_PASS=change_this_to_a_strong_password
    EOT

Create frontend runtime URL setting:
    cat > .env.production <<'EOT'
    VITE_SERVER_URL=/
    EOT

## 5) Build and start with Docker Compose

Run:
    docker compose up -d --build

Check status:
    docker compose ps

Check logs:
    docker logs -f live-auction-floor

Local health test:
    curl http://127.0.0.1:3001/health

## 6) Install Caddy reverse proxy (HTTPS on 80/443)

Run:
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install -y caddy

## 7) Configure Caddy

Important:
- Use a hostname, not just raw IP, for automatic HTTPS certificates.
- If you do not own a domain, create a free hostname from DuckDNS or No-IP first.

Replace YOUR_HOSTNAME with your hostname and run:
    sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOT'
    YOUR_HOSTNAME {
      reverse_proxy 127.0.0.1:3001
    }
    EOT

Reload Caddy:
    sudo systemctl reload caddy
    sudo systemctl status caddy --no-pager

Test:
    curl https://YOUR_HOSTNAME/health

## 8) Open Ubuntu firewall

Run:
    sudo ufw allow OpenSSH
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw enable
    sudo ufw status

## 9) Get LAN details needed for router setup

Run:
    IFACE=$(ip route get 1.1.1.1 | awk '{print $5; exit}')
    echo Interface: $IFACE
    ip -4 addr show "$IFACE" | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){3}/\\d+'
    cat /sys/class/net/"$IFACE"/address
    ip route | awk '/default/ {print "Gateway:", $3}'
    curl -4 ifconfig.me ; echo

You will use:
- Local LAN IP (example 192.168.1.50)
- MAC address
- Gateway/router IP
- Public IP

## 10) Router configuration (manual in router web page)

You must do this in router admin panel:
- DHCP reservation:
  bind your laptop MAC to a fixed LAN IP (example 192.168.1.50)
- Port forwarding:
  external 80  -> 192.168.1.50:80
  external 443 -> 192.168.1.50:443

## 11) Verify from outside your home network

Use a phone on mobile data (Wi-Fi off):
- Open:
  https://YOUR_HOSTNAME/health
- Then open:
  https://YOUR_HOSTNAME

## 12) Daily operation commands

Start stack:
    docker compose up -d

Stop stack:
    docker compose down

Rebuild after code update:
    git pull
    docker compose up -d --build

View logs:
    docker logs -f live-auction-floor

Check listening ports:
    sudo ss -tulpen | grep -E ':80|:443|:3001'

## 13) Troubleshooting commands

Check Docker services:
    docker compose ps

Check Caddy:
    sudo systemctl status caddy --no-pager
    sudo journalctl -u caddy -n 100 --no-pager

Check firewall:
    sudo ufw status

Check public IP:
    curl -4 ifconfig.me ; echo

## 14) Optional: backup SQLite Docker volume

Run from project directory:
    docker run --rm -v auction_data:/data -v "$(pwd)":/backup alpine sh -c "tar czf /backup/auction_data_$(date +%F).tgz -C /data ."

## Notes

- Keep laptop plugged in and disable sleep.
- Keep one app instance only.
- Use strong BASIC_AUTH credentials.
EOF