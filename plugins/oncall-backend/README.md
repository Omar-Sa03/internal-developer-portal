# On-call backend

Read-only [MCP actions](https://backstage.io/docs/ai/mcp-actions) that let an AI agent
investigate an incident through the portal instead of with cluster admin credentials. Every
action resolves the service with the caller's credentials first, so an agent only sees what its
user may see in the catalog.

| Action                         | Returns                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `oncall.get-workload-status`   | Pods (phase, readiness, restarts, CrashLoopBackOff/OOMKilled reasons) and Warning events |
| `oncall.get-deployment-status` | Argo CD health, sync state, deployed revision, last sync result, last three deployments  |
| `oncall.get-firing-alerts`     | Firing Alertmanager alerts for the service namespace (silenced/inhibited ones excluded)  |
| `oncall.get-recent-changes`    | Latest commits on the default branch                                                     |

Together with `readiness.get-readiness-score` and the built-in catalog actions, an agent can
answer "why is orders-api unhealthy?" by correlating pod state, events, alerts, the last
deployment and recent commits.

## Connect Claude Code

1. Add a static token for MCP clients to `app-config.local.yaml` (never commit it):

   ```yaml
   backend:
     auth:
       externalAccess:
         - type: static
           options:
             token: <random string, e.g. `openssl rand -base64 32`>
             subject: mcp-clients
   ```

2. Register the portal as an MCP server:

   ```sh
   claude mcp add --transport http idp http://localhost:7007/api/mcp-actions/v1 \
     --header "Authorization: Bearer <token>"
   ```

3. Ask, for example: _"orders-api is returning errors. Use the idp tools to find out why and
   what changed recently."_

Requests made with the static token act as the `mcp-clients` service principal, which the
portal's permission policy treats as read-only. For per-user identity, enable client ID
metadata documents (`auth.clientIdMetadataDocuments`) so MCP clients sign in through the portal.

## Configuration

```yaml
argocd:
  namespace: argocd # where Argo CD Applications live
oncall:
  alertmanager:
    baseUrl: http://alertmanager.localtest.me:8080 # optional; alerts are skipped without it
```

Cluster access uses the backend's kubeconfig and needs `list` on pods and events in service
namespaces and on `applications.argoproj.io` in the Argo CD namespace. Pods are selected with
the `backstage.io/kubernetes-label-selector` annotation, defaulting to `app=<kubernetes-id>`.
