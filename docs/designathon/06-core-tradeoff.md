# Core Tradeoff: explainable over optimal

> **v0.4 data alignment.** This page now matches `05-scenario-data.md` v0.4 and story board 13 as built.
> - "Dry orders wait before chilled ones" is gone. The policy is Relay's three numbered rules, and the deferral separates what was unavoidable from what was Relay's choice.
> - The examples are the v0.4 story: one chilled order waits with VEH039 and VEH058 in the workshop, and Nuwan's 9:12 PM stop swap on VEH045.
> - What we give up is now counted: the 499.4 kg the usual-runs rule leaves behind, and a plan stricter than the route history (73.8% of Kandy second Fresh trips planned without the drive back).
> - Nuwan reviews exceptions, not all 136 orders.
>
> Optional deliverable: one page on our main design tradeoff.

## The choice

We could have designed Relay to plan the day automatically: press one button and get the mathematically best allocation. We chose **assisted planning** instead. Relay proposes an allocation that respects every rule, then the dispatcher adjusts it, and Relay checks each change.

## What we gain

- **Decisions people can defend.** Relay says what was unavoidable and what was its choice. With two refrigerated vehicles in the workshop, one chilled order has to wait; which one is Relay's choice, by rule. Dilani hears both the evening before.
- **Room for what the data doesn't know.** The data has no daylight and no map inside a district. Nuwan swapped Kasun's last two stops so the hill road comes after first light, and Relay showed the cost first: Aranayake's margin fell from 54 to 17 minutes.
- **A policy, not a black box.** Three rules, in order: keep every other vehicle on its usual run; never make a store wait twice in a row without an override; keep the most goods moving. They are written down, shown in the deferral drawer, and easy to change.
- **Buildable in five days.** A rule checker and a proposal built from each vehicle's usual run are far safer to build and test in the Hackathon than a full route optimiser.

## What we give up

- **Some goods stay behind.** Usual runs come before moving the most goods. Letting the lightest order in the pool wait (OUT111 Hali-Ela, 159.8 kg) instead of Dilani's (659.2 kg) would move 499.4 kg more, but only by taking another vehicle off its usual run.
- **Stricter than the paper plan.** Relay counts the drive back to the hub, so an order can wait that the published standard alone would fit: on paper all 23 chilled orders fit on 8 April, and the organizers' checker would pass such a plan. The route history plans without the drive back: 73.8% of 2,107 Kandy second Fresh trips to 28 March 2026 were planned to leave before the first trip's last planned arrival.
- **Dispatcher time.** Reviewing the proposal takes minutes that a fully automatic plan would not.

## How we keep the cost small

- The proposal is already feasible, so Nuwan reviews the exceptions, not all 136 orders.
- Live meters show how full each trip is, so a bad edit is caught at once.
- The deferral drawer names the limiting resource first: refrigerated capacity, with VEH039 and VEH058 in the workshop.

## The same principle, applied to the field

The driver app makes the same trade. Saving each stop on the phone first means the office sometimes sees a record late. We accept that delay in exchange for never losing a proof of delivery in a dead zone, and we are honest about it: every view shows when it last heard from the driver.
