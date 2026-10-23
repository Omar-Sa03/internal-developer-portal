# Previews frontend

Adds a **Previews** tab to catalog entities that have a `backstage.io/kubernetes-id`
annotation. It lists every live pull request environment with links to the PR and the
environment, Argo CD health and sync state, and the deployed commit. The list refreshes every
15 seconds.

Data comes from the [previews backend](../previews-backend/README.md).
