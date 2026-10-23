# 5. MCP actions act with the caller's permissions

Status: accepted

## Context

AI agents investigating incidents need pod state, events, deployments, alerts and recent changes.
Giving an agent a kubeconfig or GitHub token grants far more than it needs and bypasses the
portal's access model.

## Decision

Expose read-only MCP actions from the portal (`plugins/oncall-backend`,
`readiness.get-readiness-score`). Every action first resolves the target entity from the catalog
with the caller's credentials; only then does the backend query the cluster or GitHub, limited to
that entity's namespace, Argo CD Application or repository.

## Consequences

- The catalog permission policy decides what an agent can investigate, and audit logs show which
  principal asked.
- Actions are read-only and idempotent, so an agent cannot change the system through them.
- The backend's own cluster credentials still need read access to service namespaces; that access
  is never handed to the agent.
- Local setups use a static token (service principal, read-only under the policy). Per-user agent
  identity requires enabling client ID metadata documents for MCP OAuth.
