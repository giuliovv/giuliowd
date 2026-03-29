import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface StaticSiteStackProps extends cdk.StackProps {
  siteName: string;
  contentPath: string;
}

export class StaticSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StaticSiteStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: `${props.siteName}-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      // SPA support: route 404s back to index.html
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    new s3deploy.BucketDeployment(this, 'Deploy', {
      sources: [s3deploy.Source.asset(props.contentPath)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'URL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL for the site',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket name',
    });
  }
}
