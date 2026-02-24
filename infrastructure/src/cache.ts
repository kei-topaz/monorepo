import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// Establish ElastiCache Serverless in the same VPC and Isolated Subnets
export function createCache(
    projectCode: string,
    environment: string,
    vpcId: pulumi.Input<string>,
    isolatedSubnetIds: pulumi.Input<string[]>
) {
    // 1. Security Group
    // Redis traditionally runs on port 6379. We only allow access to this cache from inside the VPC.
    const cacheSecurityGroup = new aws.ec2.SecurityGroup(`${projectCode}-${environment}-cache-sg`, {
        vpcId: vpcId,
        ingress: [{
            protocol: "tcp",
            fromPort: 6379,
            toPort: 6379,
            cidrBlocks: ["10.0.0.0/16"], // Assuming default VPC CIDR
        }],
        tags: {
            Name: `${projectCode}-${environment}-cache-sg`,
        }
    });

    // 2. Serverless Cache Cluster
    // ElastiCache Serverless completely hides node management. You don't pick instance types.
    // You only pay for the data stored (GB/month) and data processed (ECPU/month).
    const serverlessCache = new aws.elasticache.ServerlessCache(`${projectCode}-${environment}-cache`, {
        engine: "redis",
        // We link it to the exact same isolated subnets the database lives in
        subnetIds: isolatedSubnetIds,
        securityGroupIds: [cacheSecurityGroup.id],

        // Limits:
        // In Dev, we restrict it tightly so we don't accidentally run up a bill with a bug.
        // In Prod, we give it higher limits to handle true scale.
        cacheUsageLimits: {
            dataStorage: {
                maximum: environment === "prod" ? 50 : 1, // GB
                unit: "GB",
            },
            ecpuPerSeconds: [{
                maximum: environment === "prod" ? 50000 : 5000,
            }]
        },

        // Optional but recommended for production security
        description: `Serverless Redis for ${environment}`,
    });

    return { serverlessCache, cacheSecurityGroup };
}
