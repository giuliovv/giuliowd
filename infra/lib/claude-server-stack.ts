import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

const SSH_PUBLIC_KEY = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDRvci6XqMvALIJnbpQPrNsJjFxsifxLsviQgUOEe9gHvIPBAUI8lDvsJ5zwNTLTQmHfv4bUdGdn2YMuexauIa0W70DYcjG45IXNBmU5PfADht1HxxbCku0v7yss1j0obhpJy5YC0yALjwGbde7y0QbmB4ffWOyecPH9A4KtxFdihD7NPFACnTOKjZZLfH3LDqLWoBDmBmVxhbmy9pet+MuDu9j4+XoiMe8ZqbT6j6P4Rx1r4HJ81ZtGzXCo/eZ7J4FK9D7swiP9yPn2W35xo7LlAJHjIE2lv9BS15ycqauVfcnWhPmTx/MPy8buC3+3G/vIcsUfXEocCc+tQp7Vh3kniUgVGrkJuSIvIZdjiSJZrJ++bJPioKgJTIPIOYsd5iJJi5b3QqARn4h03G/7Ng0/yLv7KGOUj/ZYPD7S80R1WpaD0z57PGsNOqiB+lEAaq7IZ+Vw2oA4kj/0SbmifWEVDkF5U7gPGZU/xZ5V2kOnkCgBmppRXSY9Glq6fBZqsc= giulio@GIULIOLP';

export class ClaudeServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    const sg = new ec2.SecurityGroup(this, 'SG', {
      vpc,
      description: 'Claude Code Channels server',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH');

    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      // 2GB swap — essential for 0.5GB RAM instance
      'fallocate -l 2G /swapfile',
      'chmod 600 /swapfile',
      'mkswap /swapfile',
      'swapon /swapfile',
      "echo '/swapfile none swap sw 0 0' >> /etc/fstab",

      // System packages
      'apt-get update -y',
      'apt-get install -y curl git tmux unzip',

      // SSH key
      'mkdir -p /home/ubuntu/.ssh',
      `echo '${SSH_PUBLIC_KEY}' >> /home/ubuntu/.ssh/authorized_keys`,
      'chown -R ubuntu:ubuntu /home/ubuntu/.ssh',
      'chmod 700 /home/ubuntu/.ssh',
      'chmod 600 /home/ubuntu/.ssh/authorized_keys',

      // Claude Code
      'curl -fsSL https://claude.ai/install.sh | sudo -u ubuntu bash',

      // Bun (required for Claude Code channel plugins)
      'sudo -u ubuntu bash -c "curl -fsSL https://bun.sh/install | bash"',

      // tmux autostart script for claude channels
      'cat > /home/ubuntu/start-claude-channels.sh << \'EOF\'',
      '#!/bin/bash',
      'tmux new-session -d -s claude "claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions >> ~/.claude-channels.log 2>&1"',
      'EOF',
      'chmod +x /home/ubuntu/start-claude-channels.sh',
      'chown ubuntu:ubuntu /home/ubuntu/start-claude-channels.sh',

      // systemd service
      'cat > /etc/systemd/system/claude-channels.service << \'EOF\'',
      '[Unit]',
      'Description=Claude Code Telegram Channels',
      'After=network.target',
      '[Service]',
      'Type=forking',
      'User=ubuntu',
      'ExecStart=/home/ubuntu/start-claude-channels.sh',
      'Restart=on-failure',
      'RestartSec=30',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      'systemctl daemon-reload',
      'systemctl enable claude-channels',
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
        volume: ec2.BlockDeviceVolume.ebs(8, { volumeType: ec2.EbsDeviceVolumeType.GP3 }),
      }],
    });

    const eip = new ec2.CfnEIP(this, 'EIP', {
      instanceId: instance.instanceId,
    });

    new cdk.CfnOutput(this, 'PublicIP', { value: eip.ref });
    new cdk.CfnOutput(this, 'SSH', { value: `ssh ubuntu@${eip.ref}` });
  }
}
