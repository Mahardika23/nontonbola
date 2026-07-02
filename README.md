# nontonbola ⚽🏆

**The road to the World Cup final, drawn as a single glowing circle.** `nontonbola` renders the
FIFA World Cup 2026 knockout stage as a circular *sunburst* bracket — the trophy blazing at the
center, 32 flags around the rim — that you can explore, hover, and drill into. One glance tells
you what kicks off next, who's stormed through, and exactly how each team is fighting its way to
the final. ("nonton bola" = "watch football" in Indonesian 🇮🇩.)

> A gloriously unnecessary side project — really just an excuse to test and stretch how far
> agentic AI development with Claude can actually go. Reader, it went pretty far. 🤖

## What it is

- A **full 360° sunburst bracket**: the Final at the dead center, rounds fanning outward —
  SF → QF → R16 → **32 flags on the rim**. Trophy-gold on near-black.
- **Glance value**: a **next-match** banner (soonest kickoff by clock), the **decided path** drawn
  in gold, and **advancement cues** — winners are ringed gold, eliminated teams fade out.
- **Hover a flag** (tap on touch) → a quick-card: the team's last result, and for winners their
  **next match + potential opponents** (e.g. "vs 🇳🇱 Netherlands or 🇲🇦 Morocco").
- **Click a flag** → a detail overlay blooms over the dimmed bracket: the team's **Journey**
  (group + knockout, with scorers), tournament **Form**, summary stats, and the 26-man **Squad**.
- **Mobile**: pan + pinch-zoom and a two-stage tap. Data is from openfootball; live API data is
  deferred (free tier can't reach 2026 — see ADR-0005).

## Stack & architecture

| Concern | Choice |
|---|---|
| Framework | **Next.js (App Router)**, self-hosted on an Ubuntu box |
| Bracket data | **openfootball/worldcup.json** (free, no key) — the always-on backbone |
| Rich data | **API-Football** (free tier, 100 req/day) — on-demand team detail, fetched server-side |
| Cache / store | **SQLite** (`better-sqlite3`) — results, summaries, lineups, facts |
| Refresh | **In-process node-cron**, idempotent + reconciling, ~3h post-match + daily baseline |
| Bracket render | **SVG** + **D3** (`d3-hierarchy` radial) for layout math only |
| Detail UI | **Modal overlay via intercepting routes** (`/team/[id]`, shareable) |
| Fun facts | **Claude Haiku**, grounded in a validated stat sheet (no hallucinated facts) |
| Look | Sleek dark broadcast, **trophy-gold** accent; one cool tone reserved for "live" |
| Responsive | Desktop-first; adapted mobile (zoom/drag, tap replaces hover) |

### Data flow

```
openfootball/worldcup.json ──► SQLite (bracket: rounds, matches, slots, results)
        API-Football ──(node-cron, ~3h post-match)──► SQLite (summaries, lineups, stats)
                 stat sheet ──► Claude Haiku ──► validate ──► SQLite (fun facts)
                                                   │
        Next.js (reads SQLite + bracket only; never calls upstream on the request path)
                                                   │
                          SVG sunburst  ·  hover cards  ·  /team/[id] overlay
```

Key invariant: **request handlers never call the upstream APIs or the LLM.** Only the scheduler
writes to SQLite; the app only reads. Reads are always instant and never rate-limited.

## Run it locally

```bash
npm install
npm run db:ingest     # data/*.json (openfootball) -> db/worldcup.sqlite
npm run dev           # http://localhost:3000
```

`npm run db:ingest` is re-runnable and rebuilds the SQLite cache from the vendored
`data/worldcup.2026.json` + `data/teams.2026.json`. The app reads that DB read-only.

## Open items (resolve during build)

- **Team-identity mapping**: reconcile openfootball team identities ↔ API-Football team IDs
  (needed the moment Slice 3 starts). A small mapping table in SQLite.
- **Stat-sheet contract**: define exactly which keyed numbers the fun-fact generator receives
  and validates against (the contract from ADR-0004).
- **"Active/next match" definition**: precise rule for which match glows (next kickoff by time,
  or in-progress if live).
- **Hover quick-card fields**: finalize the exact fields shown (form, GF/GA, standout stat).
