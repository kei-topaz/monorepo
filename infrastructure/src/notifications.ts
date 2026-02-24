import * as aws from "@pulumi/aws";

// Creates an AWS SNS (Simple Notification Service) Topic and an EventBridge rule 
// to instantly trigger a notification if ECR detects a HIGH or CRITICAL vulnerability.
export function createSecurityNotifications(projectCode: string, environment: string) {
    // 1. Create the SNS Topic
    // This is the broadcasting channel. We can subscribe an Email address or a Slack Webhook lambda to it.
    const securityTopic = new aws.sns.Topic(`${projectCode}-${environment}-security-alerts`, {
        name: `${projectCode}-${environment}-security-alerts.fifo`, // Using FIFO strictly to preserve order
        fifoTopic: true,
        contentBasedDeduplication: true, // Prevents spamming alerts for the same vulnerability
    });

    // 2. Create the EventBridge Rule
    // This actively listens to ECR for any "Image Scan" events that complete with findings
    const ecrScanRule = new aws.cloudwatch.EventRule(`${projectCode}-${environment}-ecr-scan-rule`, {
        name: `${projectCode}-${environment}-ecr-scan-rule`,
        description: "Triggers on ECR image scans containing HIGH or CRITICAL findings",
        eventPattern: JSON.stringify({
            source: ["aws.ecr"],
            "detail-type": ["ECR Image Scan"],
            detail: {
                "scan-status": ["COMPLETE"],
                "finding-severity-counts": {
                    // Only trigger the alert if we found at least 1 severe vulnerability
                    $or: [
                        { CRITICAL: [{ numeric: [">", 0] }] },
                        { HIGH: [{ numeric: [">", 0] }] }
                    ]
                }
            }
        }),
    });

    // 3. Connect the EventBridge Rule to the SNS Topic
    new aws.cloudwatch.EventTarget(`${projectCode}-${environment}-ecr-scan-target`, {
        rule: ecrScanRule.name,
        arn: securityTopic.arn,
    });

    // 4. Grant EventBridge permission to publish to the SNS Topic
    new aws.sns.TopicPolicy(`${projectCode}-${environment}-topic-policy`, {
        arn: securityTopic.arn,
        policy: securityTopic.arn.apply(arn => JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Principal: { Service: "events.amazonaws.com" },
                Action: "sns:Publish",
                Resource: arn,
            }],
        })),
    });

    return { securityTopic };
}
