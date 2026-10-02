# Relay, by Team Ryzera

Relay plans Waypoint Group's overnight store deliveries from the order to the confirmed receipt: store managers order,
the dispatcher plans and publishes trips with an engine that checks every operating rule, loaders load in reverse stop
order on a shared dock tablet, and drivers record each stop on a phone that keeps working with no signal. All four
roles work on one record per order, so a shortfall, a moved stop or a lost signal reaches everyone it affects.

**Live demo: https://relay-ryzera.tech** (the same stack as below, with the demo bar on).

## Accounts

Every account is seeded on first start. The password is `relay2026` (set by `RELAY_SEED_PASSWORD`).

| Role | Username | Password | PIN | What to look at | Screen size |
|---|---|---|---|---|---|
| Store manager: Dilani Jayawardena, OUT117 Waypoint Fresh Hemmathagama | `dilani` | `relay2026` | | My orders, Place an order, the Delivery update notice, Track delivery, Confirm receipt | Phone, 375 x 812 |
| Dispatcher: Nuwan Perera, Peliyagoda planning office | `nuwan` | `relay2026` | | Queue, Plan (board, Review deferral, Publish check), Live (runs and Exceptions), Outlook. Keys 1 to 4 switch screens | Desk, 1440 x 900 |
| Loader: Mohamed Rizwan, Kandy hub dock | `rizwan` | PIN sign-in | `2580` | Tonight's loads, VEH045 trip 1 in reverse stop order, Flag, Handover | Phone, 375 x 812 (the same screens serve the dock tablet) |
| Driver: Kasun Bandara, VEH045 | `kasun` | `relay2026` | `3690`, to accept a load on the dock tablet | Today's run, Stop, Proof of delivery, Report a problem, Trip summary, the question after the silence | Phone, 375 x 812 |

The loader role signs in on a PIN pad: tap a name, enter the PIN. Suresh Kumar (`suresh`, PIN `4826`) and Anjali
Wickramasinghe (`anjali`, PIN `1357`) share the Kandy hub tablet with Rizwan; **Switch** changes loader, and Suresh's
screens come up in Tamil, Anjali's in Sinhala. With demo mode on, the sign-in page shows each account's password or
PIN under the field.

Each role keeps its own session cookie, so one browser can stay signed in as all four roles, one tab each.

## Quick start with Docker

Needs Docker with Compose v2. Nothing else is installed on the host.

```bash
git clone https://github.com/kalanas210/Ryzera_Relay.git relay
cd relay
docker compose up
```

Open **http://localhost:8080**. Compose builds the images on the first run, starts PostgreSQL 16, runs the one-shot
`migrate` service (Alembic migrations, then the seed: the network, the people and the story day, only what is
missing), and starts `api` (FastAPI) and `web` (Caddy serving the built app and proxying `/api`) once it succeeds.
Use `docker compose up --build` after pulling changes.

No `.env` is needed. To change a setting, copy `.env.example` to `.env`:

| Setting | Default | What it does |
|---|---|---|
| `RELAY_PORT` | `8080` | Host port the app is served on |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `relay` | Database credentials; the API's connection string is built from them |
| `RELAY_SECRET_KEY` | a local-only value | Signs the session cookies. Use a long random value on any shared server |
| `RELAY_SEED_PASSWORD` | `relay2026` | Password of every seeded account. People are seeded once, so set it before the first start |
| `RELAY_DEMO_MODE` | `true` | Shows the demo bar and the accounts on the sign-in page. `false` hides both and turns off the clock, copy and reset endpoints |
| `SITE_ADDRESS` | `:80` | Production only: the domain Caddy gets an HTTPS certificate for |
| `RELAY_COOKIE_SECURE` | `false` | Production only: cookies are sent over HTTPS only |

The first proposal for a depot on a new database runs the solver, which takes about half a minute; after that Relay
answers the same question from its engine cache in under a second.

**Reset.** One copy of the day: **Demo controls**, **Reset this copy** puts it back to Tuesday 2:05 PM. Everything:
`docker compose down -v`, then `docker compose up`, drops the database volume and seeds again.

## Judge walkthrough

The story runs on a scenario clock from Tuesday 7 April 2026, 2:05 PM, to Wednesday morning, and moves in real time
between jumps. The demo bar at the top of every screen shows the scenario time, your walkthrough code, a button for the
next story moment and **Demo controls**, which lists every moment with **Go**. When you jump, Relay plays the steps of
the four characters that you skipped (the story autopilot) and names them under the bar; a step you already took is
never played again. The other stores, loaders and drivers act on their own as the clock passes (the world simulator).
Moments that depend on Kasun's truck move with it: once the Kandy plan is published, Handover at the dock reads 3:16 AM.

1. **Any role, desk, sign-in page, Tuesday 2:05 PM.** Open **Demo controls** and choose **Start a private copy**.
   Notice the new code beside "Walkthrough": this copy and its clock are yours alone, and a phone can join it with
   **Join** and the code.
2. **Store manager (`dilani`), My orders, phone, 2:05 PM.** Tap **Place an order**. Chilled is selected: enter
   Dairy crate 40, Produce crate 32, Meat and fish box 20, then **Send order**. Tap **Place your dry order**: Rice and
   dhal case 36, Packet foods case 44, Tea and biscuit case 22, **Send order**. Notice "Received by Waypoint" with the
   order number (ORD0098596 and ORD0098595), weight and volume worked out as you type, the cutoff countdown, and that
   chilled and dry goods go as separate orders. These are the story's quantities; other numbers give a different plan.
3. **Dispatcher (`nuwan`), Queue, desk.** Choose **Kandy hub**, then jump **3:12 PM: Chasing the last orders** and
   **4:00 PM: Cutoff: the queue locks**. Notice orders arriving as other stores order, the Not ordered yet list,
   "VEH039 and VEH058 are in the workshop", the **Waited Monday** flag on Kegalle's chilled order, and at 4:00 PM
   "Locked at 4:00 PM" with 57 Kandy hub orders and 5 of 7 refrigerated vehicles free.
4. **Dispatcher, Plan, desk, 4:00 PM.** Choose **Go to plan board**, then **Propose plan**. Notice "Kandy hub: 57
   orders, 56 on 18 trips, 1 waits", the Not placed card for OUT117 Hemmathagama's chilled order, and VEH045 trip 1 to
   Kegalle leaving 3:29 AM. Filter **Refrigerated** and drag the Hemmathagama card onto VEH057 Trip 2. Notice "3 rules
   broken" (1,460.8 of 1,040 kg, 7.676 of 7.0 m³, Aranayake at 8:01 AM after its 7:30 close) and "Fix 3 broken rules
   to publish". Press Ctrl Z to undo. (If you jump to 4:35 PM without proposing, Relay proposes for you.)
5. **Dispatcher, Review deferral (the deferrals drawer).** Read **Unavoidable: one chilled order waits** (5
   refrigerated vehicles can serve 22 of the 23 chilled orders) and **Relay's choice: which order waits**: rule 1
   leaves only OUT117 and OUT119, and rule 2 protects OUT119 Kegalle because its Monday order waited. Read what the
   choice costs, "Thursday checked: VEH039 has room", and "What OUT117 will see". Choose **Use Relay's reason**, then
   **Confirm deferral**. Relay opens the Publish check.
6. **Dispatcher, Publish check, moment 6:39 PM: Publishing the plan.** Jump with **Go** in Demo controls (Relay
   publishes Peliyagoda at 6:31 PM on the way). The Publish check (also opened by the plan bar's **Publish plan**) says
   no planned arrival is after its window, and "Relay expects 6 of the 53 Fresh stops to arrive after their window",
   each with **Why Relay keeps it**. Press **Publish plan** under the table, read in the dialog who is told, and press
   **Publish plan**. Notice "Published 6:39 PM" and "Sent to the dock, the drivers and every store on these trips."
7. **Store manager, My orders, phone, moment 6:41 PM: Stores read their notices.** Notice "1 order coming, 1 moved to
   Thursday" and the dry order expected around 5:20 AM on VEH045. Tap **Read the notice**: Was and Now, and Why it
   moved in plain words. Tap **Got it**; the screen reads "Seen 6:41 PM. The dispatcher can see this."
8. **Dispatcher, Plan, desk: the 9:12 PM change.** Filter **Ambient**, open VEH045 trip 1, and press the up arrow
   beside Mawanella (**Move Mawanella earlier, to stop 2**). Read the cost before anyone is told: "Hemmathagama becomes
   stop 3: expected 6:25 AM, was 5:20 AM", Aranayake's margin before its close, and who will be told. Write a reason
   and press **Swap stops**. If you skip this step, the next jump plays it at 9:12 PM as the story does.
9. **Loader (`rizwan`, PIN 2580), Tonight's loads, phone, moment 2:40 AM: Loading at the Kandy hub.** Notice the
   banner "VEH045 stops 2 and 3 swapped" and that Relay played "Rizwan loads the last stop first". Open VEH045: lines
   run in reverse stop order ("Stop 4 goes in first, at the cab end") and Hemmathagama shows "Was stop 2 until" the
   time of the change. On stop 3's Rice and dhal line tap **Flag**, keep **Missing**, set 6 and tap **Flag 6
   missing**. Notice "Only 30 were on the shelf" and that the line waits for Nuwan while loading goes on.
10. **Dispatcher, Live, desk.** The Exceptions panel shows "6 rice and dhal cases missing on VEH045, stop 3" with the
    hub's stock and both choices. Choose **Send short, add to Thursday**. Notice "Dilani Jayawardena was told." and
    that the 6 cases join Dilani's Thursday dry order ORD0098747.
11. **Loader, VEH045, phone.** The line now reads "30 loaded, 6 short, 6 come on Thursday" and "Nuwan answered". Tap
    each remaining line as its cases go on, then **Go to handover**: the shortfall and the planned and loaded cases
    per stop (383 planned, 377 loaded). Tap **Load complete**.
12. **Driver (`kasun`), Today's run, phone, moment 3:16 AM: Handover at the dock.** The handover is on the phone:
    "Stop 3 is 6 rice and dhal cases short" and the planned and loaded table. Tap **Accept load**. (If the phone has
    no signal, the tablet's **Kasun accepts on this tablet** takes PIN 3690.) **Leave the hub** saves the time the
    truck drives out; if you skip it, the next jump plays Kasun leaving at 3:33 AM.
13. **Driver, Stop and Proof of delivery, phone, moment 4:52 AM: First stop, Kegalle.** Relay plays Kasun leaving the
    hub and arriving. Open stop 1: "Arrived 4:52 AM. 30 min behind plan" beside the expected time and the receiving
    window. Tap **Record delivery**, type the receiver's name, take a photo (or **Use a signature instead**) and
    **Complete stop**: "Relay has it, and the store can see it now."
14. **Driver, phone: the signal drops.** Either turn on **Kasun's phone: no signal** in the demo bar at any time, or
    jump to **5:41 AM: Signal lost near Mawanella**, when a storm takes the phone offline whoever holds it until 7:14
    AM. Record the Mawanella delivery anyway: "Stop 2 saved on this phone" and "1 stop to send". With the switch on,
    reload the page: the run and the waiting record come back from the phone. Keep recording Hemmathagama and Aranayake
    offline, or leave them: a jump plays only the stops nobody recorded.
15. **Dispatcher, Live, desk, moment 6:05 AM: The office sees the silence.** VEH045 reads "No contact since" the last
    time the phone reached Relay (5:41 AM on the story's times), with the last record and, for each stop to come, an
    estimate and a likely range (on the story's times Hemmathagama around 6:35, Aranayake around 7:15, likely 6:45 to
    7:45). Notice "Aranayake's likely range already runs past its 7:30 AM close" and "Relay can't tell a lost signal
    from a flat battery".
16. **Dispatcher, Live, desk, moment 6:15 AM: A backup for Aranayake.** Press **Move** on stop 4. The drawer puts
    VEH060, the hub's standby van, beside Kasun's own estimate, says it arrives around 8:05 AM after the close and why
    it is still worth sending, and marks refrigerated vehicles **Not suitable**. Write a reason and press **Move stop 4
    to VEH060**. Notice "Nimal, the Kandy hub dock and the store have been told" and "Kasun hasn't seen this yet".
17. **Store manager, Track delivery, phone, during the silence.** The tracker keeps Planned and Expected, says when
    Kasun was last heard and gives the likely range. Once the estimated time has passed, it offers **Confirm receipt**
    for goods already at the dock. Jump to **6:40 AM: Hemmathagama confirms receipt**, tap **Confirm receipt**, check
    the lines (rice and dhal reads "6 short. You were told at" the time of Nuwan's decision) and tap **Everything
    arrived**. Notice "Driver's proof: waiting for Kasun's phone".
18. **Dispatcher, Live, desk.** Exceptions shows "Hemmathagama confirmed receipt": "The store confirmed receipt, so
    Kasun has been there", Relay moves Aranayake's estimate from the receipt, and asks **Keep backup** or **Cancel
    backup**. Keep it: Kasun is still out of contact.
19. **Driver, Today's run and Trip summary, phone, moment 7:14 AM: Signal back at Aranayake.** Turn the no-signal
    switch off if you used it. The phone sends what it saved, in order, each with its own time, then asks one question
    at the top of the screen you are on: "Stop 4 was also given to Nimal", with Kasun's record and "Is your record
    right?". Tap **Yes, I delivered it**: "Stop 4 is settled" and VEH060's visit is cancelled. Open the trip summary:
    each stop saved with no signal reads "Saved offline, sent 7:14 AM". Tap **Finish trip**.
20. **Dispatcher and store manager, moment 7:22 AM: Everything settled.** On Live, VEH045 reads "Run finished",
    "Offline 5:41 to 7:14" and the records received; VEH060 "Turned back to the Kandy hub"; Exceptions lists "Kasun
    Bandara back in contact" and "Stop 4 conflict resolved". On Dilani's My orders, tap **See the receipt and Kasun's
    proof**: "Proof of delivery from Kasun Bandara" has joined the receipt, with the photo, the delivery time, the
    receiver's name and "Saved on Kasun's phone ... and sent at 7:14 AM". The 6 rice and dhal cases and the chilled
    order are listed for Thursday.
21. **Dispatcher, Outlook, desk.** The Kandy hub's six weeks: forecast demand by brand, chilled space against the
    refrigerated fleet, the vehicles needed on each week's busiest day, Wednesday 29 April as the heaviest (6 of 7
    needed), and what to arrange. Choose **Peliyagoda**: it says plainly that no forecast is set up there yet.
22. **Dispatcher, Plan, desk: try the engine.** Start another private copy, jump to **4:00 PM: Cutoff: the queue
    locks** and press **Propose plan**. While you drag the waiting chilled order, the dry-box trips say "Needs a
    refrigerated vehicle"; drop it on VEH045 anyway and read "Chilled goods need a refrigerated vehicle". Press
    **Propose again** and confirm: Relay re-plans every order, your moves included. Then open **Review deferral**,
    press **Defer anyway** on the protected OUT119 Kegalle, give a reason and press **Defer OUT119**: Relay re-plans
    so Kegalle waits with your reason and Hemmathagama rides. Choose **Peliyagoda** and **Propose plan**: 79 orders on
    26 trips, nothing waits.

## Try to break it

- **Offline reload.** As the driver, turn on **Kasun's phone: no signal**, record a stop and reload. The run and the
  waiting record come back from IndexedDB; switch the signal back outside the storm (5:41 to 7:14 AM) and the pill
  turns to "All synced".
- **Resend.** Every driver record and photo carries the id the phone gave it, so a resend is answered as a duplicate
  and written once (`apps/api/tests/test_field.py`, `test_story_road.py`). A store order, receipt or issue carries a
  `client_ref` kept across **Try again**, so a resend returns what was already written (`services/ordering.py`,
  `services/tracker.py`, `test_store_road.py`).
- **Two copies.** Start a private copy in a second browser, or **Join** your code from a phone. Each copy has its own
  clock, orders, plan and records, and **Reset this copy** touches only yours.
- **Rule-breaking drags.** Drop any order on any trip: the drop is checked against all eleven rules, the trip says
  which broke and why, and **Publish plan** stays off until they are fixed or undone.
- **Wrong PIN.** The dock tablet answers "That PIN did not match. Try again." and stays on the PIN pad.
- **The clock.** Moments already passed show **Passed**; the clock only moves forward, and Reset is the way back.

## Departures from the Designathon design

- **VEH045 leaves at 3:29 AM, not 3:40.** The board shows the engine's own plan; the design's boards used a plan
  worked out with the scenario model before the engine existed. Kasun's planned and expected times are about 11
  minutes earlier (Kegalle planned 4:22 AM, design 4:33), and Handover at the dock reads 3:16 AM. Kasun leaves at
  3:33 AM (design 3:44), so the 4:52 AM arrival at Kegalle reads 30 min behind plan (design 19).
- **The 9:12 PM change swaps stops 2 and 3.** In the design Nuwan swapped Aranayake and Hemmathagama to reach the
  Aranayake hill road after first light; here the engine already puts Hemmathagama at stop 2, so the change moves
  Mawanella ahead of it, because Mawanella's curb is a bus stop from 5:30 AM. Dilani's delivery moves later (around
  5:20 to around 6:25 AM) where the design moved it earlier, and the dock shows Hemmathagama as "Was stop 2".
- **6 of the 53 Fresh stops are expected after their window, not 5.** It is the engine's plan; each one is listed in the
  publish check with Relay's reason.
- **VEH055 runs the Kandy dry trip the design gave VEH049**, and other trips differ from the design's story boards, for
  the same reason: the build shows what `packages/engine` proposes.
- **Live updates poll.** The build plan proposed server-sent events; screens refresh every 8 to 30 seconds (Live runs
  every 10), so a change reaches another screen up to one interval late. Plain requests on a timer carry the same role
  header and workspace cookie as every other call and keep no connection open.
- **Nothing is pushed to a closed app.** The design sends the 2:47 AM shortfall to Nuwan's phone at home; in the build
  a notice or feed item appears on the next poll while Relay is open on the device. There is no web push or SMS.
- **The outbox does not use Background Sync.** The design asks for it on Android Chrome. The phone sends when the
  browser reports it is online, when Relay comes to the front, after each new record and with the minute check-in,
  so records still waiting when Relay is closed are sent the next time it is opened.
- **The question after the silence is not held while the truck moves.** The card shows at once at the top of the
  driver's screen, with no pop-up and no sound; a web app cannot reliably tell that a vehicle is moving.
- **Photos the autopilot records are a drawn stand-in**, generated in code, so the seed carries no image files.
  Photos a judge takes on the driver's phone are kept and shown.
- **No location stamps or distances on the office and store screens.** The driver's phone saves a location reading
  with each arrival, delivery and report when the browser allows it, but outlets have no coordinates in the data,
  so there is nothing to show it against.
- **The driver has no Call the store or Call dispatch button.** The outlet data has no phone numbers, so there is
  nothing to dial for a store. The driver's report screen names Nuwan in words ("In an emergency, call Nuwan at
  dispatch") instead of a dial button; the dock's flag sheet does show the dispatcher's on-call number, which is
  invented for the story.
- **Remind, Remind all and Call on the order queue do nothing yet.** They are drawn as designed but not wired.
- **A delay report does not move expected times.** Estimates come only from stop events and receipts; the run's line
  names the reported delay beside them.
- **Peliyagoda has no capacity forecast.** The design draws DSP-05 for the Kandy hub only, and the seed builds no
  forecast for Peliyagoda, so the depot switch shows an empty state there.

## Development setup without Docker

Needs Python 3.11 or later with [uv](https://docs.astral.sh/uv/) 0.11, Node 22 with pnpm 10 (`corepack enable`), and
Docker for the development database.

```bash
uv sync                      # the engine, the API and the dev tools, from uv.lock
pnpm install                 # the web app, from pnpm-lock.yaml

# PostgreSQL 16 for development, on port 55432
docker run -d --name relay-dev-db -p 55432:5432 \
  -e POSTGRES_USER=relay -e POSTGRES_PASSWORD=relay -e POSTGRES_DB=relay postgres:16-alpine

export RELAY_DATABASE_URL=postgresql+psycopg://relay:relay@localhost:55432/relay
uv run relay-api setup       # migrate, then seed

# two dev servers, each in its own terminal (RELAY_DATABASE_URL set in the first)
uv run --directory apps/api uvicorn relay_api.main:app --port 8765 --reload --reload-dir src
pnpm dev                     # http://localhost:5173, proxies /api to http://localhost:8765
```

In PowerShell, set the variable with
`$env:RELAY_DATABASE_URL = "postgresql+psycopg://relay:relay@localhost:55432/relay"`. Vite answers on every
loopback name, and each name under `.localhost` keeps its own cookies, so `http://a.localhost:5173` and
`http://b.localhost:5173` are two independent browsers on one machine. Set `RELAY_API_URL` to point the proxy
elsewhere.

Checks, as CI runs them:

```bash
uv run ruff check .
uv run ruff format --check apps packages
uv run pytest                    # API tests need PostgreSQL at RELAY_TEST_ADMIN_URL (default: the dev database above)
pnpm --filter @relay/web lint    # Biome
pnpm --filter @relay/web test    # Vitest
pnpm --filter @relay/web build   # TypeScript check and production build
```

`uv run python tools/data_model.py` rewrites `docs/data-model.md` from the models. `seed/scripts/build_story.py`
rebuilds `seed/data/story` and `seed/data/derived` from the organizers' dataset in `data/raw`, which git ignores; the
committed seed means `docker compose up` never needs it.

## Tests and CI

- **Engine** (`packages/engine/tests`): the published trip-time standard against the booklet's worked examples, the
  eleven rules on the design's plan-board moves, both clocks against the scenario's figures, the Kandy hub proposal
  (which chilled order waits, and why), and the estimate during a silence on the story's numbers.
- **API** (`apps/api/tests`): against a real PostgreSQL. Each run creates a throwaway database, migrates and seeds it
  like a fresh install, and drops it at the end; with no server at `RELAY_TEST_ADMIN_URL` the API tests are skipped
  and the engine tests still run. They cover the dock night, changes after publishing, Kasun's morning with the
  outbox, resends and the one question, the store's side, the demo jumps (a new copy jumped to each moment of Kasun's
  morning, and to the dock and the handover, finds what the design draws), accounts across copies, and the capacity
  outlook.
- **Web** (`apps/web`, Vitest with jsdom): the driver's outbox order and resends, the sync pill, the phone's records
  over the server's run, loader counts, optimistic taps and flags, PIN sheets, the live feed and its decisions, store
  wording and Confirm receipt, the outlook grid, and clock times in three languages.

CI (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request, in three jobs: Ruff lint and
format and `pytest` with a PostgreSQL 16 service; Biome, Vitest and the TypeScript build of the web app; and
`docker compose build` of every image. There is no browser end-to-end test yet: `e2e/` holds only its `package.json`.

## Repository layout

| Path | What it holds |
|---|---|
| `apps/api/` | FastAPI app: routers, services, SQLAlchemy models, Alembic migrations, the seed loader, the story autopilot (`services/story.py`) and the world simulator (`services/world.py`); tests in `tests/` |
| `apps/web/` | The React and TypeScript web app for all four roles (Vite, Tailwind, TanStack Query, Dexie for the driver's outbox), installable with an offline shell; its image serves it with Caddy |
| `packages/engine/` | The planning engine in plain Python: the eleven rules, the trip-time standard, the Planned and Expected clocks, the proposal (SciPy MILP), deferrals and the silence estimate. No database or web code |
| `seed/data/` | The organizers' reference tables, the story day and the derived tables the seed loads |
| `seed/scripts/` | `build_story.py`, which builds the seed data from the raw dataset |
| `tools/data_model.py` | Writes `docs/data-model.md` from the models |
| `tools/data-check/` | The Designathon scenario check against the competition data |
| `infra/` | Terraform for the server, the deploy script and the server's start and backup scripts |
| `docs/` | Architecture, data model, AI tool disclosure, the build plan and the Designathon design |
| `e2e/` | Reserved for the Playwright walkthrough; only its `package.json` so far |
| `docker-compose.yml`, `.env.example` | The whole stack for `docker compose up`, and its settings |
| `docker-compose.prod.yml` | The production overlay: Caddy on 80 and 443 with its certificates in a volume |
| `.github/workflows/ci.yml` | Lint, tests and image builds on every push |

## Deployment

The public demo at https://relay-ryzera.tech runs the same Compose stack on one AWS EC2 server in Mumbai
(`ap-south-1`), with `docker-compose.prod.yml` putting Caddy on ports 80 and 443 with an automatic HTTPS certificate.
Terraform in `infra/terraform` creates the server; `infra/deploy.sh` ships the committed `HEAD` with `git archive`
and rebuilds there, so uncommitted work is never deployed; `infra/server/up.sh` writes random secrets on the first
deploy, and a nightly `pg_dump` keeps the newest 14 backups. Demo mode is on, so judges get the demo bar and their own
copies of the day. See [infra/README.md](infra/README.md).

## Documents

- [docs/architecture.md](docs/architecture.md): the architecture diagram, the decisions and their costs
- [docs/data-model.md](docs/data-model.md): every table and relationship, generated from the models
- [docs/ai-disclosure.md](docs/ai-disclosure.md): the AI tool disclosure for the Hackathon
- [docs/ai-usage-log.md](docs/ai-usage-log.md): the running log of AI use across the phases, which the disclosure
  draws on
- [docs/build-plan.md](docs/build-plan.md): the build plan, stack and scope accepted on 30 September, unchanged since;
  where the build differs, this README and the architecture page describe the build
- [docs/design/](docs/design/): the Designathon design documents, used as the build's specification: problem framing,
  personas, screens and flows, style guide, scenario data, core tradeoff and the per-role specs (the submission as
  handed in is the tag `designathon-submission`)

## Team Ryzera

Each member owns one part of the Designathon design for review. What a member reviews, tests or changes in the
Hackathon build goes in the "What the team did" column of [docs/ai-usage-log.md](docs/ai-usage-log.md).

| Member | Part they review |
|---|---|
| Kalana | Lead: problem framing, scope, core tradeoff, final submission |
| Kavitha | Dispatcher screens |
| Induwara | Loader screens |
| Bhathiya | Driver screens |
| Hirantha | Store Manager screens |
| Mandira | Style guide and design system |
| Dinithi | Degradation scenario, demo video, Designathon AI disclosure |
