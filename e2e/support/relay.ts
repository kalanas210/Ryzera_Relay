import { writeFile } from "node:fs/promises";
import { type BrowserContext, test as base, expect, type Page, type TestInfo } from "@playwright/test";

// Each role has its own session cookie, so one browser context holds all four.
export type Role = "dispatcher" | "loader" | "driver" | "store_manager";

// The judge accounts the seed creates (README, "Accounts"). The password is RELAY_SEED_PASSWORD's default.
export const PASSWORD = "relay2026";
export const ACCOUNTS = {
  store_manager: { username: "dilani", home: "/store" },
  dispatcher: { username: "nuwan", home: "/dispatcher" },
  loader: { username: "rizwan", home: "/loader", pin: "2580" },
  driver: { username: "kasun", home: "/driver", pin: "3690" },
} as const satisfies Record<Role, { username: string; home: string; pin?: string }>;

// The README's screen sizes. The dispatcher is at a desk, everyone else on a phone.
export const DESK = { width: 1440, height: 900 } as const;
export const PHONE = { width: 375, height: 812 } as const;

// The keys the demo API takes for a jump (apps/api/src/relay_api/clock.py).
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

// A jump plays every story step on the way and can ask the engine for a plan, 20 to 30 s on a cold cache.
// An API silent for longer than this has hung, and the test should say so at once.
export const CALL_TIMEOUT_MS = 90_000;

// Runs inside the browser, as the web app does, so the cookies the API sets (the copy, each role's
// session) land in the context the screens use. Chromium also resolves *.localhost names, Node cannot.
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
        // not JSON, so keep the text for the error message
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

const apiTabs = new WeakSet<Page>();

// Every call goes through one quiet tab that never navigates, so a screen loading in another tab
// cannot interrupt it.
export class Copy {
  constructor(
    readonly context: BrowserContext,
    private readonly api: Page,
    readonly code: string,
  ) {}

  static async start(context: BrowserContext): Promise<Copy> {
    const api = await context.newPage();
    apiTabs.add(api);
    // a same-origin page that loads no app, the API's health check
    await api.goto("/api/health");
    const state = await call<DemoState>(api, "POST", "/api/demo/workspaces", {});
    expect(state.workspace.is_default, "a new copy is private, never the shared walkthrough").toBe(false);
    return new Copy(context, api, state.workspace.code);
  }

  state(): Promise<DemoState> {
    return call<DemoState>(this.api, "GET", "/api/demo/state");
  }

  // The story autopilot plays the steps on the way that nobody took.
  jump(to: Moment): Promise<DemoState> {
    return call<DemoState>(this.api, "POST", "/api/demo/clock", { action: "jump", to });
  }

  reset(): Promise<DemoState> {
    return call<DemoState>(this.api, "POST", "/api/demo/reset", {});
  }

  async signIn(role: Role): Promise<void> {
    const account = ACCOUNTS[role];
    if (role === "loader") {
      await call(this.api, "POST", "/api/auth/pin", { username: account.username, pin: ACCOUNTS.loader.pin });
    } else {
      await call(this.api, "POST", "/api/auth/login", { username: account.username, password: PASSWORD });
    }
  }

  async open(role: Role, path: string = ACCOUNTS[role].home): Promise<Page> {
    const page = await this.context.newPage();
    await page.setViewportSize(role === "dispatcher" ? DESK : PHONE);
    await page.goto(path);
    return page;
  }
}

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
  copy: Copy;
  // cookies of its own, and closed when the test ends, failed or not
  another: (size?: { width: number; height: number }) => Promise<BrowserContext>;
};

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
