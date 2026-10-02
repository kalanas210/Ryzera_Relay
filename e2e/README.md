# Browser tests

Playwright tests that walk Relay the way a judge does, in Chromium. Every test starts its own private copy of the
story day through the demo API, so tests run in parallel and never move the shared walkthrough's clock.

| Spec | What it proves |
|---|---|
| `tests/walkthrough.spec.ts` | The README's judge walkthrough: steps 1 to 21 in order in one copy, and step 22 (try the engine) in a copy of its own. The steps a judge takes are done on the screens; the demo jumps between them go through the demo API, and each jump is checked to play none of the steps already taken by hand |
| `tests/offline.spec.ts` | The driver's phone with no network: a record survives a reload and sends when the network is back; the demo bar's no signal switch; the storm |
| `tests/isolation.spec.ts` | Two copies in two browsers never see each other's orders; a jump or a reset in one leaves the other alone; a phone that joins a copy with Join and its code works in that copy; the shared walkthrough stays at 2:05 PM |
| `tests/roles.spec.ts` | Each role signs in on the sign-in page and lands at home at its size, with no console errors and no sideways scroll at 375 px |

Two projects: `desk` (Chromium at 1440 x 900, tests tagged `@desk`) and `phone` (Chromium as a Pixel 7, tests tagged
`@phone`). The walkthrough runs on the desk and opens a 375 x 812 tab beside it for each field role, all in one
browser, since each role keeps its own session cookie.

## Run it

Once, from the repository root:

```bash
pnpm install
pnpm --filter @relay/e2e browsers     # Chromium for Playwright
```

Against the dev servers (the API on 8765 and `pnpm dev` on 5173), which is the default:

```bash
pnpm e2e
```

The default address is `http://e2e.localhost:5173`. Any name under `.localhost` reaches the dev server and keeps its
own cookies, so the suite never signs your own browser out. Set `E2E_BASE_URL` to run elsewhere:

```bash
E2E_BASE_URL=http://localhost:8080 pnpm e2e    # docker compose up, as CI runs it
```

The offline reload needs the service worker, which only a build registers: against the Vite dev server that test is
skipped and says why. Run against `docker compose up` (or `vite preview`) to include it. With `CI` set, the test fails
instead of skipping when no service worker is registered, so CI can never pass without it.

On a fresh database the API warms the engine cache for about a minute after it starts (`Engine cache warm for the
story day` in `docker compose logs api`). Tests started before that still pass, more slowly; CI waits for it.

Useful while working on a test:

```bash
pnpm --filter @relay/e2e exec playwright test tests/walkthrough.spec.ts --project=desk --headed
pnpm --filter @relay/e2e report       # the HTML report of the last run
pnpm --filter @relay/e2e lint         # Biome
pnpm --filter @relay/e2e typecheck
```

A failed test keeps a trace, a screenshot and, for every open tab, the screen as a screen reader reads it
(`test-results/<test>/tab-N.yml`). CI uploads them with the HTML report as the `playwright-report` artifact, also when
the job is cancelled. In CI the whole run stops at 8 minutes (`globalTimeout`), and a call to the API that has not
answered in 90 seconds fails with that message rather than waiting out the test.

## Writing tests

- Find elements by role and visible text (`getByRole`, `getByText`, `getByLabel`), never by CSS class or test id.
  Where a control's name is shared, use what describes it: each dock line's Flag button is found by its accessible
  description (`getByRole("button", { name: "Flag", description: /^Rice and dhal Stop 3/ })`). Where a value belongs
  to a term, check them together as a screen reader reads them (`toMatchAriaSnapshot`).
- A second browser comes from the `another` fixture, which closes it when the test ends, passed or failed.
- Store screens keep a time and its AM or PM together with a no-break space: in a regular expression, write `\s`
  between them (`/5:41\sAM/`). `minuteOrNext("6:39 PM")` also accepts the next minute, for a time a test causes.
- Jump with `copy.jump("signal_lost")` and then load the screen, so it reads the new time.
- Wait for the driver's pill to read All synced (`expectAllSynced`) before a jump, so the story autopilot does not
  play a step the phone has already taken. It allows a little over a minute: a record saved while the phone is
  already sending waits for the next send.
- In the storm, wait for the phone's POST to `/api/driver/held` before a jump: it is what keeps the autopilot off a
  stop the phone saved.
- The dock's next-page buttons ignore a tap in their first half second; tap them with `dockTap(button, nextScreen)`.
