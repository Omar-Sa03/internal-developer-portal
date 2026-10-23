# Python FastAPI golden path changelog

The version lives in the `idp.io/template-version` annotation of [`template.yaml`](template.yaml).
Services record the version they were generated from in their `catalog-info.yaml`. When it
falls behind, the readiness score flags it, and the **Upgrade Python FastAPI service** template
opens a pull request with the changes below.

Upgrades only touch files owned by the platform: `.github/workflows/`, `helm/`, `Dockerfile`,
`mkdocs.yml` and `catalog-info.yaml`. Application code (`src/`, `tests/`, dependencies, docs
content) is never modified.

Versioning: a **major** bump means services must upgrade (drift fails the readiness check),
**minor** and **patch** bumps are recommended (drift is a warning).

## 2.0.0

- **Breaking:** Helm chart rewritten. The previous templates did not render, so services could
  not be deployed by Argo CD.
- Ingress for every service at `<service>.localtest.me`.
- Pull request preview environments: CI builds `pr-<sha>` images for PRs labelled `preview`,
  comments the preview URL, and a daily workflow expires idle previews.
- Repositories get the `idp-service` topic so the platform can discover them.
- Golden path provenance annotations (`idp.io/template`, `idp.io/template-version`).

## 1.1.0

- Trivy results are uploaded to GitHub code scanning.
- TechDocs with an overview and a runbook.
- Kyverno policies moved from the service repository to the cluster.

## 1.0.0

- FastAPI service with health and Prometheus metrics, Dockerfile, Helm chart, GitHub Actions CI
  and Argo CD deployment.
