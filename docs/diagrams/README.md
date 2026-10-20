# Diagrams

Every diagram here is drawn from the code and the docs in this repository. Each one is a draw.io file in
[drawio/](drawio/) that opens at diagrams.net or in the desktop app, with a PNG export in [png/](png/). Where the docs
and the code differ, the diagram follows the code.

| # | Diagram | It answers |
|---|---|---|
| 1 | [System overview](#1-system-overview) | What runs where, and who talks to whom |
| 2 | [Deployment and delivery](#2-deployment-and-delivery) | How a change reaches the server in Mumbai |
| 3 | [Request lifecycle](#3-request-lifecycle) | What happens to one request, and what stops it |
| 4 | [Planning engine](#4-planning-engine) | How Relay proposes a plan, and the engine cache |
| 5 | [Rules, clocks and the estimate](#5-rules-clocks-and-the-estimate) | The eleven rules, two clocks and one estimate rule |
| 6 | [Scenario clock and simulator](#6-scenario-clock-and-simulator) | What moves a copy of the day |
| 7 | [Database](#7-database) | All 43 tables and how they connect |
| 8 | [Offline outbox and sync](#8-offline-outbox-and-sync) | How a driver's phone works with no signal |
| 9 | [Delivery day, four roles](#9-delivery-day-four-roles) | The story day, hand-off by hand-off |

## 1. System overview

One installable web app for four roles, one API, one planning engine and one PostgreSQL database, all started by
`docker compose up`. Source: [architecture.md](../architecture.md).

![System overview](png/01-system-overview.png)

## 2. Deployment and delivery

CI with its four jobs, the deploy script, and what runs on the one EC2 server: Caddy, the API, the database, the
migrate job and the nightly backup. Source: `.github/workflows/ci.yml`, `infra/`, `docker-compose.prod.yml`.

![Deployment and delivery](png/02-deployment-and-delivery.png)

## 3. Request lifecycle

The path of one request from the browser to the database and back. A red box is the answer a failing check sends.
Source: `apps/api/src/relay_api/main.py`, `workspaces.py`, `db.py`, `security.py`.

![Request lifecycle](png/03-request-lifecycle.png)

## 4. Planning engine

Four pages. The engine is a pure library: plain dataclasses in, a proposal out.

How the API and the engine propose a plan together:

![How Relay proposes a plan](png/04-planning-engine-a-proposal.png)

Every trip a vehicle could run, then the exact search:

![Every trip, then the exact search](png/04-planning-engine-b-search.png)

Chilled orders planned exactly, ambient orders from each vehicle's usual run, and the three deferral rules:

![Chilled and ambient plans](png/04-planning-engine-c-chilled-and-ambient.png)

The engine cache and its warm-up:

![The engine cache](png/04-planning-engine-d-cache.png)

Source: `packages/engine/src/relay_engine/`, `apps/api/src/relay_api/services/planning.py`, `engine_cache.py`.

## 5. Rules, clocks and the estimate

Four pages: how the three parts fit together, then each in detail with a worked example from Kasun's run.

![Rules, two clocks and one estimate](png/05-engine-rules-clocks-estimate-a-overview.png)

![The eleven rules](png/05-engine-rules-clocks-estimate-b-rules.png)

![Two clocks for one trip](png/05-engine-rules-clocks-estimate-c-clocks.png)

![One estimate rule](png/05-engine-rules-clocks-estimate-d-estimate.png)

Source: `rules.py`, `clock.py`, `standard.py`, `estimate.py` in the engine, and `services/estimates.py` in the API.

## 6. Scenario clock and simulator

Each copy of the day has its own clock. A background tick, and the demo bar when it jumps, bring the copy up to date:
scheduled events, the world simulator, the story autopilot and watch. Source: `clock.py`, `workspaces.py`,
`services/simulator.py`, `world.py`, `story.py`, `watch.py`.

![Scenario clock and simulator](png/06-scenario-clock-and-simulator.png)

## 7. Database

Nine pages. The first shows the 43 tables in two groups: 20 shared by every copy and 23 that belong to one copy and
carry a `workspace_id`. Each other page shows one area with every column, and every foreign key starts at its own row.

The pages were generated from the SQLAlchemy models. [data-model.md](../data-model.md) stays the always current
reference, rewritten by `uv run python tools/data_model.py`. If the schema changes, redraw the page it touches.

![Database overview](png/07-database-model-a-overview.png)

![Reference: the network](png/07-database-model-b-reference-network.png)

![Reference: learned from history](png/07-database-model-c-reference-history.png)

![People and copies](png/07-database-model-d-people-and-copies.png)

![Orders](png/07-database-model-e-orders.png)

![Planning](png/07-database-model-f-planning.png)

![Dock](png/07-database-model-g-dock.png)

![Field](png/07-database-model-h-field.png)

![Stores and notices](png/07-database-model-i-stores-and-notices.png)

## 8. Offline outbox and sync

Two pages. The first follows a record from the driver's tap, through IndexedDB and the sender, to the API and the clash
branch. The second is the story's storm, 93 minutes without signal. Source: `docs/degradation.md`,
`apps/web/src/offline/outbox.ts`, `apps/web/src/roles/driver/sync.tsx`, `services/field.py`.

![How the phone keeps working](png/08-offline-outbox-and-sync-a-phone.png)

![One storm, 93 minutes](png/08-offline-outbox-and-sync-b-storm.png)

## 9. Delivery day, four roles

The story day from Dilani's order on Tuesday afternoon to Kasun's finished trip on Wednesday morning, with one lane per
role. Every arrow is a hand-off to another role. Source: the README walkthrough, `clock.py`, `story.py`.

![Delivery day, four roles](png/09-delivery-day-four-roles.png)

## Mermaid versions in the docs

Some of the same ideas are also drawn in Mermaid, so GitHub shows them right inside the page, next to the text they
explain.

| Page | Diagrams |
|---|---|
| [README.md](../../README.md) | System architecture, the story day |
| [architecture.md](../architecture.md) | Request path, planning engine, the tick, delivery and runtime, statuses |
| [degradation.md](../degradation.md) | How a record is answered, the storm in order |


## Editing

Open a file in [drawio/](drawio/) and export again as PNG. The colours are the product's own tokens from
[design-system.md](../design-system.md): asphalt for text and lines, petrol for screens, signal yellow for the planning
engine, chilled blue for the database.
