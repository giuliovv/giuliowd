#!/usr/bin/env bash
# Bootstrap script for Android phone running Termux
# Installs: Node.js 22, OpenClaw, AWS CDK, AWS CLI, cloudflared
# Run this inside Termux on the phone
set -euo pipefail

echo "==> Updating Termux packages"
pkg update -y && pkg upgrade -y
pkg install -y nodejs git openssh termux-services python

echo "==> Installing AWS CLI"
pip install awscli --quiet

echo "==> Installing OpenClaw"
npm install -g openclaw@latest

echo "==> Installing AWS CDK"
npm install -g aws-cdk ts-node typescript

echo "==> Installing cloudflared (ARM64)"
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
  -o "$PREFIX/bin/cloudflared"
chmod +x "$PREFIX/bin/cloudflared"

echo "==> Setting up SSH server (so you can connect from your laptop)"
ssh-keygen -A
mkdir -p ~/.ssh
echo "SSH server configured. Runs on port 8022."
echo "Start it with: sshd"

echo "==> Setting up wake lock (prevents Android from killing Termux)"
termux-wake-lock 2>/dev/null || echo "  (install Termux:API app from F-Droid to enable wake lock)"

echo "==> Setting up OpenClaw autostart on boot"
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-openclaw.sh << 'EOF'
#!/usr/bin/env bash
# Runs on phone boot via Termux:Boot app
termux-wake-lock
sshd
openclaw start
EOF
chmod +x ~/.termux/boot/start-openclaw.sh

echo "==> Setting up OpenClaw daemon"
openclaw onboard --install-daemon

echo ""
echo "Bootstrap complete. Next steps:"
echo ""
echo "  1. Find your phone's local IP:"
echo "       ip addr show wlan0 | grep 'inet '"
echo ""
echo "  2. Start SSH server on the phone:"
echo "       sshd"
echo ""
echo "  3. From your laptop, connect:"
echo "       ssh $(whoami)@<phone-ip> -p 8022"
echo ""
echo "  4. Configure AWS credentials:"
echo "       aws configure"
echo ""
echo "  5. Clone this repo, then install CDK dependencies:"
echo "       cd ~/openclaw/infra && npm install"
echo ""
echo "  6. Bootstrap CDK in your AWS account (one-time):"
echo "       cd ~/openclaw/infra && cdk bootstrap"
echo ""
echo "  7. Deploy a site:"
echo "       ~/openclaw/scripts/deploy-site.sh my-site /path/to/html"
echo ""
echo "IMPORTANT: Install these two apps from F-Droid for full functionality:"
echo "  - Termux:Boot  (autostart on phone reboot)"
echo "  - Termux:API   (wake lock, prevents Android killing Termux)"
