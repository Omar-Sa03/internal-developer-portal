# Previews backend

Lists the ephemeral pull request environments of a catalog entity.

Environments are created by the `previews` ApplicationSet in
[`platform/argocd/apps/previews.yaml`](../../platform/argocd/apps/previews.yaml): every open PR
labelled `preview`, in any org repository with the `idp-service` topic, gets an Argo CD
Application deployed to its own `pr-<number>-<service>` namespace. This plugin reads those
Applications (label `idp.io/preview-of=<backstage.io/kubernetes-id>`) and returns their PR,
URL, health and sync state.

| Method | Path                                     | Description                      |
| ------ | ---------------------------------------- | -------------------------------- |
| GET    | `/api/previews/entities/:kind/:ns/:name` | Active previews, newest PR first |

The entity is resolved with the caller's credentials, so catalog permissions apply. Cluster
access uses the backend's kubeconfig and needs `list` on `applications.argoproj.io` in the
`argocd.namespace` namespace.
