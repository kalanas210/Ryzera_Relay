# When Kasun's Phone Loses Signal

On Wednesday 8 April 2026, a storm near Mawanella takes Kasun's phone offline from 5:41 to 7:14 AM. Kasun keeps recording deliveries while Nuwan sees no contact and an estimate, and Dilani can confirm receipt before the phone reconnects.

## What happens

- **DEG-01, 6:05 AM:** Kasun carries on offline; the Mawanella delivery is saved on Kasun's phone and Hemmathagama is next.
- **DEG-02, 7:14 AM:** The phone sends its saved records in order; Relay asks Kasun one question about Aranayake, which Nuwan also sent to Nimal.
- **DEG-03, 6:05 to 6:44 AM:** Nuwan sees no contact since 5:41, with estimates and likely ranges; Nuwan sends standby van VEH060 to Aranayake and keeps it after Dilani's receipt.
- **DEG-04, 6:05 AM:** Dilani sees an arrival estimate around 6:35 AM and a likely range while Dilani waits for Kasun's phone.
- **DEG-05, 7:16 AM:** Nuwan sees Kasun confirm the delivery; Relay settles the clash and cancels VEH060's visit.

## How Relay handles it

- The phone saves each record to IndexedDB first, then sends records in saved order when it reconnects. Each record has its own ID, so a resend is harmless.
- The office shows the last contact, an estimate and a likely range. Relay does not guess why the phone is silent.
- The dispatcher can move a stop to a suitable standby van. A store's confirmed receipt counts as a delivery; when the phone's record conflicts with the move, one question settles it.

## How a record is answered

Every record the phone sends gets one answer, and a clash with an office change is kept and settled with one question.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> saved: driver taps, the phone writes it to IndexedDB
    saved --> waiting: no signal, or a send is running
    waiting --> sending: browser online, app in front, new record, minute check in
    saved --> sending
    sending --> waiting: the send failed, the record stays queued
    sending --> applied: delivery, arrival or problem recorded at the phone's time
    sending --> duplicate: Relay already has this id, nothing is written
    sending --> rejected: not this driver's vehicle, wrong stop, or a time in the future
    sending --> conflict: the office moved or cancelled the stop after the version the phone saw
    applied --> [*]
    duplicate --> [*]
    rejected --> [*]
    conflict --> [*]: kept with its proof, then one question goes to the driver
```

```mermaid
stateDiagram-v2
    direction LR
    [*] --> waiting_for_driver: the clash is kept with its proof
    waiting_for_driver --> resolved: driver answers yes, the delivery stands and the backup's copy is cancelled
    waiting_for_driver --> resolved: dispatcher keeps the backup's copy
    waiting_for_driver --> escalated: driver answers no, or 10 minutes pass
    escalated --> resolved: dispatcher settles it
    resolved --> [*]
```

## The storm in order

What each screen shows between 5:41 and 7:15 AM:

```mermaid
sequenceDiagram
    autonumber
    participant P as Kasun's phone
    participant R as Relay
    participant N as Nuwan<br/>dispatcher
    participant D as Dilani<br/>store manager

    Note over P,R: 5:41 AM, signal lost near Mawanella
    Note over P: 5:59 and 6:36 AM, stops 2 and 3 are delivered and saved in the outbox
    R->>N: 6:05 AM, no contact since 5:41, estimates and likely ranges
    R->>D: 6:05 AM, arrival around 6:35, likely 6:05 to 7:05, last heard 5:41
    N->>R: 6:15 AM, stop 4 moves to backup van VEH060
    D->>R: 6:42 AM, confirms receipt, before any proof
    N->>R: 6:44 AM, keeps the backup, Kasun is still silent
    Note over P,R: 7:14 AM, signal back
    P->>R: 5 saved records in order, then 2 photos
    Note over R: stops 2 and 3 apply at the phone's times, stop 4 is kept as a clash
    R->>P: one question, was stop 4 also given to the backup
    P->>R: 7:15 AM, yes, I delivered it
    R->>N: conflict resolved, VEH060 turns back
    R->>D: stop 4 delivered at 7:09 AM, proof attached
```

## Code and tests

- Phone: [outbox.ts](../apps/web/src/offline/outbox.ts), [sync.tsx](../apps/web/src/roles/driver/sync.tsx)
- API: [estimates.py](../apps/api/src/relay_api/services/estimates.py), [field.py](../apps/api/src/relay_api/services/field.py), [backup.py](../apps/api/src/relay_api/services/backup.py)
- Tests: [offline.spec.ts](../e2e/tests/offline.spec.ts), [test_field.py](../apps/api/tests/test_field.py), [test_story_road.py](../apps/api/tests/test_story_road.py)
- Sources: [degradation spec](design/specs/spec-degradation.md), [README](../README.md), and the code above.

## Try it

1. Use the demo bar switch **Kasun's phone: no signal**, record a stop and reload the driver screen.
2. In **Demo controls**, choose **5:41 AM: Signal lost near Mawanella** and follow the offline delivery through reconnection.
3. Join the same private copy on a real phone with **Demo controls** and **Join** while online. Turn on airplane mode, record a stop, then reconnect and check that it syncs.
