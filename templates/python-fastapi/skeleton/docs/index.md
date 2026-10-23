# ${{ values.service_name }}

FastAPI service owned by **${{ values.team }}**, generated from the Internal Developer Portal golden path.

## Endpoints

| Path       | Purpose                      |
| ---------- | ---------------------------- |
| `/`        | Service info                 |
| `/health`  | Readiness and liveness probe |
| `/metrics` | Prometheus metrics           |

## Deployment

The service is deployed by Argo CD from `helm/service` on the `main` branch.
Image tags are bumped through automated pull requests from CI.
