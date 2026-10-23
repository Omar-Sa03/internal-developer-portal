# 2. Preview environments with an ApplicationSet

Status: accepted

## Context

Each pull request should be deployable to an isolated environment. Options:

1. A CI job in every service repository runs `helm install` into a temporary namespace.
2. A Backstage action creates an Argo CD Application per PR.
3. One Argo CD ApplicationSet discovers PRs and generates Applications.

## Decision

Option 3: a single ApplicationSet combining an SCM provider generator (repositories with the
`idp-service` topic) and a pull request generator (PRs labelled `preview`), defined in
`platform/argocd/apps/previews.yaml`.

## Consequences

- No cluster credentials in service CI; CI only builds and pushes the `pr-<sha>` image.
- New services get previews automatically through the topic set by the template.
- Lifecycle is reconciled: closing a PR or removing the label deletes the Application, and the
  resources finalizer removes what it deployed.
- Guardrails are central: the `idp-previews` AppProject limits repos and namespaces, and a Kyverno
  generate policy adds a ResourceQuota and LimitRange to every preview namespace.
- Argo CD polls GitHub (`requeueAfterSeconds`) because the local cluster cannot receive webhooks.
  In the cloud, a GitHub webhook to the ApplicationSet controller removes the delay.
