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
    // Ingress rules are added separately in index.ts using SecurityGroupRule resources,
    // so that app service and bastion SGs can be referenced by ID (no hardcoded CIDRs).
    const cacheSecurityGroup = new aws.ec2.SecurityGroup(`${projectCode}-${environment}-cache-sg`, {
        vpcId: vpcId,
        tags: {
            Name: `${projectCode}-${environment}-cache-sg`,
            Project: projectCode,
            Environment: environment,
        }
    });

    // 2. Cache Subnet Group
    // Needed to tell ElastiCache exactly which subnets it's allowed to launch nodes in
    const cacheSubnetGroup = new aws.elasticache.SubnetGroup(`${projectCode}-${environment}-cache-subnet`, {
        subnetIds: isolatedSubnetIds,
    });

    // 3. Provisioned Redis Replication Group
    // We provision a tiny t4g.micro instance in 2 Availability Zones for high availability.
    // If the primary node fails, AWS automatically promotes the replica.
    const redisCluster = new aws.elasticache.ReplicationGroup(`${projectCode}-${environment}-redis`, {
        engine: "redis",
        engineVersion: "7.1", // Modern Redis version
        nodeType: "cache.t4g.micro",
        numCacheClusters: environment === "prod" ? 2 : 1, // 1 Primary, 1 Replica for Multi-AZ (Prod only)
        automaticFailoverEnabled: environment === "prod", // Requires 2+ nodes
        subnetGroupName: cacheSubnetGroup.name,
        securityGroupIds: [cacheSecurityGroup.id],
        description: `Provisioned Multi-AZ Redis for ${environment}`,
        atRestEncryptionEnabled: true,
        transitEncryptionEnabled: true,
        tags: {
            Name: `${projectCode}-${environment}-redis`,
            Project: projectCode,
            Environment: environment,
        },
    });

    return { redisCluster, cacheSecurityGroup };
}
