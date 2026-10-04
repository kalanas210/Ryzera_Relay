# Dispatcher guide

Nuwan Perera plans the overnight store deliveries for the Peliyagoda depot and the Kandy hub from the Peliyagoda planning office. In Relay, Nuwan watches the orders come in until the 4:00 PM cutoff, checks and publishes the plan Relay proposes, and then follows every run through the night, answering what comes up, from a shortfall at the dock to a driver who goes silent.

**Open it.** Go to https://relay-ryzera.tech in a desk-size window (1440 x 900). The shared walkthrough holds its clock at 2:05 PM, so open **Demo controls** in the bar at the top and choose **Start a private copy**. On "Who is signing in?", choose **Dispatcher**: `nuwan` is already filled in, so enter the password `relay2026` and press **Sign in**. To move the clock, open **Demo controls** and press **Go** beside a moment. The clock only moves forward, so follow the screens in this order.

## DSP-01 Order queue

- **What it is for:** Seeing every order for Wednesday as the stores send it, with flags for what limits how it can travel, and chasing the Fresh outlets that have not ordered before the 4:00 PM cutoff with **Remind** and **Remind all**.
- **How to reach it:** It is the first screen after sign in. Choose **Kandy hub**, then press **Go** beside **3:12 PM: Chasing the last orders**. Later, **4:00 PM: Cutoff: the queue locks** shows "Locked at 4:00 PM".
- **Notice:** Kegalle's chilled order carries the **Waited Monday** flag, because its Monday chilled order waited a day. Relay remembers this, and the deferrals drawer protects Kegalle for that reason.

## DSP-02 Plan board

- **What it is for:** Checking and adjusting the plan Relay proposes for one depot, with every vehicle as a lane, how full each trip is, and the orders that do not fit. Relay checks all eleven rules on every drop.
- **How to reach it:** Press **Go** beside **4:00 PM: Cutoff: the queue locks**, then **Go to plan board** on the queue, and **Propose plan**.
- **Notice:** Filter **Refrigerated** and drag the OUT117 Hemmathagama card from Not placed onto VEH057 Trip 2. Relay never refuses the drop. It names the 3 broken rules in plain words ("Weight: 1,460.8 of 1,040 kg. Volume: 7.676 of 7.0 m³. Window: OUT117 at 8:01 AM, closes 7:45.") and keeps **Publish plan** off until they are fixed. Press Ctrl Z to undo.

## DSP-03 Deferrals

- **What it is for:** Explaining why an order waits for the next run before any store is told: what no plan could avoid, which order Relay chose and by which rule, and the exact words the waiting store will read.
- **How to reach it:** On the plan board, press **Review deferral**. The drawer is called "Deferrals for the Kandy hub".
- **Notice:** The drawer keeps what was unavoidable ("5 refrigerated vehicles can serve 22 of the 23 chilled orders") apart from Relay's choice, and rule 2 protects OUT119 Kegalle because its Monday order waited. **Use Relay's reason** and **Confirm deferral** take you on to the Publish check.

## DSP-04 Live runs

- **What it is for:** Following every run of the published plan stop by stop, built from the drivers' own records rather than tracking, with an Exceptions feed for what needs Nuwan, such as moving a stop to a backup vehicle.
- **How to reach it:** Press **Go** beside **6:05 AM: The office sees the silence**, then choose **Live**.
- **Notice:** VEH045 reads "No contact since" 5:41 AM, the last time Kasun's phone reached Relay, and each stop still to come shows an estimate and a likely range. Relay says plainly that it can't tell a lost signal from a flat battery.

## DSP-05 Capacity outlook

- **What it is for:** Showing, six weeks ahead, when the Kandy hub will need every refrigerated vehicle it has, and what to arrange.
- **How to reach it:** Choose **Outlook**. No jump is needed: it reads the same at any moment after the Kandy plan is published.
- **Notice:** The headline: "Wednesday 29 April is the heaviest of the 5 Wednesdays ahead, and like each of them it needs 6 of the 7 refrigerated vehicles." The page says why: space is not the limit, but the number of stores and their windows before 8 AM are.

## Keyboard shortcuts

Press **?** on any desk screen for the full list. The keys are off while a text field has focus, and none of them sends anything to a store or a driver.

- **1, 2, 3, 4:** Queue, Plan, Live, Outlook.
- **Shift A, Shift P, Shift K:** depot All, Peliyagoda or Kandy hub, where the depot switch allows it.
- **Esc:** close a drawer, menu or dialog.
- **Plan:** P proposes again, D opens the deferrals, Ctrl Z undoes the last move, and Ctrl Enter opens the Publish check, then the Publish dialog. Ctrl Z and Ctrl Enter also work with Cmd on a Mac.
- **Plan, on a focused stop or order card:** M opens a list of trips to move it to. Space or Enter picks it up, the arrow keys move it, and Space or Enter drops it. Esc puts it back.
- **Live:** / goes to the search, and Up and Down move between runs and between feed items.

## Where the code lives

The screens are in [apps/web/src/roles/dispatcher/](../../apps/web/src/roles/dispatcher/): the shell and the queue, then `plan/`, `live/` and `outlook/`. The server side is in `apps/api/src/relay_api/`: the routers [routers/dispatch.py](../../apps/api/src/relay_api/routers/dispatch.py) (queue and outlook), [routers/plan.py](../../apps/api/src/relay_api/routers/plan.py) (plan board, deferrals and publishing), [routers/live.py](../../apps/api/src/relay_api/routers/live.py) and [routers/runs.py](../../apps/api/src/relay_api/routers/runs.py) (live runs), and the services they call, mainly [services/planning.py](../../apps/api/src/relay_api/services/planning.py), [services/board.py](../../apps/api/src/relay_api/services/board.py), [services/drawer.py](../../apps/api/src/relay_api/services/drawer.py), [services/live.py](../../apps/api/src/relay_api/services/live.py), [services/runs.py](../../apps/api/src/relay_api/services/runs.py) and [services/outlook.py](../../apps/api/src/relay_api/services/outlook.py).

Tests: [test_queue.py](../../apps/api/tests/test_queue.py), [test_board.py](../../apps/api/tests/test_board.py), [test_plan_deferrals.py](../../apps/api/tests/test_plan_deferrals.py), [test_changes.py](../../apps/api/tests/test_changes.py), [test_runs.py](../../apps/api/tests/test_runs.py) and [test_outlook.py](../../apps/api/tests/test_outlook.py) in `apps/api/tests/`, and the dispatcher's steps of [e2e/tests/walkthrough.spec.ts](../../e2e/tests/walkthrough.spec.ts) (3 to 6, 8, 10, 15, 16, 18, 20 and 21), with test 22, which tries the engine.
