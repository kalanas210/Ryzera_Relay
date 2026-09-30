# Relay: Hackathon build plan

Due **Sunday 4 October 2026, 11:59 PM** Sri Lanka time. We aim to submit by 8 PM that day.
The Designathon design in `docs/design/` is the implementation specification.

## What the judges score, and how we answer

| Criterion | Weight | Our answer |
|---|---|---|
| Engineering quality and architecture | 25% | A planning engine kept apart from the web framework and fully unit tested. One command starts everything. Typed from the database to the screen. The judge walkthrough runs as an automated end-to-end test in CI. Architecture, data model and decisions are written down in `docs/` |
| Functional completeness across all four roles | 20% | All 24 designed screens, working on real data that moves between roles. Nothing on a screen is a mock |
| Planning and allocation engine | 20% | Every operating constraint is checked. The proposal starts from each vehicle's usual run, and an exact search fills the rest. Deferrals follow three written rules, and the engine says which were unavoidable and which were its choice. A judge can send vehicles to the workshop and watch the plan respond |
| Degradation, offline operation and recovery | 10% | The driver app is offline first: an on-device outbox, idempotent sync, a check-in every minute, honest estimates during silence, and a conflict question on reconnect |
| Fidelity to the Day 5 design | 10% | Same screens, tokens, type, components and copy. The seed reproduces the design's story day, so the prototype and the app show the same numbers |
| Demo video | 10% | Script and shot list from us, voice from the team, the offline moment on a real phone |
| Creativity | 5% | Explainable deferrals, Planned and Expected times, trilingual field screens, the shared tablet PIN switch, a fleet simulator that makes Live runs real |

## Architecture

```
apps/web          React, TypeScript, Vite; one installable PWA for all four roles
apps/api          FastAPI, SQLAlchemy, Alembic; REST, plus server-sent events for live updates
packages/engine   The planning engine in pure Python: rules, trip time, clocks, proposal, deferrals
seed/             The organizers' reference tables, the story day, and the loader
e2e/              Playwright: the judge walkthrough and the offline scenario
docs/             Architecture, data model, decision records, AI disclosure, the design
PostgreSQL 16, Caddy, Docker Compose
```

Decisions that shape the build:

1. **The engine is a library.** It takes plain data in and returns plain data out, with no database or web code, so it can be tested on its own and reused for Datathon Task 2B. The API adapts database rows to it.
2. **A scenario clock.** The story runs from Tuesday 7 April 2:05 PM to Wednesday 8 April 7:30 AM, 2026. Each copy of the day carries its own clock, and a demo bar jumps it to the next moment in the story. Every time the system records is scenario time.
3. **Judge copies.** Several judges may use the deployment at once. Every operational row belongs to a workspace, so a judge can start a private copy of the day in one click and reset it at any time, and join the same copy from a phone with a QR code.
4. **A world simulator.** Stores, loaders and drivers the judge is not playing act on schedule as the clock moves, so the queue fills before the cutoff and Live runs shows a real morning.
5. **Stop events, not GPS.** Progress is built from the records drivers make (arrived, delivered, failed, delayed), each with a time and a location stamp taken at that moment.
6. **Offline first, with an outbox.** Driver actions are written to IndexedDB first and sent in order with client-generated IDs, so a resend is harmless. Stop records go before photos. The server detects a record that clashes with a change made while the phone was silent and asks the driver one question.

## Scope and cut line

**Must** (we do not submit without these)
- Dispatcher: DSP-01 Order queue, DSP-02 Plan board, DSP-03 Deferrals, DSP-04 Live runs
- Loader: LDR-01 Tonight's loads, LDR-02 Load vehicle, LDR-03 Flag a shortfall, LDR-04 Handover
- Driver: DRV-01 Today's run, DRV-02 Stop, DRV-03 Proof of delivery, DRV-04 Report a problem, DRV-05 Trip summary
- Store Manager: STM-01 My orders, STM-02 Place order, STM-03 Deferral notice, STM-04 Arrival tracker, STM-05 Confirm receipt
- Degradation: DEG-01 to DEG-05
- The engine, the seed, `docker compose up`, the README, `docs/`, a public deployment

**Should**
- DSP-05 Capacity outlook, live updates over server-sent events, Sinhala and Tamil field screens, driver night mode, the world simulator, judge copies, the end-to-end test in CI, a story autopilot that plays the steps a judge skips

**Could**
- The loader's tablet load map, web push notices, quiet hours for night notices

## Schedule

| Day | Build | Done when |
|---|---|---|
| Wed 30 Sep | Cleanup, monorepo, Compose, schema and migrations, seed, sign-in and seeded accounts, scenario clock | `docker compose up` shows sign-in and each role's home screen on real data |
| Thu 1 Oct | Engine with tests; DSP-01, DSP-02, DSP-03 | Propose, drag, check and publish work; the deferral drawer shows the story's numbers |
| Fri 2 Oct | LDR-01 to LDR-04, DRV-01 to DRV-05, outbox and service worker, photos, signature, location; first public deploy | A load goes from the dock to the road, offline included |
| Sat 3 Oct | STM-01 to STM-05, DSP-04, DEG-01 to DEG-05, DSP-05, languages, end-to-end tests; feature freeze at night | The whole walkthrough works on the public URL; the team records the video |
| Sun 4 Oct | Fixes, README, docs, AI disclosure, final deploy | Submitted by 8 PM |

## Judge walkthrough (draft)

1. Dilani, Store Manager: place Wednesday's chilled and dry orders and see "Received by Waypoint".
2. Nuwan, Dispatcher: the order queue fills, then locks at the 4:00 PM cutoff; late orders move to Thursday and their stores are told.
3. Plan board: Propose plan. Drag Dilani's chilled order onto VEH057 trip 2, read the broken rule, undo.
4. Deferrals: read what was unavoidable and what was Relay's choice, confirm the reason, run the publish check, publish.
5. Dilani: read the deferral notice and acknowledge it.
6. Rizwan, Loader, with a PIN: load VEH045 in reverse stop order and flag 6 rice and dhal cases missing for stop 3.
7. Nuwan, on his phone: send short and add the cases to Thursday.
8. Rizwan: finish the load and hand over. Kasun, Driver: accept the load.
9. Kasun: deliver with proof. The signal drops; he keeps working. Nuwan sees the silence, moves stop 4 to the standby van. The signal returns and Kasun answers one question.
10. Dilani: follow the arrival tracker, confirm receipt, see Kasun's proof. Nuwan: every stop on Live runs is settled.

## Team tasks

- Kalana: decisions, the server and domain, the note to the organizers, final review, submission.
- Saturday: native Sinhala and Tamil check of the field screens; test driver and loader on an Android phone and an iPhone; record the video.
- Sunday morning: one member clones the repo on their own laptop and runs `docker compose up`, exactly as a judge would.
- Everyone: record what you reviewed or changed in `docs/ai-usage-log.md`.

## Risks

| Risk | What we do |
|---|---|
| Scope against time | Keep the cut line; deploy every day; freeze features on Saturday night |
| The seed needs the shared datasets in the repo, and the terms say not to publish them | Keep the repository private and ask the organizers how judges should get access |
| iPhone Safari has no Background Sync | The outbox also sends when the phone comes online or the app comes to the front; test on an iPhone |
| Two judges in one deployment | Workspaces with a private copy and reset |
| The AI disclosure | Claude Code writes most of the code; the disclosure says so, with what the team reviewed, tested and decided |

## Decisions log

- 30 Sep: Designathon files moved out of the repository to `E:\CLAUDE PROJECTS\Ryzera_Designathon_archive\`; nothing deleted. The design documents are tagged `designathon-submission`.
- 30 Sep: Stack approved: React and TypeScript PWA, FastAPI, PostgreSQL, a Python engine.
- Open, decided at the end: where to deploy and on which domain; whether the Amathum voice agent joins after the core.
