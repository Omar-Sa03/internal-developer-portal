# 3. Label-driven preview expiry

Status: accepted

## Context

Previews of abandoned pull requests waste cluster resources. The first idea was a Kyverno
`ClusterCleanupPolicy` deleting `pr-*` namespaces older than 72 hours.

## Decision

Expire previews by removing the `preview` label from pull requests that have been idle for 72
hours, using a scheduled workflow shipped with the golden path (`preview-ttl.yml`).

## Consequences

- Deleting a namespace behind Argo CD's back fights the reconciler: with self-heal enabled the
  Application recreates it. Removing the label changes the desired state instead, and the
  ApplicationSet deletes the Application cleanly.
- The PR gets a comment explaining why the preview disappeared and how to bring it back.
- Expiry is per repository and can be tuned through the workflow input.
- Namespaces created outside the ApplicationSet are not cleaned up by this mechanism.
