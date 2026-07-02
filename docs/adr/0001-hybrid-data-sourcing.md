# Hybrid data sourcing: open JSON for the bracket, API-Football for team detail

## Context

The app must render a World Cup 2026 knockout bracket (the core, always-on view) and rich
team detail on demand (lineups, past matches, last-match stats, fun facts). No single free
source does both well: open public-domain data covers the bracket but lacks rich stats, while
the rich freemium APIs are key-gated and rate-limited (~100 requests/day on free tiers).

## Decision

Split the two by their access pattern:

- **Bracket backbone** — `openfootball/worldcup.json` (public domain, no API key, never
  rate-limited). Powers the structure, schedule, and results. The core view must never break
  or hit a quota, so it is backed by the source that can't.
- **Team detail (on demand)** — **API-Football (api-sports.io)**, free tier (100 req/day, full
  endpoint access: fixtures, lineups, player stats, head-to-head, events). Called **only** when
  a user opens a team, then cached. Chosen over KickoffAPI for maturity/docs/community, over
  TheSportsDB because that source is too thin on per-match lineups and last-match stats, and
  over paid APIs (TheStatsAPI ~$50/mo, Sportmonks ~€69/mo) because this is a personal project.

## Consequences

- API-Football is key-gated, so the key must be hidden server-side and responses cached to
  respect the 100/day budget. This **forces a server-side proxy + cache layer** — see the
  app-architecture ADR.
- "Fun facts" is not a first-class API field; it must be **synthesized** from stats and
  head-to-head records. To be designed separately.
- Two data shapes to reconcile: team identities in `openfootball` (the bracket) must map to
  API-Football team IDs (the detail). A team-identity mapping is required.
