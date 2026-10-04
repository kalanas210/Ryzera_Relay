# Relay design system

This page records how the build follows [the Day 5 style guide](design/04-style-guide.md). The values below are read from [app.css](../apps/web/src/styles/app.css) and the components are read from [apps/web/src/design](../apps/web/src/design).

## Colour tokens

The light values are the root tokens. The dark values are used by the driver route when Night mode is on, or when the device requests dark mode. Tokens without a dark override keep their light value.

| Token | Light | Dark | Use |
|---|---|---|---|
| `white` | `#FFFFFF` | `#181D24` | Cards, sheets, inputs |
| `asphalt-900` | `#14181F` | `#EEF1F5` | Primary text and icons |
| `asphalt-700` | `#3A424E` | `#C4CBD4` | Secondary text |
| `asphalt-500` | `#69727F` | `#9AA3AF` | Meta text and placeholders |
| `asphalt-300` | `#B8BFC9` | `#46505C` | Strong borders and dividers |
| `asphalt-200` | `#D8DDE4` | `#2F3741` | Borders and table lines |
| `asphalt-100` | `#ECEFF3` | `#232A33` | Subtle fills and hovered rows |
| `asphalt-50` | `#F5F7F9` | `#0F1318` | Page background |
| `petrol-800` | `#0A4450` | `#63AEBD` | Pressed primary action |
| `petrol-700` | `#0F5563` | `#7CC4D2` | Primary buttons, active navigation and links |
| `petrol-50` | `#E5F1F3` | `#153840` | Selected rows and active tab background |
| `signal-400` | `#F2B705` | `#F2B705` | Relay mark and next-stop marker |
| `signal-ink` | `#14181F` | `#14181F` | Text and icons on signal yellow |
| `chilled` | `#0A6EBD` | `#72B8F0` | Chilled orders and refrigerated vehicles |
| `chilled-soft` | `#E4F1FB` | `#11283B` | Chilled status background |
| `done` | `#1F7A4D` | `#6CCB96` | Delivered, loaded, synced and confirmed |
| `done-soft` | `#E3F3EA` | `#14301F` | Done status background |
| `attention` | `#A15C00` | `#EDAE55` | Deferred, waited, changed and short |
| `attention-soft` | `#FCEFD9` | `#38280F` | Attention status background |
| `problem` | `#B3261E` | `#F2958B` | Late risk, failed and broken rule |
| `problem-soft` | `#FBE9E7` | `#3B1815` | Problem status background |
| `waiting` | `#69727F` | `#9AA3AF` | Offline and waiting to send |
| `waiting-soft` | `#ECEFF3` | `#232A33` | Waiting status background |
| `scrim` | `rgb(20 24 31 / 40%)` | `rgb(0 0 0 / 60%)` | Dialog and sheet backdrop |

## Type

The build uses three font families for three writing needs. Atkinson Hyperlegible Next is the main Latin family for readable IDs, names and numbers. Yaldevi supplies Sinhala glyphs. Noto Sans Tamil supplies Tamil glyphs. The CSS keeps Atkinson first, then falls through to the script family, so Latin IDs and names keep the same shapes in every language.

The type scale is:

| Style | Size / line height | Weight |
|---|---|---|
| Display | 32 / 40 | Bold |
| Heading 1 | 24 / 32 | Bold |
| Heading 2 | 20 / 28 | SemiBold |
| Heading 3 | 16 / 24 | SemiBold |
| Field title | 18 / 24 | SemiBold |
| Body | 15 / 22 | Regular |
| Body strong | 15 / 22 | SemiBold |
| Body dense | 14 / 20 | Regular |
| Body dense strong | 14 / 20 | SemiBold |
| Button | 15 / 22 | SemiBold |
| Label | 13 / 18 | Medium |
| Label strong | 13 / 18 | SemiBold |
| Caption | 12 / 16 | Medium |
| Field button | 18 / 24 | SemiBold |

Sinhala and Tamil use taller line heights in the CSS. Numbers use tabular figures.

## Components

Each line names the file and one verified use.

- [Button.tsx](../apps/web/src/design/Button.tsx): Button and IconButton variants, used on the sign-in form in [SignIn.tsx](../apps/web/src/auth/SignIn.tsx).
- [ErrorState.tsx](../apps/web/src/design/ErrorState.tsx): Retry error state, used by the dispatcher queue in [Queue.tsx](../apps/web/src/roles/dispatcher/Queue.tsx).
- [LanguageSheet.tsx](../apps/web/src/design/LanguageSheet.tsx): Language selection sheet, used by the driver shell in [DriverShell.tsx](../apps/web/src/roles/driver/DriverShell.tsx).
- [Logo.tsx](../apps/web/src/design/Logo.tsx): Full logo and Relay mark, used on [SignIn.tsx](../apps/web/src/auth/SignIn.tsx).
- [Meter.tsx](../apps/web/src/design/Meter.tsx): Weight, volume, time and fuel capacity meters, used on the plan board in [PlanPage.tsx](../apps/web/src/roles/dispatcher/plan/PlanPage.tsx).
- [Notice.tsx](../apps/web/src/design/Notice.tsx): Info, attention, problem, offline and done notices, used on the live page in [LivePage.tsx](../apps/web/src/roles/dispatcher/live/LivePage.tsx).
- [Phone.tsx](../apps/web/src/design/Phone.tsx): PhoneScreen, headers and cards, used by the store orders page in [MyOrders.tsx](../apps/web/src/roles/store/MyOrders.tsx).
- [PinPad.tsx](../apps/web/src/design/PinPad.tsx): Shared dock tablet PIN pad, used on [SignIn.tsx](../apps/web/src/auth/SignIn.tsx).
- [Segmented.tsx](../apps/web/src/design/Segmented.tsx): Two or more selectable segments, used for depot selection in [DispatcherShell.tsx](../apps/web/src/roles/dispatcher/DispatcherShell.tsx).
- [Sheet.test.tsx](../apps/web/src/design/Sheet.test.tsx): Tests for the sheet component, including dismissal behavior.
- [Sheet.tsx](../apps/web/src/design/Sheet.tsx): Sheet and drawer surface, used by the demo controls in [DemoBar.tsx](../apps/web/src/demo/DemoBar.tsx).
- [StatusChip.tsx](../apps/web/src/design/StatusChip.tsx): Status icons and words such as Chilled and Deferred, used in the dispatcher queue in [Queue.tsx](../apps/web/src/roles/dispatcher/Queue.tsx).
- [Stepper.tsx](../apps/web/src/design/Stepper.tsx): Quantity stepper, used while placing an order in [PlaceOrder.tsx](../apps/web/src/roles/store/PlaceOrder.tsx).
- [StopMarker.tsx](../apps/web/src/design/StopMarker.tsx): Numbered stop state marker, used in the driver stop parts in [parts.tsx](../apps/web/src/roles/driver/parts.tsx).
- [SyncPill.test.tsx](../apps/web/src/design/SyncPill.test.tsx): Tests for synced, sending and offline pill states.
- [SyncPill.tsx](../apps/web/src/design/SyncPill.tsx): Network and sync status pill, used in the loader shell in [LoaderShell.tsx](../apps/web/src/roles/loader/LoaderShell.tsx).

## Contrast

Ratios use the WCAG relative luminance formula. Body text needs at least 4.5:1. Large text needs at least 3:1.

| Pair | Light ratio | Dark ratio | Result |
|---|---:|---:|---|
| Body text on page background, `asphalt-900` on `asphalt-50` | 16.57:1, AA pass | 16.45:1, AA pass | Pass |
| Muted text on page background, `asphalt-500` on `asphalt-50` | 4.53:1, AA pass | 7.31:1, AA pass | Pass |
| Text on petrol button, `white` on `petrol-700` | 8.40:1, AA pass | 8.62:1, AA pass | Pass |
| Text on signal yellow, `signal-ink` on `signal-400` | 9.79:1, AA pass | 9.79:1, AA pass | Pass |

## Live site comparison

The live sign-in page at [relay-ryzera.tech/signin](https://relay-ryzera.tech/signin) matches the documented role structure: Relay branding, the “Who is signing in?” heading, four role cards, and the named people and locations. It also shows the scenario bar and demo controls described by the build.

The Figma sources are the [design file](https://www.figma.com/design/xjE8C4PzCMoiNgNI2q8Mn4/Ryzera_Designathon?node-id=42-470&t=ElyZGP5juqtuiyAy-1) and the [prototype](https://www.figma.com/proto/xjE8C4PzCMoiNgNI2q8Mn4/Ryzera_Designathon?node-id=19-1300&p=f&t=ApDSYZDSUPgKTIB8&scaling=min-zoom&content-scaling=fixed&page-id=42%3A474&starting-point-node-id=19%3A1300&show-proto-sidebar=1). Both Figma pages closed the connection when accessed here, so canvas-level matches and differences cannot be verified from this environment. The live findings above are verified against the running site and the repository sources.

## Differences from the style guide

- The style guide describes 15 visual components. The design folder has 16 files because it also contains two component test files, and `Phone.tsx` contains shared layout helpers.
- The style guide presents the visual system for all four roles, but the CSS night palette is applied only to elements marked `night-capable`, which is the driver route.
- The style guide calls for a three-family system. The build implements this as one CSS stack with Atkinson first and Sinhala or Tamil fallback by Unicode range.