import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

// Creates the shared Cluster, Application Load Balancer, and default HTTP Listener
export function createSharedCompute(
    projectCode: string,
    environment: string,
    vpcId: pulumi.Input<string>,
    publicSubnetIds: pulumi.Input<string[]>,
    certificateArn: pulumi.Input<string>
) {
    // 1. ECS Cluster (Shared across all services)
    const cluster = new aws.ecs.Cluster(`${projectCode}-${environment}-cluster`, {
        name: `${projectCode}-${environment}-cluster`,
        // Automatically collect granular CPU, memory, and network metrics for all Fargate tasks
        settings: [
            { name: "containerInsights", value: "enabled" }
        ]
    });

    // 2. Application Load Balancer (ALB) Security Group (Shared)
    const albSecurityGroup = new aws.ec2.SecurityGroup(`${projectCode}-${environment}-alb-sg`, {
        vpcId: vpcId,
        ingress: [
            { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
            { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] }
        ],
        egress: [
            { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
        ],
        tags: { Name: `${projectCode}-${environment}-alb-sg` }
    });

    // 3. Application Load Balancer (Shared)
    const alb = new aws.lb.LoadBalancer(`${projectCode}-${environment}-alb`, {
        internal: false,
        securityGroups: [albSecurityGroup.id],
        subnets: publicSubnetIds,
        loadBalancerType: "application",
        // Security best practice: drop malformed headers to prevent HTTP desync/smuggling attacks
        dropInvalidHeaderFields: true,
    });

    // 3. Application Load Balancer Listeners
    // Listener 1: Port 80 (HTTP)
    // This listener's ONLY job is to aggressively redirect all insecure traffic to HTTPS (Port 443)
    const httpListener = new aws.lb.Listener(`${projectCode}-${environment}-http-listener`, {
        loadBalancerArn: alb.arn,
        port: 80,
        protocol: "HTTP",
        defaultActions: [{
            type: "redirect",
            redirect: {
                port: "443",
                protocol: "HTTPS",
                statusCode: "HTTP_301", // Permanent Redirect
            },
        }],
    });

    // Listener 2: Port 443 (HTTPS)
    // This is the main traffic handler. It returns 404 until a specific service routing rule matches.
    const httpsListener = new aws.lb.Listener(`${projectCode}-${environment}-https-listener`, {
        loadBalancerArn: alb.arn,
        port: 443,
        protocol: "HTTPS",
        certificateArn: certificateArn,
        defaultActions: [{
            type: "fixed-response",
            fixedResponse: {
                contentType: "text/plain",
                messageBody: "404: Not Found",
                statusCode: "404",
            }
        }],
    });

    // We strictly return the HTTPS listener for service routes to map onto
    const listener = httpsListener;

    // 4. AWS WAF (Web Application Firewall)
    // We attach a WAF directly to the ALB to block bad actors and common exploits like SQLi automatically.
    const wafAcl = new aws.wafv2.WebAcl(`${projectCode}-${environment}-waf`, {
        defaultAction: { allow: {} },
        scope: "REGIONAL", // ALBs require REGIONAL scope, unlike CloudFront which requires CLOUDFRONT scope.
        visibilityConfig: {
            cloudwatchMetricsEnabled: true,
            metricName: `${projectCode}-${environment}-waf-metric`,
            sampledRequestsEnabled: true,
        },
        rules: [
            {
                // Custom rule to strictly rate limit the /admin/ paths
                name: "AdminPathRateLimit",
                priority: 0,
                action: { block: {} },
                statement: {
                    rateBasedStatement: {
                        limit: 100, // Trigger block if > 100 requests per 5 minutes from a single IP
                        aggregateKeyType: "IP",
                        scopeDownStatement: {
                            byteMatchStatement: {
                                searchString: "/admin/",
                                fieldToMatch: { uriPath: {} },
                                textTransformations: [
                                    { priority: 0, type: "LOWERCASE" } // Case-insensitive match
                                ],
                                positionalConstraint: "STARTS_WITH",
                            }
                        }
                    }
                },
                visibilityConfig: {
                    cloudwatchMetricsEnabled: true,
                    metricName: "AdminPathRateLimitMetric",
                    sampledRequestsEnabled: true,
                }
            },
            {
                name: "AWS-AWSManagedRulesCommonRuleSet",
                priority: 1,
                overrideAction: { none: {} },
                statement: {
                    managedRuleGroupStatement: {
                        name: "AWSManagedRulesCommonRuleSet",
                        vendorName: "AWS",
                    },
                },
                visibilityConfig: {
                    cloudwatchMetricsEnabled: true,
                    metricName: "AWSManagedRulesCommonRuleSetMetric",
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: "AWS-AWSManagedRulesSQLiRuleSet",
                priority: 2,
                overrideAction: { none: {} },
                statement: {
                    managedRuleGroupStatement: {
                        name: "AWSManagedRulesSQLiRuleSet",
                        vendorName: "AWS",
                    },
                },
                visibilityConfig: {
                    cloudwatchMetricsEnabled: true,
                    metricName: "AWSManagedRulesSQLiRuleSetMetric",
                    sampledRequestsEnabled: true,
                },
            }
        ],
    });

    // 5. WAF Association
    new aws.wafv2.WebAclAssociation(`${projectCode}-${environment}-waf-assoc`, {
        resourceArn: alb.arn,
        webAclArn: wafAcl.arn,
    });

    return { cluster, alb, albSecurityGroup, listener };
}

// Creates an individual ECS Service (e.g., 'api' or 'admin') inside the shared Cluster
export function createAppService(
    projectCode: string,
    environment: string,
    serviceCode: string,                // e.g., "api", "admin", "worker"
    vpcId: pulumi.Input<string>,
    privateSubnetIds: pulumi.Input<string[]>,
    clusterArn: pulumi.Input<string>,
    albSecurityGroupId: pulumi.Input<string>,
    listenerArn: pulumi.Input<string>,
    pathPrefix: string,                 // e.g., "/api/*" or "/admin/*"
    containerPort: number,
    ecrRepoUrl: pulumi.Input<string>,   // The ECR repository URL
    proxyEndpoint: pulumi.Input<string>,
    cacheEndpoint: pulumi.Output<string>,
    cpu: string = "512",
    memory: string = "1024"
) {
    // 1. Service-specific Security Group
    const appSecurityGroup = new aws.ec2.SecurityGroup(`${projectCode}-${environment}-${serviceCode}-app-sg`, {
        vpcId: vpcId,
        ingress: [{
            protocol: "tcp",
            fromPort: containerPort,
            toPort: containerPort,
            securityGroups: [albSecurityGroupId], // Only trust the ALB
        }],
        egress: [
            { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
        ],
        tags: { Name: `${projectCode}-${environment}-${serviceCode}-app-sg` }
    });

    // 2. Target Group for this specific service
    const targetGroup = new aws.lb.TargetGroup(`${projectCode}-${environment}-${serviceCode}-tg`, {
        port: containerPort,
        protocol: "HTTP",
        targetType: "ip",
        vpcId: vpcId,
        healthCheck: {
            path: "/health",
            protocol: "HTTP",
            interval: 15,
            healthyThreshold: 2,
            unhealthyThreshold: 2,
        },
    });

    // 3. Listener Rule to route traffic to this service based on path matching
    new aws.lb.ListenerRule(`${projectCode}-${environment}-${serviceCode}-rule`, {
        listenerArn: listenerArn,
        actions: [{
            type: "forward",
            targetGroupArn: targetGroup.arn,
        }],
        conditions: [{
            pathPattern: {
                values: [pathPrefix],
            },
        }],
    });

    // 4. Service-specific IAM Roles
    const taskExecutionRole = new aws.iam.Role(`${projectCode}-${environment}-${serviceCode}-exec-role`, {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "ecs-tasks.amazonaws.com" }),
    });
    new aws.iam.RolePolicyAttachment(`${projectCode}-${environment}-${serviceCode}-exec-policy`, {
        role: taskExecutionRole.name,
        policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    const taskRole = new aws.iam.Role(`${projectCode}-${environment}-${serviceCode}-task-role`, {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "ecs-tasks.amazonaws.com" }),
    });
    new aws.iam.RolePolicy(`${projectCode}-${environment}-${serviceCode}-db-auth-policy`, {
        role: taskRole.id,
        policy: {
            Version: "2012-10-17",
            Statement: [{
                Action: ["rds-db:connect"],
                Effect: "Allow",
                Resource: [pulumi.interpolate`arn:aws:rds-db:*:*:dbuser:*/app_user`],
            }],
        },
    });

    // 5. ECS Task Definition & Service
    const taskDefinition = new aws.ecs.TaskDefinition(`${projectCode}-${environment}-${serviceCode}-task-def`, {
        family: `${projectCode}-${environment}-${serviceCode}`,
        cpu: cpu,
        memory: memory,
        networkMode: "awsvpc",
        requiresCompatibilities: ["FARGATE"],
        executionRoleArn: taskExecutionRole.arn,
        taskRoleArn: taskRole.arn,
        containerDefinitions: pulumi.jsonStringify([{
            name: serviceCode,
            image: pulumi.interpolate`${ecrRepoUrl}:latest`, // Automatically pull the 'latest' tagged image from ECR
            portMappings: [{ containerPort: containerPort, hostPort: containerPort }],
            environment: [
                { name: "ENVIRONMENT", value: environment },
                { name: "SERVICE_CODE", value: serviceCode },
                { name: "DB_PROXY_ENDPOINT", value: proxyEndpoint },
                { name: "DB_USERNAME", value: "app_user" },
                { name: "CACHE_ENDPOINT", value: cacheEndpoint },
            ],
            logConfiguration: {
                logDriver: "awslogs",
                options: {
                    "awslogs-group": `/ecs/${projectCode}-${environment}-${serviceCode}`,
                    "awslogs-region": "ap-northeast-2",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        }]),
    });

    const CloudWatchLogGroup = new aws.cloudwatch.LogGroup(`/ecs/${projectCode}-${environment}-${serviceCode}`, {
        retentionInDays: environment === "prod" ? 30 : 7,
    });

    const service = new aws.ecs.Service(`${projectCode}-${environment}-${serviceCode}-ecs-service`, {
        cluster: clusterArn,
        taskDefinition: taskDefinition.arn,
        desiredCount: environment === "prod" ? 2 : 1, // HA in Prod
        launchType: "FARGATE",
        deploymentCircuitBreaker: {
            enable: true,
            rollback: true,
        },
        networkConfiguration: {
            assignPublicIp: false,
            subnets: privateSubnetIds,
            securityGroups: [appSecurityGroup.id],
        },
        loadBalancers: [{
            targetGroupArn: targetGroup.arn,
            containerName: serviceCode,
            containerPort: containerPort,
        }],
    }, { dependsOn: [CloudWatchLogGroup] });

    // 6. Application Auto Scaling for the Service
    // We only enable auto-scaling in Production to save costs in Dev.
    if (environment === "prod") {
        const scalingTarget = new aws.appautoscaling.Target(`${projectCode}-${environment}-${serviceCode}-scaling-target`, {
            maxCapacity: 50, // Maximum number of containers for this service
            minCapacity: 2,  // Minimum number for High Availability
            resourceId: pulumi.interpolate`service/${pulumi.output(clusterArn).apply((arn: string) => arn.split("/")[1])}/${service.name}`,
            scalableDimension: "ecs:service:DesiredCount",
            serviceNamespace: "ecs",
        });

        // Scale Up/Down based on CPU utilization
        new aws.appautoscaling.Policy(`${projectCode}-${environment}-${serviceCode}-cpu-policy`, {
            policyType: "TargetTrackingScaling",
            resourceId: scalingTarget.resourceId,
            scalableDimension: scalingTarget.scalableDimension,
            serviceNamespace: scalingTarget.serviceNamespace,
            targetTrackingScalingPolicyConfiguration: {
                targetValue: 50.0, // Scale out if average CPU usage hits 50% (Provides maximum reliability buffer)
                predefinedMetricSpecification: {
                    predefinedMetricType: "ECSServiceAverageCPUUtilization",
                },
                scaleInCooldown: 300,  // Wait 5 minutes before removing containers to prevent thrashing
                scaleOutCooldown: 60,  // Add containers aggressively (1 minute) during high traffic
            },
        });
    }

    return { service, targetGroup };
}
