# Relay, by Team Ryzera

> From order to receipt, nothing gets dropped.

Relay is a delivery planning system for Waypoint Group, built for Rootcode Tech-Triathlon 2026. It connects ordering, planning, loading, delivery, and receipt across four roles: Store Manager, Dispatcher, Loader, and Driver. All four work from one shared record per order.

**Status:** Designathon in team review (due 29 Sep 2026). The design file is built by the Relay Builder plugin from the v0.4 scenario, which now uses real records from the competition data and passes its data check. The Hackathon build follows the submitted design.

## Team Ryzera

Each member owns one part for review and edits. Swap parts freely.

| Member | Part |
|---|---|
| Kalana | Lead: problem framing, scope, core tradeoff, final submission |
| Kavitha | Dispatcher screens |
| Induwara | Loader screens |
| Bhathiya | Driver screens |
| Hirantha | Store Manager screens |
| Mandira | Style guide and design system |
| Dinithi | Degradation scenario, demo video, AI disclosure |

## Repository layout

| Path | What it holds |
|---|---|
| `docs/designathon/` | Designathon documents: problem framing, personas, screens and flows, style guide, scenario data, core tradeoff, AI disclosure, video script, submission checklist; `specs/` holds the per-role build specs and the component list |
| `docs/ai-usage-log.md` | Running log of AI-assisted work, used to write each phase's AI tool disclosure |
| `data/` | The competition datasets and the organizers' `check_allocation.py` in `data/raw/`, and anything scripts derive in `data/derived/`. Both are ignored by git until the organizers confirm how seed data may be shared |
| `tools/data-check/` | `validate_scenario.py` checks every figure in `docs/designathon/05-scenario-data.md` against the datasets (`python tools/data-check/validate_scenario.py`, about six minutes) |
| `tools/figma-builder/` | Relay Builder, the Figma plugin that builds the whole design file, with a local mock of the Figma API that renders and audits it (see `BUILD-NOTES.md`) |

## Hackathon checklist (booklet p.12, due 4 Oct 2026)

- [ ] `docker-compose.yml` and `.env.example` at the repo root; `docker compose up` starts the full stack, including the database and seed data
- [ ] README: setup and configuration instructions
- [ ] README: seeded account details, one per role
- [ ] README: numbered judge walkthrough across all four roles, from planning to completed delivery
- [ ] README: significant departures from the Designathon submission
- [ ] `docs/`: architecture diagram and data model
- [ ] `docs/`: AI tool disclosure
