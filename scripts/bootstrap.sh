#!/usr/bin/env bash
# Bootstrap script for OCI ARM Ubuntu instance
# Installs: Node.js 22, OpenClaw, AWS CDK, AWS CLI v2, cloudflared
set -euo pipefail

echo "==> Updating system packages"
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl git unzip build-essential

echo "==> Adding 2GB swap (needed for npm builds on low-memory instances)"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "==> Installing Node.js 22"
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "==> Installing OpenClaw"
sudo npm install -g openclaw@latest

echo "==> Installing AWS CDK"
sudo npm install -g aws-cdk ts-node typescript

echo "==> Installing AWS CLI v2 (ARM64)"
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp/
sudo /tmp/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws

echo "==> Installing cloudflared (for public tunneling)"
curl -fsSL --output /tmp/cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i /tmp/cloudflared.deb
rm /tmp/cloudflared.deb

echo "==> Setting up OpenClaw daemon"
openclaw onboard --install-daemon

echo ""
echo "Bootstrap complete. Next steps:"
echo ""
echo "  1. Configure AWS credentials:"
echo "       aws configure"
echo ""
echo "  2. Clone this repo and install CDK dependencies:"
echo "       cd ~/openclaw/infra && npm install"
echo ""
echo "  3. Bootstrap CDK in your AWS account (one-time):"
echo "       cd ~/openclaw/infra && cdk bootstrap"
echo ""
echo "  4. Deploy a static site:"
echo "       ~/openclaw/scripts/deploy-site.sh my-site /path/to/html/files"
