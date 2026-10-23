# Readiness frontend

UI for the [readiness backend](../readiness-backend/README.md), built for the new frontend system.

- **Entity card** (`entity-card:readiness/scorecard`): score gauge, grade and every check on
  component pages, failing checks first with their fix, plus a "Re-evaluate now" button.
- **Readiness page** (`/readiness`, in the sidebar): leaderboard of all services sorted by
  score, with what needs attention per service.

The plugin is picked up automatically through `app.packages: all`.
