# Readiness backend

Scores every catalog `Component` on production readiness (0-100, graded A-F) from live signals,
stores the history, and exposes it over REST and as an MCP action.

## Checks

| Check                            | Source                                                           | Weight |
| -------------------------------- | ---------------------------------------------------------------- | ------ |
| Owned by a team                  | `spec.owner` resolves to a Group in the catalog                  | 2      |
| Has documentation                | `backstage.io/techdocs-ref` annotation                           | 1      |
| Has a monitoring dashboard       | `grafana/dashboard-selector` annotation                          | 1      |
| Complies with cluster policies   | Kyverno `PolicyReport`s in `backstage.io/kubernetes-namespace`   | 3      |
| Deployed and healthy via Argo CD | Argo CD `Application` labelled `backstage.io/kubernetes-id`      | 3      |
| Default branch CI is green       | Latest completed GitHub Actions run on the default branch        | 2      |
| No critical vulnerabilities      | Open GitHub code scanning alerts (Trivy SARIF from the template) | 3      |

Each check returns `pass`, `warn` (half credit), `fail`, `skip` (not applicable) or `error`
(could not be evaluated). `skip` and `error` are left out of the score so an unavailable
integration never punishes a service. Failing checks carry a remediation hint.

## API

| Method | Path                                               | Description                                           |
| ------ | -------------------------------------------------- | ----------------------------------------------------- |
| GET    | `/api/readiness/scores`                            | Latest score of every component visible to the caller |
| GET    | `/api/readiness/entities/:kind/:ns/:name`          | Latest evaluation and score history                   |
| POST   | `/api/readiness/entities/:kind/:ns/:name/evaluate` | Re-evaluate now (`readiness.evaluate` permission)     |

Entities are always resolved with the caller's credentials, so catalog permission rules
apply to scores too.

MCP action `readiness:get-readiness-score` lets AI agents ask whether a service is ready for
production and why not (enable with `backend.actions.pluginSources: [readiness]`).

## Configuration

```yaml
readiness:
  schedule: # defaults to every 30 minutes
    frequency: { minutes: 30 }
    timeout: { minutes: 10 }
argocd:
  namespace: argocd # where Argo CD Applications live
```

Kubernetes access uses the backend's kubeconfig or in-cluster service account and needs
`list` on `policyreports.wgpolicyk8s.io` and `applications.argoproj.io`. GitHub access uses
the `integrations.github` token (needs `repo` and `security_events` scope).

## Adding a check

Implement `ReadinessCheck` from `src/types.ts` and add it to the list in `src/plugin.ts`.
Keep external calls behind a small reader interface (see `src/clients`) so the check can be
unit tested.
