import * as awsx from "@pulumi/awsx";
import * as aws from "@pulumi/aws";

// A function to create the VPC based on the environment (dev or prod)
// We also pass the exact Availability Zones we want to align with NCP.
export function createVpc(
    projectCode: string,
    environment: string,
    targetAzs: string[]
) {
    // 1. NAT Gateways (Network Address Translation)
    // These allow resources in the 'Private Subnets' to talk to the internet (e.g. to download Docker images)
    // but block the internet from talking directly to them.
    // Cost saving: In Dev, we only use 1. In Prod, we use 1 for each AZ to ensure high availability.
    const natGateways = environment === "prod" ? 2 : 1;

    // 2. The VPC itself
    // We use `@pulumi/awsx` because it provides "higher-level" components.
    // Writing this in raw `@pulumi/aws` or CloudFormation would take over 100 lines of code just
    // to wire up route tables, internet gateways, and subnets. awsx does it automatically.
    const vpc = new awsx.ec2.Vpc(`${projectCode}-${environment}-vpc`, {
        // We pass the exact AZ names we want to use to align with NCP latency requirements.
        availabilityZoneNames: targetAzs,
        subnetStrategy: "Auto",

        // 3. Subnet Strategy
        subnetSpecs: [
            {
                type: awsx.ec2.SubnetType.Public,
                name: "public",
            },
            {
                type: awsx.ec2.SubnetType.Private,
                name: "private",
            },
            {
                type: awsx.ec2.SubnetType.Isolated,
                name: "isolated",
            }
        ],
        natGateways: {
            strategy: natGateways === 1
                ? awsx.ec2.NatGatewayStrategy.Single
                : awsx.ec2.NatGatewayStrategy.OnePerAz,
        },
    });

    return vpc;
}
