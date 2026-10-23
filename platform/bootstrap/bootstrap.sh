#!/usr/bin/env bash
# Creates a local kind cluster and hands everything else to Argo CD.
#
# Prerequisites: docker, kind, kubectl, helm.
# Usage: platform/bootstrap/bootstrap.sh
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-idp}"
ARGOCD_CHART_VERSION="${ARGOCD_CHART_VERSION:-7.7.0}"
INGRESS_NGINX_VERSION="${INGRESS_NGINX_VERSION:-controller-v1.11.3}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for bin in docker kind kubectl helm; do
  command -v "$bin" >/dev/null || { echo "missing required tool: $bin" >&2; exit 1; }
done

if kind get clusters | grep -qx "$CLUSTER_NAME"; then
  echo "kind cluster '$CLUSTER_NAME' already exists, reusing it"
else
  kind create cluster --config "$SCRIPT_DIR/kind-config.yaml" --name "$CLUSTER_NAME"
fi
kubectl config use-context "kind-$CLUSTER_NAME"

echo "Installing ingress-nginx"
kubectl apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/${INGRESS_NGINX_VERSION}/deploy/static/provider/kind/deploy.yaml"
kubectl wait -n ingress-nginx --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller --timeout=180s

echo "Installing Argo CD"
helm repo add argo https://argoproj.github.io/argo-helm >/dev/null
helm repo update argo >/dev/null
helm upgrade --install argocd argo/argo-cd \
  --namespace argocd --create-namespace \
  --version "$ARGOCD_CHART_VERSION" \
  --values "$SCRIPT_DIR/argocd-values.yaml" \
  --wait

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  echo "Storing GitHub token for the preview ApplicationSet"
  kubectl -n argocd create secret generic github-token \
    --from-literal=token="$GITHUB_TOKEN" \
    --dry-run=client -o yaml \
    | kubectl label --local -f - argocd.argoproj.io/secret-type=scm-creds -o yaml \
    | kubectl apply -f -
else
  echo "GITHUB_TOKEN not set: PR preview environments stay disabled" >&2
fi

echo "Applying platform app-of-apps"
kubectl apply -f "$SCRIPT_DIR/../argocd/root.yaml"

password="$(kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d)"

cat <<EOF

Platform is bootstrapping. Argo CD will now install Kyverno, monitoring and policies.

  Argo CD:  http://argocd.localtest.me:8080   (admin / ${password})
  Grafana:  http://grafana.localtest.me:8080  (admin / prom-operator)

Watch progress with: kubectl -n argocd get applications -w
EOF
