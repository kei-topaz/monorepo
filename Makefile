.PHONY: backend-build backend-test backend-clean backend-check backend-lint backend-format \
        api-run api-build api-test api-export api-verify \
        admin-run admin-build admin-test \
        core-test data-test \
        infra-install infra-preview infra-up \
        docker-up docker-down \
        security-scan

# --- Backend (Global) ---
backend-build:
	cd backend && ./gradlew build

backend-test:
	cd backend && ./gradlew test

backend-clean:
	cd backend && ./gradlew clean

backend-check: security-scan
	cd backend && ./gradlew build detekt ktlintCheck

backend-lint:
	cd backend && ./gradlew detekt ktlintCheck

backend-format:
	cd backend && ./gradlew ktlintFormat

# --- Service API ---
service-run:
	cd backend && ./gradlew :service-api:run

service-build:
	cd backend && ./gradlew :service-api:build

service-test:
	cd backend && ./gradlew :service-api:test

service-export:
	cd backend && ./gradlew :service-api:exportOpenApi

service-verify:
	cd backend && ./gradlew :service-api:verifyOpenApi

# --- Admin API ---
admin-run:
	cd backend && ./gradlew :admin-api:run

admin-build:
	cd backend && ./gradlew :admin-api:build

admin-test:
	cd backend && ./gradlew :admin-api:test

# --- Domain & Data ---
core-test:
	cd backend && ./gradlew :domain-core:test

data-test:
	cd backend && ./gradlew :data-repository:test

# --- Infrastructure ---
infra-install:
	cd infrastructure && pnpm install

infra-preview:
	cd infrastructure && pulumi preview

infra-up:
	cd infrastructure && pulumi up

# --- Docker ---
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

# --- Security ---
security-scan:
	./scripts/check_secrets.sh
