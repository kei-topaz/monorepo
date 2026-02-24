import * as aws from "@pulumi/aws";

// Creates an Elastic Container Registry (ECR) for a specific service.
// This is where your CI/CD pipeline (e.g., GitHub Actions) will push Docker images.
export function createEcrRepository(projectCode: string, environment: string, serviceCode: string) {
    const repository = new aws.ecr.Repository(`${projectCode}-${environment}-${serviceCode}-repo`, {
        name: `${projectCode}/${environment}/${serviceCode}`,
        imageTagMutability: "MUTABLE", // Allows the 'latest' tag to be overwritten by new pushes
        forceDelete: environment !== "prod", // Allows Pulumi to delete the repo in Dev even if it contains images
        imageScanningConfiguration: {
            scanOnPush: true, // Automatically scans your Docker images for known vulnerabilities (CVEs)
        },
    });

    // Automatically delete old untagged images to save on AWS storage costs
    new aws.ecr.LifecyclePolicy(`${projectCode}-${environment}-${serviceCode}-lifecycle`, {
        repository: repository.name,
        policy: JSON.stringify({
            rules: [{
                rulePriority: 1,
                description: "Keep last 30 images",
                selection: {
                    tagStatus: "any",
                    countType: "imageCountMoreThan",
                    countNumber: 30,
                },
                action: {
                    type: "expire",
                },
            }],
        }),
    });

    return repository;
}
