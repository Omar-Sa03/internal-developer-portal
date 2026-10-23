# Internal Developer Portal

The portal answers one question for every service: **is it safe to ship?**

- **Readiness scorecards** score each service from Kyverno policy reports, Argo CD health,
  CI status, code scanning, ownership, docs and golden path version.
- **Pull request previews** deploy every PR labelled `preview` to its own namespace.
- **Golden path upgrades** detect template drift and open upgrade pull requests that never touch
  application code.
- **AI on-call actions** let MCP clients investigate incidents with the caller's permissions.

See the repository README for setup, and the design decisions in the navigation for the
trade-offs behind each feature.
