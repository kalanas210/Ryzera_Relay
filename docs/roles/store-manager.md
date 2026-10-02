# Store manager guide

Dilani Jayawardena manages Waypoint Fresh Hemmathagama (OUT117), a store served from the Kandy hub. In Relay, Dilani orders the store's goods on a phone, hears what happens to each order, and confirms what arrives.

**Open it.** Go to https://relay-ryzera.tech on a phone (375 x 812) and sign in as `dilani` with the password `relay2026`. The shared walkthrough holds its clock at 2:05 PM, so tap the sliders icon at the right end of the bar at the top of the screen to open **Demo controls**, and choose **Start a private copy**. Then press **Go** beside a moment to move the clock.

## STM-01 My orders

- **What it is for:** Answering "is it coming, and when?", with one card for each order on the day shown.
- **How to reach it:** It is the first screen after sign in. Press **Go** at **6:41 PM: Stores read their notices** to see delivery times.
- **Notice:** The chilled order has its own card marked "Moved to Thursday", with the reason, so it cannot hide behind the dry order that is still on time.

## STM-02 Place order

- **What it is for:** Ordering by counting standard cases. Relay works out weight and volume as the counts go in.
- **How to reach it:** On My orders, tap **Place an order**.
- **Notice:** Chilled and dry go as two separate orders. In the last four hours before the 4:00 PM cutoff the form counts down to it. After 4:00 PM it says orders for Wednesday closed and that anything sent now goes on Thursday's run.

## STM-03 Notices

- **What it is for:** Telling Dilani about a change in plain words, such as a moved order or a short delivery, and letting the dispatcher know it was seen.
- **How to reach it:** Press **Go** at **6:41 PM: Stores read their notices**. On My orders, tap **Read the notice** on the moved chilled order. The screen is called "Delivery update".
- **Notice:** Tap **Got it**. The screen reads "Seen" with the time and "The dispatcher can see this", and only after Relay has the answer.

## STM-04 Arrival tracker

- **What it is for:** Showing when the truck is expected, taken from the driver's own records. While the driver's phone is quiet, it also says when to have someone at the dock.
- **How to reach it:** Press **Go** at **6:15 AM: A backup for Aranayake**. On My orders, tap **Track delivery**. The screen is called "Your delivery".
- **Notice:** While Kasun's phone is quiet, the card says "No word since" the last time it was heard, gives a "Likely between" range, and says the times are an estimate. On the story's times it reads "Arriving around" with 6:35 AM in large type, and "Planned 5:19 AM" on a smaller line below.

## STM-05 Confirm receipt

- **What it is for:** Checking the goods at the dock against what was loaded for the store, then confirming, or flagging a line that is wrong.
- **How to reach it:** Press **Go** at **6:40 AM: Hemmathagama confirms receipt**, then tap **Confirm receipt** on My orders. For the finished receipt, press **Go** at **7:22 AM: Everything settled** and tap **See the receipt and Kasun's proof**.
- **Notice:** Dilani can confirm while Kasun's phone still has no signal. The screen says "Driver's proof: waiting for Kasun's phone", and a problem can still be reported until 4:00 PM on the delivery day.

## Where the code lives

The screens are in [apps/web/src/roles/store/](../../apps/web/src/roles/store/). The server side is in `apps/api/src/relay_api/`: [routers/store.py](../../apps/api/src/relay_api/routers/store.py), [services/tracker.py](../../apps/api/src/relay_api/services/tracker.py) and [services/ordering.py](../../apps/api/src/relay_api/services/ordering.py).

Tests: [apps/api/tests/test_store_road.py](../../apps/api/tests/test_store_road.py), [apps/api/tests/test_store_orders.py](../../apps/api/tests/test_store_orders.py) and [e2e/tests/walkthrough.spec.ts](../../e2e/tests/walkthrough.spec.ts).

Tested on a phone in Firefox.
