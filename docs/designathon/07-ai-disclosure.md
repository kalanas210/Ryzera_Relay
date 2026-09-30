# AI Tool Disclosure: Designathon

> **v0.4 data alignment.** Adds the dataset analysis: Claude Code read the competition datasets, rebuilt the story on real records, and wrote the scripts that check it. The earlier line saying no dataset was shared with an AI tool was no longer true, so it is removed.
>
> **DRAFT.** The team completes the review sections before submission. The booklet asks which work was AI-assisted, which was not, and how the tools were used. Keep this honest and specific.

## Tools used

| Tool | What we used it for |
|---|---|
| Claude (Anthropic, Opus 5.5) in Claude Code | Reading and explaining the brief; drafting the problem framing, personas, screen inventory, per-screen rationale, scenario data, style guide and this document; building the Figma file (variables, components, screens, story boards, prototype links) with the Relay Builder plugin it wrote, checked in a local mock renderer; reviewing its own drafts with separate reviewer agents |
| Claude (Anthropic, Opus 5.5) in Claude Code, on the competition data | Reading the competition datasets (vehicles, outlets, calendar, orders, route legs, road conditions) and the organizers' trip-time checker; building the v0.4 scenario on real records; writing `tools/data-check` (`validate_scenario.py`, `relay_model.py`, `printed.py`), which recomputes every figure in the scenario from the data |
| Canva AI image generation | The four persona portraits, and the road photo on the cover, cropped from Kasun's portrait. They are synthetic images, not photographs of real people or places |
| Figma | The design file, components and prototype |
| Lucide icons (ISC license) | The icon set, used unchanged |

## What was AI-assisted

- The first drafts of all written content: framing, personas, screen rationale, scenario data, style guide, tradeoff, video script.
- The screen designs in Figma, built by a plugin from written specs that were themselves drafted with AI and checked by separate review agents against the booklet.
- The dataset analysis behind the story: which vehicles, stores and dates to use, the order sizes (from the team's forecast method), the trip times (from the organizers' published standard), the deferral and capacity searches, and the statistics on the story boards. Each figure is produced by a script and checked by `tools/data-check/validate_scenario.py`, which currently passes 1,578 checks.
- The persona portraits, and the cover's road photo cropped from one of them. The phone on the cover shows our own DEG-01 screen.

## What the team did

_To be completed by the team after review. List specific decisions and edits, for example:_
- Set the brief for the AI and the quality bar, and chose the direction (assisted planning, the Kandy corridor degradation scenario, a story built on the competition data).
- Reviewed each part against the booklet: Kalana (framing and scope), Kavitha (dispatcher), Induwara (loader), Bhathiya (driver), Hirantha (store manager), Mandira (style guide), Dinithi (degradation and video).
- Had native speakers check the Sinhala and Tamil strings.
- _Edits made:_ …
- Recorded the demo video in our own words.

## How we used the tools responsibly

- Every AI draft was treated as a proposal, and facts were checked against the booklet.
- Claude Code read the competition datasets to build the story on real records and to write the scripts that check it. The raw files stay out of the repository (git ignores `data/raw/` and `data/derived/`), and the scripts in `tools/data-check` read them from there.
- Every number in the story comes from a script, not from the model's memory, and the validator re-runs those scripts against the data. Story times (when people act) are authored, and the validator checks them against the data and against each other. Store names are ours, since the data has none; each is a real town or Kandy city area in the outlet's district.
- Persona images are generated, so no real person's likeness is used for a fictional persona.
