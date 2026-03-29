#!/usr/bin/env bash
# Deploy a static site to S3 + CloudFront via CDK
# Usage: deploy-site.sh <site-name> <path-to-content>
set -euo pipefail

SITE_NAME="${1:?Usage: deploy-site.sh <site-name> <path-to-content>}"
CONTENT_PATH="${2:?Usage: deploy-site.sh <site-name> <path-to-content>}"
INFRA_DIR="$(cd "$(dirname "$0")/../infra" && pwd)"

if [ ! -d "$CONTENT_PATH" ]; then
  echo "Error: content path '$CONTENT_PATH' does not exist"
  exit 1
fi

echo "==> Deploying '$SITE_NAME' from '$CONTENT_PATH'"

cd "$INFRA_DIR"
npm run build

cdk deploy "StaticSite-${SITE_NAME}" \
  --context siteName="$SITE_NAME" \
  --context contentPath="$(realpath "$CONTENT_PATH")" \
  --require-approval never

echo ""
echo "Site deployed. The CloudFront URL is shown above as 'URL' in the outputs."
