---
name: openclaw infra setup
description: Claude Code Channels on AWS t4g.micro + CDK for deploying side projects, with Telegram interface
type: project
originSessionId: 806f42b1-d350-44e0-adf5-0fac30499f7e
---
Claude Code Channels runs on an AWS t4g.micro (ARM, us-east-1, free tier) as a persistent Telegram bot, using Claude Pro subscription (no API charges). AWS CDK deploys side projects.

**Current live instance:** 54.152.27.231 (`ssh claude-server`)

**Stack:**
- AWS EC2 t4g.micro, Ubuntu 22.04 ARM64, 20GB EBS gp3, 2GB swap
- Claude Code Channels with Telegram plugin (`giuliowd_bot`, token in systemd service)
- Workspace: `/home/ubuntu/giuliowd` (git repo)
- IAM instance role with full CDK deploy permissions (no manual `aws configure` needed)

**CDK stack:** `infra/lib/claude-server-stack.ts`
- Deploy with: `cdk deploy --context telegramToken=<token>`
- Telegram token: `8671415395:AAFc0mkygzn1EDCchVAuU6hYF2gUrS63xZQ`

**Service management:**
- systemd service: `claude-channels.service` (`Restart=always`)
- Startup script: `/home/ubuntu/start-claude-channels.sh` — starts tmux session, auto-accepts workspace trust dialog with `sleep 5 && tmux send-keys Enter`
- Bun symlinked to `/usr/local/bin/bun` (required for Telegram plugin)

**Cron jobs (ubuntu user):**
- Every 5min: `watchdog-claude.sh` — restarts service if bun plugin dies
- Every 3h: `compact-claude.sh` — sends `/compact` to tmux to prevent context overflow (which causes 401 errors)
- Daily 3am: `cleanup-claude-versions.sh` — removes old Claude auto-update binaries (each ~226MB, would fill disk otherwise)

**Known issues / lessons learned:**
- OCI Milan (eu-milan-1) always shows "Out of host capacity" for A1.Flex free tier — don't bother retrying
- Claude auto-updates daily and keeps all old binaries in `~/.local/share/claude/versions/` — fills 8GB disk within days; 20GB volume + cleanup cron required
- `Restart=on-failure` is insufficient — Claude sometimes exits cleanly (code 0); must use `Restart=always`
- Bun must be in system PATH (`/usr/local/bin/bun`) — tmux sessions don't inherit the PATH set in the systemd unit
- Context overflow (~85k tokens) causes 401 auth errors in channels mode — `/compact` every 3h prevents this

**REQUIRED MANUAL STEP AFTER FRESH CDK DEPLOY:**
The Claude OAuth token cannot be automated. After `cdk deploy`:
1. `ssh ubuntu@<new-ip>`
2. Run `claude` (or `claude login`) and follow the browser link to authenticate with Claude Pro
3. `sudo systemctl start claude-channels`

Without step 2, the service will start but reply with "401 Invalid authentication credentials" to every Telegram message.
