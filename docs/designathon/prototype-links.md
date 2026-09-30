# Prototype links

File sharing: **Anyone with the link, can view**. Checked on 2026-09-29.
Every link below was opened in a browser with no Figma account signed in, and rendered.

Figma's prototype viewer cannot switch pages. One link shows the flows of one page only,
so the submission form gets one of these and the rest live here and in the demo video.

## Submit this one

The **Start here** board on 04 Dispatcher. It is a board of five role cards: the dispatcher card
walks on to DSP-01 inside this same prototype, the other four carry an ON_CLICK URL action that
opens that role's prototype in a new tab. One link reaches all five.

```
https://www.figma.com/proto/xjE8C4PzCMoiNgNI2q8Mn4/Ryzera_Designathon?page-id=42%3A474&node-id=230-2815&starting-point-node-id=230%3A2815&scaling=min-zoom&content-scaling=fixed&show-proto-sidebar=1
```

Built by `tools/figma-builder/steps/prototype/40-start-here.js`. Each card's URL is written at
run time from that page's own flow starting point, so a rebuild cannot leave a dead link.

## All five

| Page | Flows | Opens on | Link |
|---|---|---|---|
| 04 Dispatcher | 5 | DSP-01 Order queue | [open](https://www.figma.com/proto/xjE8C4PzCMoiNgNI2q8Mn4/Ryzera_Designathon?page-id=42%3A474&node-id=19-1300&starting-point-node-id=19%3A1300&scaling=min-zoom&content-scaling=fixed&show-proto-sidebar=1) |
| 05 Loader | 1 | LDR-01 Tonight's loads | [open](https://www.figma.com/proto/xjE8C4PzCMoiNgNI2q8Mn4/Ryzera_Designathon?page-id=42%3A475&node-id=20-2154&starting-point-node-id=20%3A2154&scaling=min-zoom&content-scaling=fixed&show-proto-sidebar=1) |
| 06 Driver | 1 | DRV-01 Today's run | [open](https://www.figma.com/proto/xjE8C4PzCMoiNgNI2q8Mn4/Ryzera_Designathon?page-id=42%3A476&node-id=19-1131&starting-point-node-id=19%3A1131&scaling=min-zoom&content-scaling=fixed&show-proto-sidebar=1) |
| 07 Store Manager | 6 | STM-01 Place an order | [open](https://www.figma.com/proto/xjE8C4PzCMoiNgNI2q8Mn4/Ryzera_Designathon?page-id=42%3A477&node-id=16-462&starting-point-node-id=16%3A462&scaling=min-zoom&content-scaling=fixed&show-proto-sidebar=1) |
| 08 Degradation | 5 | DEG-01 Working offline | [open](https://www.figma.com/proto/xjE8C4PzCMoiNgNI2q8Mn4/Ryzera_Designathon?page-id=42%3A478&node-id=18-1693&starting-point-node-id=18%3A1693&scaling=min-zoom&content-scaling=fixed&show-proto-sidebar=1) |

## How the links are built

`page-id` is the Figma page, `starting-point-node-id` is the flow's starting frame. Both come
from what Figma itself puts in the address bar when you press Present on that page.
`show-proto-sidebar=1` keeps the flows list open so a judge can switch flows within the page.
The `&t=` token Figma adds is a session token and is left out.

| Page | page-id | starting-point-node-id |
|---|---|---|
| 04 Dispatcher | 42:474 | 19:1300 |
| 05 Loader | 42:475 | 20:2154 |
| 06 Driver | 42:476 | 19:1131 |
| 07 Store Manager | 42:477 | 16:462 |
| 08 Degradation | 42:478 | 18:1693 |
