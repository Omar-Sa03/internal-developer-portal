# 1. Custom readiness plugin instead of Tech Insights

Status: accepted

## Context

We want one production readiness score per service, computed from live signals: Kyverno
PolicyReports, Argo CD Application health, GitHub Actions and code scanning, catalog metadata and
template version. Backstage's community Tech Insights plugin offers fact retrievers and checks
that could be configured for parts of this.

## Decision

Build a small dedicated plugin (`plugins/readiness-backend`) with a `ReadinessCheck` interface,
weighted scoring and its own history table.

## Consequences

- Checks return a verdict _and_ a remediation hint and link, which is what the UI and the MCP
  action need; Tech Insights checks are boolean facts and would need a separate layer for this.
- Scoring semantics are explicit: warnings earn half credit, `skip` and `error` are excluded, so
  a GitHub outage does not drop every score.
- External systems sit behind reader interfaces, so each check is unit tested without a cluster.
- We maintain the plugin ourselves. If the number of checks grows a lot, Tech Insights fact
  retrievers could feed the same `ReadinessCheck` interface.
