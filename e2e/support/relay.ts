import { writeFile } from "node:fs/promises";
import { type BrowserContext, test as base, expect, type Page, type TestInfo } from "@playwright/test";

/** The four roles as the API names them. Each has its own session cookie, so one browser context holds all four. */
export type Role = "dispatcher" | "loader" | "driver" | "store_manager";

/** The judge accounts the seed creates (README, "Accounts"). The password is RELAY_SEED_PASSWORD's default. */
export const PASSWORD = "relay2026";
export const ACCOUNTS = {
  store_manager: { username: "dilani", home: "/store" },
  dispatcher: { username: "nuwan", home: "/dispatcher" },
  loader: { username: "rizwan", home: "/loader", pin: "2580" },
  driver: { username: "kasun", home: "/driver", pin: "3690" },
} as const satisfies Record<Role, { username: string; home: string; pin?: string }>;

/** The README's screen sizes: the dispatcher at a desk, everyone else on a phone. */
export const DESK = { width: 1440, height: 900 } as const;
export const PHONE = { width: 375, height: 812 } as const;

/** The story moments the demo bar jumps to, by the key the demo API takes (apps/api/src/relay_api/clock.py). */
export type Moment =
  | "orders"
  | "queue"
  | "cutoff"
  | "plan"
  | "publish"
  | "evening"
  | "loading"
  | "handover"
  | "first_stop"
  | "on_the_road"
  | "signal_lost"
  | "silence"
  | "backup"
  | "receipt"
  | "signal_back"
  | "settled";

/** What the demo API answers: the copy, its scenario time and the story steps a jump played. */
export type DemoState = {
  demo_mode: boolean;
  workspace: { code: string; label: string; is_default: boolean; edition: string };
  now: string;
  rate: number;
  moments: { key: Moment; label: string; at: string; passed: boolean }[];
  next: { key: Moment; label: string; at: string } | null;
  played: string[];
};

type Answer = { status: number; body: unknown };

/** How long one call to the API may take. A jump plays every story step on the way and can ask the engine for a
 *  plan, which takes 20 to 30 s on a cold cache; an API that has not answered in this time has hung, and the test
 *  should say so at once rather than wait out its own timeout. */
export const CALL_TIMEOUT_MS = 90_000;

/** Calls the API from inside the browser, as the web app does: same origin, the context's cookies and X-Relay-Client
 *  on every request. Going through the page keeps the cookies the API sets (the copy, each role's session) in the
 *  browser context the screens use, and lets Chromium resolve the *.localhost names Node cannot. */
async function call<T>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  const answer = await page.evaluate(
    async ({ method, path, body, timeout }): Promise<Answer> => {
      const headers: Record<string, string> = { "X-Relay-Client": "web" };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      let response: Response;
      try {
        response = await fetch(path, {
          method,
          headers,
          credentials: "same-origin",
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(timeout),
        });
      } catch (error) {
        const why = error instanceof DOMException && error.name === "TimeoutError" ? "no answer" : String(error);
        return { status: 0, body: `${why} in ${timeout / 1000} s` };
      }
      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // not JSON: keep the text for the error message
      }
      return { status: response.status, body: parsed };
    },
    { method, path, body, timeout: CALL_TIMEOUT_MS },
  );
  if (answer.status === 0 || answer.status >= 400) {
    const status = answer.status === 0 ? "did not answer" : `answered ${answer.status}`;
    throw new Error(`${method} ${path} ${status}: ${JSON.stringify(answer.body)}`);
  }
  return answer.body as T;
}

/** The quiet tabs the API calls go through, which a failed test's saved screens leave out. */
const apiTabs = new WeakSet<Page>();

/** One private copy of the story day, with the calls the demo bar makes. Every call goes through one quiet tab of
 *  the test's browser context that never navigates, so a screen loading in another tab cannot interrupt it. */
export class Copy {
  constructor(
    readonly context: BrowserContext,
    private readonly api: Page,
    readonly code: string,
  ) {}

  /** Starts a new private copy at Tuesday 2:05 PM and keeps its cookie in this browser context. */
  static async start(context: BrowserContext): Promise<Copy> {
    const api = await context.newPage();
    apiTabs.add(api);
    // a same-origin page that loads no app: the API's health check
    await api.goto("/api/health");
    const state = await call<DemoState>(api, "POST", "/api/demo/workspaces", {});
    expect(state.workspace.is_default, "a new copy is private, never the shared walkthrough").toBe(false);
    return new Copy(context, api, state.workspace.code);
  }

  state(): Promise<DemoState> {
    return call<DemoState>(this.api, "GET", "/api/demo/state");
  }

  /** Moves this copy's clock to a story moment. The story autopilot plays the steps on the way that nobody took. */
  jump(to: Moment): Promise<DemoState> {
    return call<DemoState>(this.api, "POST", "/api/demo/clock", { action: "jump", to });
  }

  /** Puts this copy back to Tuesday 2:05 PM, as Reset this copy does. */
  reset(): Promise<DemoState> {
    return call<DemoState>(this.api, "POST", "/api/demo/reset", {});
  }

  /** Signs a role in through the API, as the sign-in page does. The session cookie is the role's own. */
  async signIn(role: Role): Promise<void> {
    const account = ACCOUNTS[role];
    if (role === "loader") {
      await call(this.api, "POST", "/api/auth/pin", { username: account.username, pin: ACCOUNTS.loader.pin });
    } else {
      await call(this.api, "POST", "/api/auth/login", { username: account.username, password: PASSWORD });
    }
  }

  /** A tab for one role at the README's size for it. It opens the role's home screen unless told otherwise. */
  async open(role: Role, path: string = ACCOUNTS[role].home): Promise<Page> {
    const page = await this.context.newPage();
    await page.setViewportSize(role === "dispatcher" ? DESK : PHONE);
    await page.goto(path);
    return page;
  }
}

/** A failed test keeps what every open tab showed, read the way a screen reader reads it. The quiet API tabs are
 *  left out. */
async function keepScreens(testInfo: TestInfo, prefix: string, context: BrowserContext): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) return;
  for (const [n, tab] of context.pages().entries()) {
    if (apiTabs.has(tab) || tab.isClosed()) continue;
    const tree = await tab
      .locator("body")
      .ariaSnapshot({ timeout: 5_000 })
      .catch(() => "(no snapshot)");
    const file = testInfo.outputPath(`${prefix}tab-${n}.yml`);
    await writeFile(file, [`# ${tab.url()}`, tree, ""].join("\n"));
    await testInfo.attach(`${prefix}tab ${n} ${new URL(tab.url()).pathname}`, { path: file, contentType: "text/yaml" });
  }
}

type Fixtures = {
  /** A new private copy of the day in the test's own browser context. */
  copy: Copy;
  /** Another browser, with cookies of its own, at the given size. Closed when the test ends, failed or not. */
  another: (size?: { width: number; height: number }) => Promise<BrowserContext>;
};

/** The suite's test: each test gets a new private copy of the day in its own browser context, so tests run in
 *  parallel and none of them moves the shared walkthrough's clock. */
export const test = base.extend<Fixtures>({
  copy: async ({ context }, use, testInfo) => {
    const copy = await Copy.start(context);
    await use(copy);
    await keepScreens(testInfo, "", context);
  },
  another: async ({ browser, baseURL }, use, testInfo) => {
    const opened: BrowserContext[] = [];
    await use(async (size = PHONE) => {
      const context = await browser.newContext({ baseURL, viewport: size });
      opened.push(context);
      return context;
    });
    for (const [n, context] of opened.entries()) {
      await keepScreens(testInfo, `browser-${n + 2}-`, context);
      await context.close();
    }
  },
});

export { expect };
