# Internal Developer Portal

Internal Developer Portal built on [Backstage](https://backstage.io) v1.54.0. Provides a service catalog, self-service software templates, and platform tooling.

## Features

- **Service Catalog** - services, APIs, and infrastructure components tracked in one place
- **Software Templates** - scaffolds production-ready services via the [Python FastAPI template](#python-fastapi-template)
- **ArgoCD Scaffolder Action** - creates ArgoCD `Application` resources during service provisioning
- **TechDocs** - documentation-as-code with MkDocs
- **Grafana Integration** - proxied access to Grafana dashboards
- **Kubernetes Plugin** - view Kubernetes workloads from the catalog
- **Permissions** - policy-driven access control, enabled by default
- **MCP Actions** - Model Context Protocol actions for catalog, auth, and scaffolder

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 22 or 24 |
| Yarn | 4.13.0 (set via `packageManager` in `package.json`) |
| Docker | needed for TechDocs generation (`runIn: docker`) |
| GitHub PAT | set `GITHUB_TOKEN` env var ([docs](https://backstage.io/docs/integrations/github/locations#configuration)) |

## Getting Started

### 1. Install dependencies

```sh
yarn install
```

### 2. Set environment variables

```sh
# GitHub integration (required)
export GITHUB_TOKEN=<your-github-personal-access-token>

# Grafana integration (optional)
export GRAFANA_TOKEN=<your-grafana-service-account-token>

# Production database (only for app-config.production.yaml)
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=backstage
export POSTGRES_PASSWORD=<password>
```

### 3. Start the dev server

```sh
yarn start
```

Runs the frontend on http://localhost:3000 and the backend on http://localhost:7007. Uses an in-memory SQLite database, so no external DB is needed locally.

### 4. Build for production

```sh
yarn build:all          # all packages
yarn build:backend      # backend only
yarn build-image        # backend Docker image
```

## Project Structure

```
internal-developer-portal/
├── packages/
│   ├── app/                  # frontend (React)
│   └── backend/              # backend (Node.js)
├── plugins/
│   └── scaffolder-backend-module-argocd/   # custom ArgoCD scaffolder action
├── templates/
│   └── python-fastapi/       # Python FastAPI service template
│       ├── template.yaml     # template definition
│       └── skeleton/         # scaffolded project files
├── examples/                 # example catalog entities and templates
├── app-config.yaml           # dev config
├── app-config.production.yaml# production config
└── catalog-info.yaml         # portal self-registration
```

## Python FastAPI Template

Included software template that scaffolds a Python FastAPI service with:

| What | Details |
|---|---|
| FastAPI app | Health endpoint (`/health`), root (`/`), Prometheus metrics (`/metrics`) |
| Prometheus | Request count and latency histograms via `prometheus_client` |
| Dockerfile | Python 3.12-slim, non-root user, Uvicorn |
| Helm chart | Deployment, Service, ServiceMonitor |
| CI/CD | GitHub Actions: test, lint (Ruff), Trivy scan, GHCR publish, automated Helm values PR |
| Kyverno policies | Enforces resource limits/requests and readiness/liveness probes |
| Catalog entry | Auto-registered `catalog-info.yaml` with Grafana dashboard annotations |

### Template parameters

| Parameter | Description | Default |
|---|---|---|
| `serviceName` | Service name (lowercase, hyphenated) | required |
| `team` | Owning team | `backend-team` |
| `environment` | `development`, `staging`, or `production` | `development` |
| `githubOwner` | GitHub org or user for the new repo | `internal-developer-portal26` |

## ArgoCD Scaffolder Module

Custom backend module in `plugins/scaffolder-backend-module-argocd`. Registers the `argoCd:createApplication` scaffolder action which:

1. Generates an ArgoCD `Application` manifest pointing at the service's Helm chart
2. Applies it to the cluster with `kubectl apply`
3. Sets up automated sync with pruning and self-heal

### Action inputs

| Input | Type | Description |
|---|---|---|
| `name` | `string` | Application name |
| `repoUrl` | `string` (URL) | Git repository URL |
| `path` | `string` | Path to Helm chart (default: `helm/service`) |
| `namespace` | `string` | Target Kubernetes namespace |

## Configuration

| File | Purpose |
|---|---|
| `app-config.yaml` | Dev: SQLite in-memory, localhost URLs, guest auth |
| `app-config.production.yaml` | Production: PostgreSQL, guest auth (swap for a real provider) |

### Key sections

- `integrations.github` - GitHub PAT for repo operations
- `proxy.endpoints./grafana/api` - proxies requests to Grafana
- `techdocs` - local builder, Docker-based MkDocs
- `catalog.locations` - registered templates and example entities
- `auth.providers` - authentication providers (guest by default)
- `permission` - permission framework (enabled)
- `kubernetes` - cluster config
- `mcpActions` - MCP action server

## Scripts

| Script | Description |
|---|---|
| `yarn start` | Start frontend and backend in dev mode |
| `yarn build:backend` | Build backend for production |
| `yarn build:all` | Build all packages |
| `yarn build-image` | Build backend Docker image |
| `yarn test` | Run tests |
| `yarn test:all` | Run tests with coverage |
| `yarn test:e2e` | Run Playwright e2e tests |
| `yarn lint` | Lint changed files (since `origin/master`) |
| `yarn lint:all` | Lint everything |
| `yarn tsc` | TypeScript type check |
| `yarn fix` | Auto-fix lint issues |
| `yarn prettier:check` | Check formatting |
| `yarn new` | Scaffold a new plugin or package |

## Contributing

1. Branch off `main`.
2. Make changes, run `yarn lint` and `yarn test`.
3. Run `yarn tsc`.
4. Open a pull request.

### Adding a template

1. Create a directory under `templates/`.
2. Add a `template.yaml` per the [scaffolder docs](https://backstage.io/docs/features/software-templates/writing-templates).
3. Add a `skeleton/` directory with the project boilerplate.
4. Register it in `app-config.yaml` under `catalog.locations`.

### Adding a plugin

```sh
yarn new
```

Follow the prompts to scaffold a frontend or backend plugin.

## Links

- [Backstage docs](https://backstage.io/docs)
- [Software Templates](https://backstage.io/docs/features/software-templates)
- [Plugins](https://backstage.io/plugins)
- [Permission Framework](https://backstage.io/docs/permissions/getting-started)
- [MCP Actions](https://backstage.io/docs/ai/mcp-actions)
