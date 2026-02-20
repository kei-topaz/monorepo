# Monorepo Chassis

## Project Structure
This repository is a **Flat Monorepo** designed as a chassis for building scalable services. It contains:

*   **Backend**: Kotlin (Ktor, jOOQ, Redis)
    *   `backend/domain-core`: Pure domain logic.
    *   `backend/data-repository`: Data access (SQL/Redis).
    *   `backend/service-api`: REST API.
*   **Frontend**:
    *   `frontend/admin`: React/Vite Admin Dashboard.
*   **Infrastructure**: Pulumi (TypeScript/Node.js).
*   **Ops**: Docker Compose, Makefiles.

## Architecture
The backend follows a strict 10-point technical specification defined in `docs/ARCHITECTURE.md`.

## Prerequisites
*   JDK 17+
*   Node.js 18+ & pnpm
*   Docker & Docker Compose

## Getting Started

### 1. Start Local Infrastructure
```bash
make docker-up
```

### 2. Environment Setup
Copy `.env.example` to `.env`.
```bash
cp .env.example .env
```

### 3. Run the Backend
```bash
make run
```

### 4. Infrastructure (Pulumi)
```bash
make infra-install
make infra-preview
```

## Key Features
*   **Orchestrator Pattern**: Explicit transaction management for SQL and Redis.
*   **Observability**: Request IDs are propagated through Coroutines and tagged on Database/Redis connections.
*   **Type Safety**: Extensive use of `@JvmInline` value classes.
