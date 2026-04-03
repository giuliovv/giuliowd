#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StaticSiteStack } from '../lib/static-site-stack';
import { ClaudeServerStack } from '../lib/claude-server-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

// Claude Code Channels server (t4g.nano, ARM64)
new ClaudeServerStack(app, 'ClaudeServer', { env });

// Static site hosting — deploy with:
// cdk deploy StaticSite-<name> --context siteName=<name> --context contentPath=<path>
const siteName = app.node.tryGetContext('siteName');
const contentPath = app.node.tryGetContext('contentPath');
if (siteName && contentPath) {
  new StaticSiteStack(app, `StaticSite-${siteName}`, { siteName, contentPath, env });
}
