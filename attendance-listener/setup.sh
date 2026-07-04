#!/bin/bash
# Run this on your Contabo Ubuntu VPS as root
# Usage: bash setup.sh

set -e
echo "=== ESSL K30 Pro Attendance Listener Setup ==="

# ── 1. Install Node.js (v20 LTS) ─────────────────────────────────────────────
echo ""
echo ">>> Installing Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
npm -v

# ── 2. Copy files to /opt ─────────────────────────────────────────────────────
echo ""
echo ">>> Installing listener to /opt/attendance-listener..."
mkdir -p /opt/attendance-listener
cp server.js   /opt/attendance-listener/
cp package.json /opt/attendance-listener/

cd /opt/attendance-listener
npm install --omit=dev

# ── 3. Open firewall port 8080 ────────────────────────────────────────────────
echo ""
echo ">>> Opening port 8080..."
ufw allow 8080/tcp
ufw status

# ── 4. Install systemd service ────────────────────────────────────────────────
echo ""
echo ">>> Installing systemd service..."
cp /root/attendance-listener/attendance-listener.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable attendance-listener
systemctl start  attendance-listener
systemctl status attendance-listener

# ── 5. Test ───────────────────────────────────────────────────────────────────
echo ""
echo ">>> Testing health endpoint..."
sleep 2
curl -s http://localhost:8080/health | python3 -m json.tool || curl -s http://localhost:8080/health

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Listener is running on port 8080."
echo "Configure your K30 Pro device:"
echo "  Server Address: $(curl -s ifconfig.me)"
echo "  Server Port:    8080"
echo "  Path:           /iclock/cdata"
echo ""
echo "View logs:   tail -f /var/log/attendance-listener.log"
echo "Restart:     systemctl restart attendance-listener"
echo "Stop:        systemctl stop attendance-listener"
