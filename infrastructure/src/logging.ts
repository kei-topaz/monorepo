import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// Creates the ALB access logs infrastructure: S3 bucket, bucket policy, and Athena query setup.
// Returns the access logs bucket for the ALB to reference.
export function createAlbAccessLogs(
    projectCode: string,
    environment: string,
) {
    const region = aws.getRegionOutput();
    const callerIdentity = aws.getCallerIdentityOutput();

    // 1. ALB Access Logs Bucket
    const accessLogsBucket = new aws.s3.BucketV2(`${projectCode}-${environment}-alb-logs`, {
        forceDestroy: environment !== "prod",
        tags: {
            Name: `${projectCode}-${environment}-alb-logs`,
            Project: projectCode,
            Environment: environment,
        },
    });

    new aws.s3.BucketLifecycleConfigurationV2(`${projectCode}-${environment}-alb-logs-lifecycle`, {
        bucket: accessLogsBucket.id,
        rules: [{
            id: "expire-old-logs",
            status: "Enabled",
            expiration: { days: environment === "prod" ? 90 : 14 },
        }],
    });

    // ALB access logs require a specific bucket policy granting the regional ELB account write access
    const elbAccountId = region.name.apply(r => {
        // AWS ELB account IDs per region: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html
        const accounts: Record<string, string> = {
            "us-east-1": "127311923021",
            "us-east-2": "033677994240",
            "us-west-1": "027434742980",
            "us-west-2": "797873946194",
            "ap-northeast-1": "582318560864",
            "ap-northeast-2": "600734575887",
            "ap-southeast-1": "114774131450",
            "ap-southeast-2": "783225319266",
            "eu-central-1": "054676820928",
            "eu-west-1": "156460612806",
        };
        return accounts[r] || "600734575887"; // fallback to ap-northeast-2
    });

    new aws.s3.BucketPolicy(`${projectCode}-${environment}-alb-logs-policy`, {
        bucket: accessLogsBucket.id,
        policy: pulumi.jsonStringify({
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Principal: { AWS: pulumi.interpolate`arn:aws:iam::${elbAccountId}:root` },
                Action: "s3:PutObject",
                Resource: pulumi.interpolate`${accessLogsBucket.arn}/AWSLogs/${callerIdentity.accountId}/*`,
            }],
        }),
    });

    // 2. Athena setup for querying ALB access logs via SQL
    // The database and table are free metadata — you only pay per query ($5/TB scanned).
    const athenaResultsBucket = new aws.s3.BucketV2(`${projectCode}-${environment}-athena-results`, {
        forceDestroy: environment !== "prod",
        tags: {
            Name: `${projectCode}-${environment}-athena-results`,
            Project: projectCode,
            Environment: environment,
        },
    });

    new aws.s3.BucketLifecycleConfigurationV2(`${projectCode}-${environment}-athena-results-lifecycle`, {
        bucket: athenaResultsBucket.id,
        rules: [{
            id: "expire-query-results",
            status: "Enabled",
            expiration: { days: 7 },
        }],
    });

    const athenaWorkgroup = new aws.athena.Workgroup(`${projectCode}-${environment}-athena-workgroup`, {
        name: `${projectCode}-${environment}-alb-logs`,
        forceDestroy: environment !== "prod",
        configuration: {
            resultConfiguration: {
                outputLocation: pulumi.interpolate`s3://${athenaResultsBucket.bucket}/results/`,
            },
        },
        tags: {
            Project: projectCode,
            Environment: environment,
        },
    });

    const athenaDatabase = new aws.athena.Database(`${projectCode}-${environment}-athena-db`, {
        name: `${projectCode}_${environment}_alb_logs`.replace(/-/g, "_"),
        bucket: athenaResultsBucket.bucket,
    });

    // ALB access log table schema per AWS docs:
    // https://docs.aws.amazon.com/athena/latest/ug/application-load-balancer-logs.html
    new aws.athena.NamedQuery(`${projectCode}-${environment}-create-alb-table`, {
        name: `${projectCode}-${environment}-create-alb-logs-table`,
        workgroup: athenaWorkgroup.name,
        database: athenaDatabase.name,
        query: pulumi.interpolate`
CREATE EXTERNAL TABLE IF NOT EXISTS alb_logs (
    type string,
    time string,
    elb string,
    client_ip string,
    client_port int,
    target_ip string,
    target_port int,
    request_processing_time double,
    target_processing_time double,
    response_processing_time double,
    elb_status_code int,
    target_status_code string,
    received_bytes bigint,
    sent_bytes bigint,
    request_verb string,
    request_url string,
    request_proto string,
    user_agent string,
    ssl_cipher string,
    ssl_protocol string,
    target_group_arn string,
    trace_id string,
    domain_name string,
    chosen_cert_arn string,
    matched_rule_priority string,
    request_creation_time string,
    actions_executed string,
    redirect_url string,
    lambda_error_reason string,
    target_port_list string,
    target_status_code_list string,
    classification string,
    classification_reason string,
    conn_trace_id string
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.RegexSerDe'
WITH SERDEPROPERTIES (
    'serialization.format' = '1',
    'input.regex' = '([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*):([0-9]*) ([^ ]*)[:-]([0-9]*) ([-.0-9]*) ([-.0-9]*) ([-.0-9]*) (|[0-9]*) (-|[0-9]*) ([-0-9]*) ([-0-9]*) \"([^ ]*) (.*) (- |[^ ]*)\" \"([^\"]*)\" ([A-Z0-9-_]+) ([A-Za-z0-9.-]*) ([^ ]*) \"([^\"]*)\" \"([^\"]*)\" \"([^\"]*)\" ([-.0-9]*) ([^ ]*) \"([^\"]*)\" \"([^\"]*)\" \"([^ ]*)\" \"([^\\s]*)\" \"([^ ]*)\" \"([^ ]*)\" \"([^ ]*)\" ([^ ]*)'
)
LOCATION 's3://${accessLogsBucket.bucket}/AWSLogs/${callerIdentity.accountId}/elasticloadbalancing/${region.name}/'
`,
    });

    return { accessLogsBucket };
}

// Creates a CloudWatch Log Group for an ECS service
export function createServiceLogGroup(
    projectCode: string,
    environment: string,
    serviceCode: string,
) {
    const logGroup = new aws.cloudwatch.LogGroup(`${projectCode}-${environment}-${serviceCode}-logs`, {
        name: `/ecs/${projectCode}-${environment}-${serviceCode}`,
        retentionInDays: environment === "prod" ? 30 : 7,
        tags: {
            Project: projectCode,
            Environment: environment,
        },
    });

    return logGroup;
}

// Enables Aurora PostgreSQL log exports to CloudWatch
export function createDatabaseLogs(
    projectCode: string,
    environment: string,
) {
    // CloudWatch Log Group for PostgreSQL logs exported from Aurora
    const dbLogGroup = new aws.cloudwatch.LogGroup(`${projectCode}-${environment}-db-postgresql-logs`, {
        name: `/aws/rds/cluster/${projectCode}-${environment}-db-cluster/postgresql`,
        retentionInDays: environment === "prod" ? 30 : 7,
        tags: {
            Project: projectCode,
            Environment: environment,
        },
    });

    return { dbLogGroup };
}
