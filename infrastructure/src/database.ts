import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

// We pass in the VPC components we just created so the database knows where to live.
export function createDatabase(
    projectCode: string,
    environment: string,
    vpcId: pulumi.Input<string>,
    isolatedSubnetIds: pulumi.Input<string[]>
) {
    // Optional: CI/CD configuration. 
    // If a 'restoreSnapshotId' is provided, the database will be created directly from that specific RDS snapshot.
    // If a 'cloneSourceClusterId' is provided, we perform an ultra-fast copy-on-write clone from an existing running cluster (like Prod).
    const config = new pulumi.Config();
    const restoreSnapshotId = config.get("restoreSnapshotId");
    const cloneSourceClusterId = config.get("cloneSourceClusterId");

    // 1. Database Subnet Group
    // This physically restricts the database to our "Isolated" subnets, which we 
    // already locked to the 2 specific Availability Zones (NCP aligned).
    const dbSubnetGroup = new aws.rds.SubnetGroup(`${projectCode}-${environment}-db-subnet`, {
        subnetIds: isolatedSubnetIds,
        tags: {
            Name: `${projectCode}-${environment}-db-subnets`,
        },
    });

    // 2. Security Group
    // We only allow traffic on port 5432 (PostgreSQL) from *within* the VPC. 
    // No one from the internet can reach this database.
    const dbSecurityGroup = new aws.ec2.SecurityGroup(`${projectCode}-${environment}-db-sg`, {
        vpcId: vpcId,
        ingress: [{
            protocol: "tcp",
            fromPort: 5432,
            toPort: 5432,
            cidrBlocks: ["10.0.0.0/16"], // Assuming default VPC CIDR from awsx
        }],
        tags: {
            Name: `${projectCode}-${environment}-db-sg`,
        }
    });

    // 3. Automated Secrets Management
    // We generate a secure random password for the database ONLY if we are booting a brand-new cluster.
    // If we are restoring from a snapshot or cloning, the master password is fundamentally baked into the copied data,
    // so AWS ignores the `masterPassword` field. We generate one anyway just to satisfy the Pulumi type system,
    // but in a cloning/restoration scenario, you rely on the `applyImmediately: true` flag to override it.
    const dbPassword = new random.RandomPassword(`${projectCode}-${environment}-db-password`, {
        length: 24,
        special: false, // RDS can be picky with certain special chars, safer to disable or restrict
    });

    // We store that random password safely in AWS Secrets Manager.
    const dbSecret = new aws.secretsmanager.Secret(`${projectCode}-${environment}-db-secret`, {
        name: `${projectCode}/${environment}/database/password`,
        description: `Database admin password for ${environment}`,
    });

    new aws.secretsmanager.SecretVersion(`${projectCode}-${environment}-db-secret-version`, {
        secretId: dbSecret.id,
        secretString: dbPassword.result,
    });

    // 4. Aurora Serverless v2 Cluster
    // Aurora differs from standard RDS. You first create a "Cluster" which manages the storage volume.
    const cluster = new aws.rds.Cluster(`${projectCode}-${environment}-db-cluster`, {
        engine: "aurora-postgresql",
        engineMode: "provisioned", // Required for Serverless v2
        engineVersion: "16.6",     // Use a supported, recent version of Postgres in ap-northeast-2
        masterUsername: "postgres_admin",
        masterPassword: dbPassword.result,

        // BOOT FROM SNAPSHOT (If restoring a backup)
        snapshotIdentifier: environment !== "prod" ? restoreSnapshotId : undefined,

        // BOOT FROM CLONE (Ultra-fast copy-on-write from a live cluster)
        restoreToPointInTime: environment !== "prod" && cloneSourceClusterId ? {
            sourceClusterIdentifier: cloneSourceClusterId,
            restoreType: "copy-on-write",
            useLatestRestorableTime: true,
        } : undefined,

        // Forces AWS to immediately override the copied data's old password with our new Pulumi-generated dbPassword
        applyImmediately: true,
        dbSubnetGroupName: dbSubnetGroup.name,
        vpcSecurityGroupIds: [dbSecurityGroup.id],

        // This is the magic for Serverless v2. 
        // 1 ACU (Aurora Capacity Unit) = ~2GB RAM.
        // In Dev, we might cap this at 2. In Prod, 64 or 128.
        serverlessv2ScalingConfiguration: {
            minCapacity: environment === "prod" ? 2.0 : 0.5,
            maxCapacity: environment === "prod" ? 128.0 : 2.0,
        },

        // Skip final snapshot in dev to save time/money when testing teardowns
        skipFinalSnapshot: environment !== "prod",

        // Physically prevent accidental deletion of the production database
        deletionProtection: environment === "prod",
    });

    // 5. Cluster Instances (Compute Nodes)
    // We want exactly 2 instances in total: 1 Writer, 1 Reader (replica).
    // Aurora handles the load balancing across Readers automatically via the Reader Endpoint.
    const instanceCount = 2;
    const instances = [];
    for (let i = 0; i < instanceCount; i++) {
        instances.push(new aws.rds.ClusterInstance(`${projectCode}-${environment}-db-instance-${i}`, {
            clusterIdentifier: cluster.id,
            instanceClass: "db.serverless", // Triggers Serverless v2 scaling
            engine: cluster.engine as pulumi.Output<aws.rds.EngineType>,
            engineVersion: cluster.engineVersion,
            dbSubnetGroupName: dbSubnetGroup.name,

            // Enable Performance Insights in production for deep SQL query analytics
            performanceInsightsEnabled: environment === "prod",
            // We can even explicitly pin them to different AZs if we wanted, 
            // but just leaving it blank allows RDS to distribute them automatically across our subnets.
        }));
    }

    // 6. Application and Developer Users (Secrets only)
    // RDS Proxy requires that every user connecting through it has their credentials stored in Secrets Manager.
    // NOTE: Creating the secret here does NOT create the user inside PostgreSQL! 
    // You still must log into the DB once as admin and run:
    // CREATE USER app_user WITH PASSWORD '...'; GRANT rds_iam TO app_user;

    // App User (For ECS containers)
    const appPassword = new random.RandomPassword(`${projectCode}-${environment}-app-password`, {
        length: 24, special: false,
    });
    const appSecret = new aws.secretsmanager.Secret(`${projectCode}-${environment}-app-secret`, {
        name: `${projectCode}/${environment}/database/app_user`,
        description: `App user credentials for ${environment}`,
    });
    new aws.secretsmanager.SecretVersion(`${projectCode}-${environment}-app-secret-version`, {
        secretId: appSecret.id,
        // RDS Proxy specifically expects the secret string to be a JSON object containing "username" and "password"
        secretString: pulumi.interpolate`{"username": "app_user", "password": "${appPassword.result}"}`,
    });

    // Dev User (For local SSM connections)
    const devPassword = new random.RandomPassword(`${projectCode}-${environment}-dev-password`, {
        length: 24, special: false,
    });
    const devSecret = new aws.secretsmanager.Secret(`${projectCode}-${environment}-dev-secret`, {
        name: `${projectCode}/${environment}/database/dev_user`,
        description: `Developer user credentials for ${environment}`,
    });
    new aws.secretsmanager.SecretVersion(`${projectCode}-${environment}-dev-secret-version`, {
        secretId: devSecret.id,
        secretString: pulumi.interpolate`{"username": "dev_user", "password": "${devPassword.result}"}`,
    });

    // 7. RDS Proxy setup
    // RDS Proxy needs its own IAM Role to access Secrets Manager so it can authenticate connections.
    const proxyIamRole = new aws.iam.Role(`${projectCode}-${environment}-rds-proxy-role`, {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "rds.amazonaws.com" }),
    });

    new aws.iam.RolePolicy(`${projectCode}-${environment}-rds-proxy-policy`, {
        role: proxyIamRole.id,
        policy: {
            Version: "2012-10-17",
            Statement: [{
                Action: ["secretsmanager:GetSecretValue"],
                Effect: "Allow",
                Resource: [
                    dbSecret.arn,
                    appSecret.arn,
                    devSecret.arn
                ], // The proxy is allowed to read all three secrets
            }],
        },
    });

    // Finally, create the proxy itself
    const proxy = new aws.rds.Proxy(`${projectCode}-${environment}-db-proxy`, {
        engineFamily: "POSTGRESQL",
        vpcSecurityGroupIds: [dbSecurityGroup.id],
        vpcSubnetIds: isolatedSubnetIds,
        roleArn: proxyIamRole.arn,
        auths: [
            {
                authScheme: "SECRETS",
                iamAuth: "DISABLED", // For the admin user, we might leave IAM disabled internally
                secretArn: dbSecret.arn,
            },
            {
                authScheme: "SECRETS",
                iamAuth: "REQUIRED", // Enforce IAM auth for the app_user
                secretArn: appSecret.arn,
            },
            {
                authScheme: "SECRETS",
                iamAuth: "REQUIRED", // Enforce IAM auth for the dev_user
                secretArn: devSecret.arn,
            }
        ],
        requireTls: true, // Force encrypted connections
    });

    // Attach the proxy to our cluster
    new aws.rds.ProxyDefaultTargetGroup(`${projectCode}-${environment}-proxy-tg`, {
        dbProxyName: proxy.name,
        connectionPoolConfig: {
            maxConnectionsPercent: 100, // Use all available connections of the cluster
        },
    });

    new aws.rds.ProxyTarget(`${projectCode}-${environment}-proxy-target`, {
        dbProxyName: proxy.name,
        targetGroupName: "default",
        dbClusterIdentifier: cluster.id,
    });

    // 7. Horizontal Auto Scaling for Readers
    // Here we tell AWS Application Auto Scaling to dynamically provision MORE
    // new reader instances if average CPU across existing instances hits a threshold.
    if (environment === "prod") {
        const target = new aws.appautoscaling.Target(`${projectCode}-${environment}-db-scale-target`, {
            serviceNamespace: "rds",
            scalableDimension: "rds:cluster:ReadReplicaCount",
            resourceId: pulumi.interpolate`cluster:${cluster.id}`,
            minCapacity: 1, // Minimum number of replicas (besides the Writer)
            maxCapacity: 15, // Aurora allows up to 15 Reader nodes
        });

        new aws.appautoscaling.Policy(`${projectCode}-${environment}-db-scale-policy`, {
            serviceNamespace: target.serviceNamespace,
            scalableDimension: target.scalableDimension,
            resourceId: target.resourceId,
            policyType: "TargetTrackingScaling",
            targetTrackingScalingPolicyConfiguration: {
                targetValue: 70.0, // Scale up if average CPU > 70%
                predefinedMetricSpecification: {
                    predefinedMetricType: "RDSReaderAverageCPUUtilization",
                },
                scaleInCooldown: 300, // Wait 5 mins before removing nodes when traffic drops
                scaleOutCooldown: 60, // React quickly (1 min) when traffic spikes
            },
        });
    }

    // We expose the proxy endpoint instead of the raw cluster endpoint.
    return { cluster, instances, dbSecurityGroup, dbSecret, proxyEndpoint: proxy.endpoint };
}
