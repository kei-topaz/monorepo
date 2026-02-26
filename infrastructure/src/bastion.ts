import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

/**
 * Creates a lightweight EC2 instance to act as an SSM Bastion Host.
 * This allows developers to securely port-forward from their local machines
 * into the isolated VPC to access the database without exposing it to the internet.
 * 
 * @param projectCode The unique identifier for the project (e.g., 'chassis')
 * @param environment The environment name (e.g., 'dev', 'prod')
 * @param vpcId The ID of the VPC to launch the bastion in
 * @param privateSubnetId The ID of a private subnet to launch the bastion in
 * @returns An object containing the bastion instance and its security group
 */
export function createSsmBastion(
    projectCode: string,
    environment: string,
    vpcId: pulumi.Input<string>,
    privateSubnetId: pulumi.Input<string>
) {
    // 1. Bastion Security Group
    // The bastion needs NO inbound rules. SSM Agent reaches OUT to AWS endpoints.
    const bastionSecurityGroup = new aws.ec2.SecurityGroup(`${projectCode}-${environment}-bastion-sg`, {
        vpcId: vpcId,
        description: "Security group for SSM Bastion Host",
        ingress: [], // No inbound internet access required for SSM!
        egress: [{
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
        }],
        tags: {
            Name: `${projectCode}-${environment}-bastion-sg`,
            Environment: environment,
        },
    });

    // 2. IAM Role for SSM
    // This allows the EC2 instance to securely register itself with the AWS Systems Manager service
    const bastionRole = new aws.iam.Role(`${projectCode}-${environment}-bastion-role`, {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "ec2.amazonaws.com" }),
    });

    // Attach the core AmazonSSMManagedInstanceCore policy
    new aws.iam.RolePolicyAttachment(`${projectCode}-${environment}-bastion-ssm-policy`, {
        role: bastionRole.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    });

    // Create an Instance Profile to attach the role to the physical EC2 instance
    const bastionProfile = new aws.iam.InstanceProfile(`${projectCode}-${environment}-bastion-profile`, {
        role: bastionRole.name,
    });

    // 3. Find the latest Amazon Linux 2023 ARM64 AMI
    // We use ARM64 (Graviton) because the t4g series is significantly cheaper and faster
    const al2023Ami = aws.ec2.getAmiOutput({
        filters: [
            { name: "name", values: ["al2023-ami-2023.*-arm64"] },
            { name: "virtualization-type", values: ["hvm"] },
        ],
        owners: ["137112412989"], // Amazon
        mostRecent: true,
    });

    // 4. Create the tiny Bastion EC2 Instance
    const bastionInstance = new aws.ec2.Instance(`${projectCode}-${environment}-bastion`, {
        ami: al2023Ami.id,
        instanceType: "t4g.nano", // The cheapest Graviton instance (~$3/month)
        subnetId: privateSubnetId,
        vpcSecurityGroupIds: [bastionSecurityGroup.id],
        iamInstanceProfile: bastionProfile.name,
        // No SSH Key Pair is assigned because we use SSM exclusively!
        tags: {
            Name: `${projectCode}-${environment}-bastion`,
            Environment: environment,
        },
    });

    return { bastionInstance, bastionSecurityGroup };
}
