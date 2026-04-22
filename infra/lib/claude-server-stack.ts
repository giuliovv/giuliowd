import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

const SSH_PUBLIC_KEY = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDRvci6XqMvALIJnbpQPrNsJjFxsifxLsviQgUOEe9gHvIPBAUI8lDvsJ5zwNTLTQmHfv4bUdGdn2YMuexauIa0W70DYcjG45IXNBmU5PfADht1HxxbCku0v7yss1j0obhpJy5YC0yALjwGbde7y0QbmB4ffWOyecPH9A4KtxFdihD7NPFACnTOKjZZLfH3LDqLWoBDmBmVxhbmy9pet+MuDu9j4+XoiMe8ZqbT6j6P4Rx1r4HJ81ZtGzXCo/eZ7J4FK9D7swiP9yPn2W35xo7LlAJHjIE2lv9BS15ycqauVfcnWhPmTx/MPy8buC3+3G/vIcsUfXEocCc+tQp7Vh3kniUgVGrkJuSIvIZdjiSJZrJ++bJPioKgJTIPIOYsd5iJJi5b3QqARn4h03G/7Ng0/yLv7KGOUj/ZYPD7S80R1WpaD0z57PGsNOqiB+lEAaq7IZ+Vw2oA4kj/0SbmifWEVDkF5U7gPGZU/xZ5V2kOnkCgBmppRXSY9Glq6fBZqsc= giulio@GIULIOLP';

export class ClaudeServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Pass via: cdk deploy --context telegramToken=xxx
    const telegramToken = this.node.tryGetContext('telegramToken') ?? 'REPLACE_ME';

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    const sg = new ec2.SecurityGroup(this, 'SG', {
      vpc,
      description: 'Claude Code Channels server',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH');

    // Instance role — grants AWS permissions so no manual aws configure needed
    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    // CDK deployment permissions (same scope as openclaw-deployer)
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: ['arn:aws:iam::*:role/cdk-*'],
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'cloudformation:Describe*', 'cloudformation:List*', 'cloudformation:Get*',
        's3:*', 'cloudfront:*',
        'ecs:*', 'ecr:*',
        'lambda:*', 'apigateway:*', 'execute-api:*',
        'dynamodb:*',
        'route53:*', 'route53domains:*',
        'acm:*',
        'logs:*', 'cloudwatch:*',
        'secretsmanager:*',
        'ec2:Describe*', 'ec2:List*',
        'ec2:RunInstances', 'ec2:TerminateInstances', 'ec2:StartInstances', 'ec2:StopInstances',
        'ec2:CreateSecurityGroup', 'ec2:DeleteSecurityGroup',
        'ec2:AuthorizeSecurityGroupIngress', 'ec2:RevokeSecurityGroupIngress',
        'ec2:AuthorizeSecurityGroupEgress', 'ec2:RevokeSecurityGroupEgress',
        'ec2:CreateKeyPair', 'ec2:DeleteKeyPair',
        'ec2:AllocateAddress', 'ec2:AssociateAddress', 'ec2:DisassociateAddress', 'ec2:ReleaseAddress',
        'ec2:CreateTags', 'ec2:DeleteTags',
        'ec2:ModifyInstanceAttribute', 'ec2:ModifyVolume', 'ec2:CreateVolume', 'ec2:DeleteVolume', 'ec2:AttachVolume', 'ec2:DetachVolume',
      ],
      resources: ['*'],
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'iam:CreateRole', 'iam:DeleteRole', 'iam:AttachRolePolicy', 'iam:DetachRolePolicy',
        'iam:PutRolePolicy', 'iam:DeleteRolePolicy', 'iam:GetRole', 'iam:PassRole',
        'iam:CreateServiceLinkedRole',
      ],
      resources: ['*'],
    }));

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euo pipefail',
      'exec > /var/log/user-data.log 2>&1',

      // ── Swap (essential on 1GB RAM) ──────────────────────────────────────
      'fallocate -l 2G /swapfile',
      'chmod 600 /swapfile',
      'mkswap /swapfile',
      'swapon /swapfile',
      "echo '/swapfile none swap sw 0 0' >> /etc/fstab",

      // ── System packages ──────────────────────────────────────────────────
      'apt-get update -y',
      'apt-get install -y curl git tmux unzip expect',

      // Cap systemd journal to prevent disk fill
      'mkdir -p /etc/systemd/journald.conf.d',
      'echo -e "[Journal]\\nSystemMaxUse=50M" > /etc/systemd/journald.conf.d/size.conf',
      'systemctl restart systemd-journald',

      // ── SSH key ───────────────────────────────────────────────────────────
      'mkdir -p /home/ubuntu/.ssh',
      `echo '${SSH_PUBLIC_KEY}' >> /home/ubuntu/.ssh/authorized_keys`,
      'chown -R ubuntu:ubuntu /home/ubuntu/.ssh',
      'chmod 700 /home/ubuntu/.ssh',
      'chmod 600 /home/ubuntu/.ssh/authorized_keys',

      // ── Claude Code ───────────────────────────────────────────────────────
      'sudo -u ubuntu bash -c "curl -fsSL https://claude.ai/install.sh | bash"',

      // ── Bun (required for Telegram plugin) ───────────────────────────────
      'sudo -u ubuntu bash -c "curl -fsSL https://bun.sh/install | bash"',
      'ln -sf /home/ubuntu/.bun/bin/bun /usr/local/bin/bun',

      // ── AWS CDK + tools ───────────────────────────────────────────────────
      'sudo -u ubuntu bash -c "npm install -g aws-cdk typescript ts-node"',

      // ── Workspace ─────────────────────────────────────────────────────────
      'sudo -u ubuntu bash -c "mkdir -p /home/ubuntu/giuliowd"',

      // ── start-claude-channels.sh ──────────────────────────────────────────
      `cat > /home/ubuntu/start-claude-channels.sh << 'SCRIPT'`,
      '#!/bin/bash',
      'tmux kill-session -t claude-channels 2>/dev/null || true',
      'sleep 1',
      `tmux new-session -d -s claude-channels \\`,
      `  -e TELEGRAM_BOT_TOKEN=${telegramToken} \\`,
      '  -e PATH=/home/ubuntu/.bun/bin:/home/ubuntu/.local/bin:/usr/local/bin:/usr/bin:/bin \\',
      '  -e HOME=/home/ubuntu \\',
      '  "/home/ubuntu/.local/bin/claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions"',
      '# Accept workspace trust dialog',
      'sleep 5',
      "tmux send-keys -t claude-channels '' Enter",
      '# Keep running while tmux session is alive (systemd tracks this process)',
      'while tmux has-session -t claude-channels 2>/dev/null; do',
      '  sleep 10',
      'done',
      'SCRIPT',
      'chmod +x /home/ubuntu/start-claude-channels.sh',
      'chown ubuntu:ubuntu /home/ubuntu/start-claude-channels.sh',

      // ── watchdog: restart if bun plugin dies ─────────────────────────────
      `cat > /home/ubuntu/watchdog-claude.sh << 'SCRIPT'`,
      '#!/bin/bash',
      'if systemctl is-active --quiet claude-channels; then',
      '  if ! pgrep -u ubuntu -f "bun.*server.ts" > /dev/null; then',
      '    echo "$(date): bun not running, restarting" >> /home/ubuntu/watchdog.log',
      '    systemctl restart claude-channels',
      '  fi',
      'fi',
      'SCRIPT',
      'chmod +x /home/ubuntu/watchdog-claude.sh',
      'chown ubuntu:ubuntu /home/ubuntu/watchdog-claude.sh',

      // ── compact: prevent context overflow ────────────────────────────────
      `cat > /home/ubuntu/compact-claude.sh << 'SCRIPT'`,
      '#!/bin/bash',
      'if tmux has-session -t claude-channels 2>/dev/null; then',
      "  tmux send-keys -t claude-channels '/compact' Enter",
      '  echo "$(date): sent /compact" >> /home/ubuntu/compact.log',
      'fi',
      'SCRIPT',
      'chmod +x /home/ubuntu/compact-claude.sh',
      'chown ubuntu:ubuntu /home/ubuntu/compact-claude.sh',

      // ── cleanup: remove old Claude auto-update binaries ───────────────────
      `cat > /home/ubuntu/cleanup-claude-versions.sh << 'SCRIPT'`,
      '#!/bin/bash',
      'VERSIONS_DIR="/home/ubuntu/.local/share/claude/versions"',
      '[ -d "$VERSIONS_DIR" ] && ls -t "$VERSIONS_DIR" | tail -n +3 | xargs -I{} rm -f "$VERSIONS_DIR/{}"',
      'rm -rf /home/ubuntu/.cache/pip /home/ubuntu/.npm 2>/dev/null || true',
      'SCRIPT',
      'chmod +x /home/ubuntu/cleanup-claude-versions.sh',
      'chown ubuntu:ubuntu /home/ubuntu/cleanup-claude-versions.sh',

      // ── sudoers: allow watchdog to restart service ────────────────────────
      "echo 'ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart claude-channels' > /etc/sudoers.d/claude-watchdog",

      // ── crontab ───────────────────────────────────────────────────────────
      '(crontab -u ubuntu -l 2>/dev/null; echo "*/5 * * * * /home/ubuntu/watchdog-claude.sh") | crontab -u ubuntu -',
      '(crontab -u ubuntu -l 2>/dev/null; echo "0 */3 * * * /home/ubuntu/compact-claude.sh") | crontab -u ubuntu -',
      '(crontab -u ubuntu -l 2>/dev/null; echo "0 3 * * * /home/ubuntu/cleanup-claude-versions.sh") | crontab -u ubuntu -',

      // ── systemd service ───────────────────────────────────────────────────
      `cat > /etc/systemd/system/claude-channels.service << 'SERVICE'`,
      '[Unit]',
      'Description=Claude Code Telegram Channels',
      'After=network.target',
      '[Service]',
      'Type=simple',
      'User=ubuntu',
      'WorkingDirectory=/home/ubuntu/giuliowd',
      'Environment=HOME=/home/ubuntu',
      'Restart=always',
      'RestartSec=30',
      'ExecStart=/home/ubuntu/start-claude-channels.sh',
      '[Install]',
      'WantedBy=multi-user.target',
      'SERVICE',
      'systemctl daemon-reload',
      // Enable but don't start — needs `claude login` first
      'systemctl enable claude-channels',

      // ── Done ──────────────────────────────────────────────────────────────
      'echo "Bootstrap complete. SSH in and run: claude login, then: sudo systemctl start claude-channels"',
    );

    const instance = new ec2.Instance(this, 'Instance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.fromSsmParameter(
        '/aws/service/canonical/ubuntu/server/22.04/stable/current/arm64/hvm/ebs-gp2/ami-id',
      ),
      securityGroup: sg,
      role,
      userData,
      blockDevices: [{
        deviceName: '/dev/sda1',
        // 10GB — Claude auto-updates daily (~226MB each), cleanup cron keeps it under control
        volume: ec2.BlockDeviceVolume.ebs(10, { volumeType: ec2.EbsDeviceVolumeType.GP3 }),
      }],
    });

    const eip = new ec2.CfnEIP(this, 'EIP', {
      instanceId: instance.instanceId,
    });

    new cdk.CfnOutput(this, 'PublicIP', { value: eip.ref });
    new cdk.CfnOutput(this, 'SSH', { value: `ssh ubuntu@${eip.ref}` });
    new cdk.CfnOutput(this, 'NextStep', {
      value: 'SSH in → run "claude login" → sudo systemctl start claude-channels',
    });
  }
}
