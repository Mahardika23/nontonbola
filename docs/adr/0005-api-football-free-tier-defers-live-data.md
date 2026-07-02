# API-Football free tier excludes season 2026 — live data deferred

## Context

ADR-0001 chose API-Football (free tier) to power live team detail — current lineups, recent
form, live results — refreshed by the in-process scheduler (ADR-0003). On building that slice
with a real free-tier key, the plan's limits made the live vision impossible:

- **Season 2026 is blocked**: `"Free plans do not have access to this season, try from 2022 to
  2024."` Full coverage exists (lineups/stats/events all `true`) — just not on the free plan.
- The `last=N` recent-form shortcut is blocked on free.
- No access to current 2025/26 fixtures or live results.

What the free plan *does* allow: team search + logos/crests, and historical season data
(2022–2024), e.g. the Qatar 2022 World Cup fixtures and lineups.

## Decision

- **Keep World Cup 2026 sourced entirely from openfootball** (the static bracket + group/squad
  data we already ingest). No live API data for 2026.
- **Shelve the live-refresh slice and the in-process scheduler** (ADR-0003's node-cron) — there
  is nothing live to refresh on the free plan. **Defer fun facts** (ADR-0004) too; they depend
  on live stats.
- **Keep `lib/apiFootball.ts` and the `.env.local` scaffolding dormant but in place**, so the
  full live slice can be switched on quickly if the owner ever upgrades to a paid plan.
- **Proceed with mobile adaptation + polish** (Slice 5) — the highest-value work that needs no
  paid data.

Rejected: paying for a plan (~$25–40/mo) to unlock 2026 — not worth it for a personal project.
Rejected: building a "Qatar 2022 recap" from accessible historical data — real but low value,
not worth the build right now.

## Consequences

- Team detail keeps showing the static 26-man squad and tournament-derived form (Slice 2),
  not API-sourced lineups/recent form.
- `lib/apiFootball.ts` is intentionally unused for now; this ADR is why it exists.
- ADR-0003 (scheduler) and ADR-0004 (fun facts) remain accepted designs but are not yet built.
