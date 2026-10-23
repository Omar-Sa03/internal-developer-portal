# 4. Ownership boundary for golden path upgrades

Status: accepted

## Context

Services generated from a template drift as the template evolves (new CI steps, chart fixes,
security settings). Re-rendering the whole skeleton into an existing repository would overwrite
application code and the team's own changes.

## Decision

Split every generated repository into platform-owned and team-owned files.

- Platform-owned: `.github/workflows/`, `helm/`, `Dockerfile`, `mkdocs.yml`, `catalog-info.yaml`.
- Team-owned: everything else (`src/`, `tests/`, dependencies, docs content, README).

The template version is defined once (`idp.io/template-version` in `template.yaml`, reused through
a YAML anchor) and stamped into each service. The upgrade template re-renders the latest skeleton,
deletes the team-owned files from the rendered output and opens a pull request with the rest.
Semantic versioning drives urgency: a major version behind fails the readiness check, a minor or
patch version behind is a warning.

## Consequences

- Upgrades are reviewable pull requests, never direct pushes.
- Local changes a team made to platform-owned files show up as diffs in the PR and must be
  reconciled by the reviewer.
- The boundary must be kept in sync between `upgrade.yaml` and the changelog.
