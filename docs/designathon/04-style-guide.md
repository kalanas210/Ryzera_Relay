# Style Guide: Relay (Team Ryzera)

> **v0.4 data alignment.** The visual system is unchanged. What changed is the sample content on the four style guide boards and the component defaults, which now use records from the v0.4 scenario (`05-scenario-data.md`): the ID specimen reads VEH045 · OUT117 (Kasun's truck, Dilani's store); the type ramp uses "Stop 3 of 4 · Hemmathagama", "VEH045 · Trip 1", "36 rice and dhal cases", "Rear dock, 4:00 to 7:45 AM", "136 orders for Wednesday", "OUT117 · 685.6 kg · 3.772 m³" and "Wed 8 Apr · 6:05 AM"; the script samples are a driver stop line in Sinhala and a loader stop line in Tamil; the notice sample is the 9:12 PM plan change on VEH045; the component defaults use Kasun's stops (the failed sample is Maskeliya, VEH044's stop 5, which Relay expects after its 8:00 AM close), VEH057's second trip on the meters (801.6 and 994.4 of 1,040 kg and 7.676 of 7.0 m³) and Dilani's 36 rice and dhal cases on the stepper and the Load line. The Load line is drawn as that dry line for stop 3, and its flagged states tell the story's one shortfall: 30 loaded, 6 short, the 6 come on Thursday. Each Notice tone carries its own sample from the story. The type table below also gains the two styles the boards already showed (Field title and Body dense strong), and the components table now lists the 15 components as built.
>
> After review, the attention examples say "waited last run" (the DSP-01 flag reads "Waited Monday"); the chip variant is named to match, Waited last run.
>
> The visual system for all four roles. The Figma variables and components are built from this file, and the Hackathon front end reuses the same tokens.

## Principles

1. **Color means something.** The interface is mostly neutral. Color is kept for status (chilled, deferred, late, delivered) and for the one primary action on each screen, so a flag always stands out.
2. **Readable at a glance, in bad light.** Drivers read in a cab at dawn and loaders read in a dim dock with gloves on. Type, contrast and touch targets are sized for those moments, not for a bright office.
3. **IDs can never be misread.** Vehicle and outlet codes like VEH045 and OUT117 are how people talk. The typeface keeps 0 and O, and 1, l and I, clearly different.
4. **One system, four densities.** The dispatcher gets a dense desktop. The field roles get large, spaced-out screens. Both are built from the same components, so the product feels like one tool.

## Typeface

**Atkinson Hyperlegible Next** for everything. It was designed by the Braille Institute for low-vision readers, and its letterforms are built to be told apart. That is exactly the problem with vehicle and outlet codes, and with reading a screen in a moving cab. It is free (SIL Open Font License) and works on the web for the Hackathon build.

Sinhala text on the Driver and Loader screens uses **Yaldevi**, a Sinhala sans-serif made in Sri Lanka by Mooniak. Tamil uses **Noto Sans Tamil**. The file shows the driver in Sinhala and the loader in Tamil. Both are matched in size and weight to the Latin text, on a taller ramp so marks never clip. IDs, brand names and people's names stay in Atkinson. The board samples: "නැවතුම 3 · හෙම්මාතගම" (Stop 3 · Hemmathagama) and "நிறுத்தம் 3 · அரிசி, பருப்பு" (Stop 3 · Rice, dhal), both written as the driver and loader screens write them.

| Style | Size / line height | Weight | Used for |
|---|---|---|---|
| Display | 32 / 40 | Bold | Desktop page titles, the driver's next-stop name |
| Heading 1 | 24 / 32 | Bold | Screen titles on phone |
| Heading 2 | 20 / 28 | SemiBold | Section titles, sheet titles |
| Heading 3 | 16 / 24 | SemiBold | Card titles, table group headers |
| Field title | 18 / 24 | SemiBold | What is read at arm's length on field screens, such as "36 rice and dhal cases" |
| Body | 15 / 22 | Regular | Default text on phone |
| Body strong | 15 / 22 | SemiBold | Emphasis inside body text, such as stop names and selected choices |
| Body dense | 14 / 20 | Regular | Default text on the dispatcher desktop |
| Body dense strong | 14 / 20 | SemiBold | Emphasis in dense desktop rows |
| Button | 15 / 22 | SemiBold | Button text on Store Manager screens, on phone and desktop |
| Label | 13 / 18 | Medium | Field labels, chip text, meta lines |
| Label strong | 13 / 18 | SemiBold | Link rows, selected segments, emphasis in meta lines |
| Caption | 12 / 16 | Medium | Timestamps, table column headers |
| Field button | 18 / 24 | SemiBold | Primary buttons on Driver and Loader screens |

Numbers in tables and meters use tabular figures, so columns line up.

## Color

### Neutrals: "Asphalt"
A cool blue-gray scale, taken from road surfaces and dock concrete rather than a warm paper tone.

| Token | Hex | Use |
|---|---|---|
| `asphalt-900` | #14181F | Primary text, icons |
| `asphalt-700` | #3A424E | Secondary text |
| `asphalt-500` | #69727F | Meta text, placeholder |
| `asphalt-300` | #B8BFC9 | Strong borders, dividers on gray |
| `asphalt-200` | #D8DDE4 | Borders, table lines |
| `asphalt-100` | #ECEFF3 | Subtle fills, hovered rows |
| `asphalt-50` | #F5F7F9 | App background |
| `white` | #FFFFFF | Cards, sheets, inputs |

### Brand: "Petrol" and "Signal"
Petrol is a deep blue-green, the color of fuel and of the depot at night. Signal is road-marking yellow, the baton in the Relay mark.

| Token | Hex | Use |
|---|---|---|
| `petrol-700` | #0F5563 | Primary buttons, active navigation, links |
| `petrol-800` | #0A4450 | Pressed state |
| `petrol-50` | #E5F1F3 | Selected rows, active tab background |
| `signal-400` | #F2B705 | Relay mark, the next-stop marker. Always with dark text, never as text on white |
| `signal-ink` | #14181F | Text and icons on `signal-400`, such as the next-stop number. The same value in Night mode |
| `scrim` | #14181F at 40% | Behind sheets and dialogs. #000000 at 60% in Night mode |

### Status
Each status has a strong tone for text and icons and a soft tone for backgrounds.

| Meaning | Strong | Soft | Where it appears |
|---|---|---|---|
| Chilled | #0A6EBD | #E4F1FB | Chilled orders, refrigerated vehicles, cold-chain items |
| Done | #1F7A4D | #E3F3EA | Delivered, loaded, synced, confirmed |
| Attention | #A15C00 | #FCEFD9 | Deferred, waited last run, plan changed, short |
| Problem | #B3261E | #FBE9E7 | Late risk, failed stop, rule broken, dispute |
| Waiting | #69727F | #ECEFF3 | Offline, waiting to send, not started |

Every status is shown with an icon and a word as well as a color, so it still reads for color-blind users and in poor light.

## Space, shape and depth

- **Spacing** on a 4 px grid: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- **Corner radius:** 6 for chips and inputs, 8 for buttons, 12 for cards, 16 for sheets and drawers. Buttons are not pill-shaped. The one exception: meter bars and legend swatches are fully rounded, with a radius of half their height.
- **Borders over shadows.** Cards sit on the gray background with a 1 px `asphalt-200` border. Only floating layers (sheets, drawers, menus) get a shadow: 0 8 24, #14181F at 12%.

## Touch and density

| | Dispatcher (desktop) | Store Manager | Driver and Loader |
|---|---|---|---|
| Primary button height | 36 | 48 | 56 |
| List row height | 40 | 56 | 64 |
| Minimum tap target | 32 | 44 | 48, spaced 8 apart for gloves |
| Body text | 14 | 15 | 15 to 18 |

## Iconography

Lucide icons (ISC license) at a 1.75 px stroke, 20 px on desktop and 24 px in the field. Status icons: snowflake for chilled, check for done, clock for attention, alert triangle for problems, cloud-off for offline, van for van-only access, building for mall bay.

## Components

Fifteen components are built on the Design System page and shared by the screens of all four roles. The Style guide board "Components and icons" shows a live instance of each.

| Component | Variants |
|---|---|
| Button | Primary, secondary, quiet, danger · desktop, phone, field |
| Status chip | Chilled, dry, van only, mall window, waited last run ("Waited Monday"), deferred, plan changed, short, late risk, broken rule, failed, delivered, loaded, synced, waiting to send, no signal · compact, large |
| Sync pill | All synced · offline with a count · sending |
| Notice | Info, attention, problem, offline, done |
| Capacity meter | Normal, near limit, over limit; weight, volume, Fresh time or weekly fuel |
| Stop row | Next, delivered, pending, waiting to send, failed |
| Load line | To load, checked, flag waiting, short decided, flagged damaged · phone, tablet |
| Input | Default, focus, error |
| Segmented control | First, second |
| Stepper | One size, 48 px targets |
| PIN pad | PIN dots empty, entering, error · shared tablet, 96 × 64 keys, 8 apart |
| Logo | Full, mark · light, dark |
| Avatar | Initials, 36 px |
| Phone status bar | Full signal, no signal |
| Nav rail | Queue, plan, live, outlook |

Order rows, trip cards, top bars and sheets are composed in the screens from these components and the tokens. `specs/components.md` lists every part the screens use.
