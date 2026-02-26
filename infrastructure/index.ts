import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { createVpc } from "./src/vpc";
import { createDatabase } from "./src/database";
import { createCache } from "./src/cache";
import { createSharedCompute, createAppService } from "./src/compute";
import { createEcrRepository } from "./src/ecr";
// import { createSecurityNotifications } from "./src/notifications";

// 1. Core Configuration
// We pull these values from the Pulumi stack configuration (e.g. Pulumi.dev.yaml).
const config = new pulumi.Config();
const environment = config.require("environment"); // "dev" or "prod"
const projectCode = config.require("projectCode"); // e.g. "chassis"
const domainName = config.require("domainName");

// AWS Region and desired AZs for NCP alignment
const targetAzs = [
    "ap-northeast-2a",
    "ap-northeast-2c"
];

// 2. Map the Stacks
// Networking
const vpcStack = createVpc(projectCode, environment, targetAzs);

// Security Notifications (EventBridge -> SNS)
// Uncomment the line below to provision an SNS topic that alerts on ECR scanning vulnerabilities. 
// You can subscribe your email or a Slack webhook to this topic via the AWS Console later. 
// const notificationsStack = createSecurityNotifications(projectCode, environment);

// Data Layer
const dbStack = createDatabase(
    projectCode,
    environment,
    vpcStack.vpcId,
    vpcStack.isolatedSubnetIds
);

const cacheStack = createCache(
    projectCode,
    environment,
    vpcStack.vpcId,
    vpcStack.isolatedSubnetIds
);

const cacheEndpointUrl = cacheStack.redisCluster.primaryEndpointAddress;

// ACM Certificate Lookup (Now strictly required for deployment)
// Pulumi will automatically fetch the latest ISSUED certificate for this domain and attach it to the ALB.
const cert = aws.acm.getCertificate({
    domain: domainName, // Fetches the certificate by its primary domain name
    mostRecent: true,
    statuses: ["ISSUED"],
});
const certificateArn: pulumi.Input<string> = cert.then(c => c.arn);

// Shared Compute Layer (Cluster & ALB)
const sharedCompute = createSharedCompute(
    projectCode,
    environment,
    vpcStack.vpcId,
    vpcStack.publicSubnetIds,
    certificateArn // The ALB now explicitly requires this ARN to boot Port 443
);

const isProd = environment === "prod";

// Individual ECR Repositories
const apiEcrRepo = createEcrRepository(projectCode, environment, "service");
const adminEcrRepo = createEcrRepository(projectCode, environment, "admin");

// Individual Services (Service and Admin)
const apiService = createAppService(
    projectCode,
    environment,
    "service",
    vpcStack.vpcId,
    vpcStack.privateSubnetIds,
    sharedCompute.cluster.arn,
    sharedCompute.albSecurityGroup.id,
    sharedCompute.listener.arn,
    "/service/*", // Routing path for API
    8080,         // Container port
    apiEcrRepo.repositoryUrl,
    dbStack.proxyEndpoint,
    cacheEndpointUrl,
    isProd ? "1024" : "512",
    isProd ? "2048" : "1024"
);

const adminService = createAppService(
    projectCode,
    environment,
    "admin",
    vpcStack.vpcId,
    vpcStack.privateSubnetIds,
    sharedCompute.cluster.arn,
    sharedCompute.albSecurityGroup.id,
    sharedCompute.listener.arn,
    "/admin/*", // Routing path for Admin
    8081,       // Container port (can be 8080 as well)
    adminEcrRepo.repositoryUrl,
    dbStack.proxyEndpoint,
    cacheEndpointUrl,
    isProd ? "1024" : "512",
    isProd ? "2048" : "1024"
);

// 3. Export the critical endpoints so we can see them when `pulumi up` finishes
export const loadBalancerUrl = sharedCompute.alb.dnsName;
export const databaseProxyEndpoint = dbStack.proxyEndpoint;
export const redisEndpoint = cacheEndpointUrl;
export const vpcId = vpcStack.vpcId;
export const apiRepoUrl = apiEcrRepo.repositoryUrl;
export const adminRepoUrl = adminEcrRepo.repositoryUrl;