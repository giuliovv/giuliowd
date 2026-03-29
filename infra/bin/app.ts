#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StaticSiteStack } from '../lib/static-site-stack';

const app = new cdk.App();

const siteName = app.node.tryGetContext('siteName');
const contentPath = app.node.tryGetContext('contentPath');

if (!siteName || !contentPath) {
  throw new Error(
    'Required context missing. Pass --context siteName=<name> --context contentPath=<path>'
  );
}

new StaticSiteStack(app, `StaticSite-${siteName}`, {
  siteName,
  contentPath,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});
