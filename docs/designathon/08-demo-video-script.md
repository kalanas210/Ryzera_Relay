# Demo Video Script: Designathon (about 4:30)

> **Speech version, 27 September.** One talk in simple spoken English, presented by Dinithi Wickramasinghe: about 632 words, which is about 4:30 at a normal speaking pace with the clicks. `Relay-demo-video-script.pdf` has the same words with a picture of the slide for every part. The facts follow the v0.4 story (`05-scenario-data.md`).
>
> The booklet asks for a 3 to 5 minute unlisted YouTube video that walks through the design and discusses the assumptions behind it. Change any words so they sound like you.

## How to read it

- The paragraphs are the talk. Read them top to bottom; they flow as one speech.
- The *Screen* line above each paragraph says which Figma page and flow to open, and what to click before you speak.
- Each clip is one recording. Record them one at a time in Clipchamp, then join them.
- In each presentation, pick the flow from the flows list, hide the list, turn hotspot hints off and choose Fit.

## Clip 1 · Opening (about 0:10)

*Screen:* Page 00 Cover. Press Present.

Hello everyone, my name is Dinithi Wickramasinghe, and I'm from the University of Moratuwa. Today I'll show you Relay, Team Ryzera's delivery planning system for Waypoint.

## Clip 2 · The problem (about 0:50)

*Screen:* Page 01 Problem Framing. Present from “The problem and our framing”.

First, the problem. Waypoint delivers for three brands with one fleet of 60 vehicles, and on busy days it simply can't carry every order. Today the plan lives in one dispatcher's spreadsheet, and everything else happens over calls and paper, so information gets lost between people. Relay gives every order one shared record, from the moment it's placed until the store confirms it arrived.

*Screen:* Right arrow: “Seven problems prioritised”.

Of the seven problems in the brief, we focused on five, from planning to bad signal on the road.

*Screen:* Right arrow: “Scope in and out”.

And we left out live GPS on purpose. Drivers use their own phones, and tracking fails exactly where the signal drops.

## Clip 3 · The four people (about 0:25)

*Screen:* Page 02 Personas. Present from Nuwan.

We designed for four people. Nuwan plans the deliveries.

*Screen:* Right arrow: Rizwan.

Rizwan loads the trucks at night on a shared tablet.

*Screen:* Right arrow: Kasun.

Kasun drives to four stores in Kegalle and only checks his phone when he's stopped.

*Screen:* Right arrow: Dilani.

And Dilani runs a Waypoint Fresh store and orders on WhatsApp today. Every vehicle, store and date you'll see comes from the real competition data.

## Clip 4 · Dilani orders (about 0:12)

*Screen:* Page 07 Store Manager, flow “Store Manager flow”. Tap “Send order”.

Let's follow one order. It's Tuesday, 2:10 in the afternoon. Dilani orders her chilled goods, and Relay confirms at once, with the weight and volume worked out.

## Clip 5 · Nuwan plans (about 0:55)

*Screen:* Page 04 Dispatcher, flow “Dispatcher flow”. Click the countdown.

At 4 PM, the order list locks with 136 orders.

*Screen:* Click “Go to plan board”.

Relay suggests a plan, and every trip shows how full it is.

*Screen:* Click Dilani's order card (under Not placed), then VEH057 trip 2.

Nuwan drags Dilani's chilled order onto the last refrigerated van going to Kegalle. Relay doesn't stop him, but it shows why it won't work: the van would be over 400 kilos too heavy.

*Screen:* Click “Undo move”, then “Review deferral”.

This week, two refrigerated vehicles are in the workshop, so the rest can only deliver 22 of the 23 chilled orders. That part can't be helped. But which order waits is a choice, and Relay shows the rules it used. Kegalle already waited on Monday, so it's protected. Dilani's order moves to Thursday, and Relay checks that it fits there.

*Screen:* Click “Use Relay's reason”, “Confirm deferral”, “Publish plan”, and “Publish plan” in the dialog. Keep your voice up at the comma.

At 6:40, Nuwan publishes the plan,

## Clip 6 · Dilani hears why (about 0:05)

*Screen:* Page 07 Store Manager, flow “Store Manager: Evening notice”. This finishes the sentence from clip 5.

and a minute later, Dilani gets a note explaining why.

## Clip 7 · The night at the dock (about 0:30)

*Screen:* Page 05 Loader, flow “Loader flow”. Tap any number on the PIN pad.

That night, at 9:12, Nuwan swaps two of Kasun's stops so he drives the worst hill road in daylight, and the dock sees it right away.

*Screen:* Tap the VEH045 card, then Flag on stop 3's rice and dhal line.

At 2:47 in the morning, Rizwan finds only 30 of Dilani's 36 cases of rice and dhal. He flags it in two taps.

*Screen:* Tap “Flag 6 missing”, wait two seconds, then tap “See answer”.

From his phone, Nuwan decides: send what's there and add the six to Thursday. Dilani knows before the truck leaves.

## Clip 8 · On the road (about 0:12)

*Screen:* Page 06 Driver, flow “Driver flow”. Tap “Accept load”.

Now, the part we designed most carefully: what happens when the signal drops. Kasun reaches his first store 19 minutes behind plan. That's normal in the monsoon, so Relay says it calmly.

## Clip 9 · The signal drops (about 0:50)

*Screen:* Page 08 Degradation, flow “Degradation: Signal lost”.

At 5:41, a storm knocks out his network. Nothing stops: every stop, photo and location saves on his phone first.

*Screen:* Flow “Degradation: Silence for the dispatcher”. Click “Move stop 4”, then “Move stop 4 to VEH060”.

Nuwan's screen doesn't guess. It says “No contact from Kasun since 5:41” and shows a time range. At 6:15, he sends the standby van toward Kasun's last stop, just in case.

*Screen:* Flow “Degradation: Silence for the store”. Wait three seconds, then tap “Confirm receipt”.

Dilani sees the same honest estimate. Kasun delivers to her at 6:36, still offline, and she confirms it at 6:42.

*Screen:* Flow “Degradation: Signal back”. It moves on by itself; tap “Yes, I delivered it”.

At 7:14, the signal comes back and everything sends by itself. Relay asks Kasun one question: did you deliver stop 4? He says yes, and the backup van turns around. For us, offline is normal, not an error.

## Clip 10 · The receipt (about 0:06)

*Screen:* Page 07 Store Manager, flow “Store Manager: Report an issue”.

At 7:22, Dilani sees Kasun's photo and the receiver's name on her receipt.

## Clip 11 · Close (about 0:25)

*Screen:* Page 11 Core Tradeoff. Press Present.

Our main tradeoff is explainable over optimal. Nuwan has to explain every order that waits, so Relay suggests and checks, and people decide.

*Screen:* Page 01 Problem Framing. Select “Design principles and assumptions”, then Present.

We assume store managers have a phone or a browser, drivers' phones have a camera, and the depots have good internet, even where the roads don't.

*Screen:* Page 00 Cover. Press Present.

That's Relay: from order to receipt, nothing gets dropped. Thank you for watching.

## After recording

1. Join the 11 clips in order in Clipchamp. Cut the silences and the moments where you switch pages or flows.
2. Check the length: between 3:00 and 5:00, about 4:30 is right.
3. Export at 1080p.
4. Upload in YouTube Studio: Create, Upload video. Title "Relay by Team Ryzera, Rootcode Tech-Triathlon 2026 Designathon". Audience "No, it's not made for kids". Visibility **Unlisted**, not Private.
5. Check the link in a private browser window, then paste it into the submission form.
