# Self-hosted Next.js with SQLite cache and in-process post-match revalidation

## Context

The keyed, rate-limited API-Football source (see ADR-0001) requires a server-side proxy, a
cache to respect the ~100 req/day budget, and a refresh strategy. Deployment target is a
self-hosted **Ubuntu box** (not Vercel) running a persistent Next.js node server. A persistent
process + local disk + system services change the trade-offs versus an ephemeral platform.

## Decision

- **Deploy self-hosted** on Ubuntu (`next start` / standalone output). No Vercel, no third-party
  scheduler — an explicit constraint from the owner.
- **Cache store: local SQLite file** (`better-sqlite3`). Holds match results, per-team summaries,
  and lineups in tables. Persistent across restarts, queryable, single-file backup, no external
  service. Chosen over plain JSON snapshots (awkward as relations grow), Next Data Cache (a fetch
  cache, not a queryable store), and Redis (an extra service to run — overkill at this scale).
- **Refresh trigger: in-process scheduler (node-cron)** inside the Next server. It reads the
  fixture list and refreshes data ~3h after each match's kickoff (90' + possible ET + penalties
  safely done), plus a daily baseline pass. One deployable unit, nothing outside the repo.
- **Refresh is idempotent and reconciling.** Each run refreshes *any* match that has ended since
  the last successful refresh — so a missed tick (downtime, restart) self-heals on the next run.

## Consequences

- The scheduler is tied to the app process being up; the reconciling design is what makes that
  acceptable (back-fills on restart). If the app is down across a match, data catches up next tick.
- API-Football calls are made by the scheduler (writes to SQLite), not by request handlers — so
  page/hover reads never call the upstream API and never block on it. Budget is spent on a
  predictable, small number of scheduled refreshes (~32 team summaries/day + per-match updates).
- Hover and detail views read exclusively from SQLite + the open bracket JSON.
