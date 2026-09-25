# Relay, by Team Ryzera

> From order to receipt, nothing gets dropped.

Relay is a delivery planning system for Waypoint Group, built for Rootcode Tech-Triathlon 2026. It connects ordering, planning, loading, delivery, and receipt across four roles: Store Manager, Dispatcher, Loader, and Driver. All four work from one shared record per order.

**Status:** Designathon in progress (due 29 Sep 2026). The Hackathon build follows the submitted design.

## Repository layout

| Path | What it holds |
|---|---|
| `docs/designathon/` | Designathon working drafts: problem framing, personas, screen rationale |
| `docs/ai-usage-log.md` | Running log of AI-assisted work, used to write each phase's AI tool disclosure |

## Hackathon checklist (booklet p.12, due 4 Oct 2026)

- [ ] `docker-compose.yml` and `.env.example` at the repo root; `docker compose up` starts the full stack, including the database and seed data
- [ ] README: setup and configuration instructions
- [ ] README: seeded account details, one per role
- [ ] README: numbered judge walkthrough across all four roles, from planning to completed delivery
- [ ] README: significant departures from the Designathon submission
- [ ] `docs/`: architecture diagram and data model
- [ ] `docs/`: AI tool disclosure
