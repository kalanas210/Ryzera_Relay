import type { Role } from "./client";

export type Me = {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  depot: string | null;
  outlet_id: string | null;
  vehicle_id: string | null;
  locale: string;
};

export type Account = {
  username: string;
  display_name: string;
  role: Role;
  detail: string;
  uses_pin: boolean;
  hint: string;
};

export type Moment = { key: string; label: string; at: string; passed: boolean };

export type DemoState = {
  demo_mode: boolean;
  /** The copy of the day; `edition` is new each time the copy is made or reset. */
  workspace: { code: string; label: string; is_default: boolean; edition: string };
  now: string;
  rate: number;
  moments: Moment[];
  next: Moment | null;
  /** Story steps the last jump played because nobody had taken them. */
  played: string[];
  /** The story's scripted loss of signal by driver username, once the clock has reached it. */
  outages: Record<string, { from: string; to: string }>;
};

/** GET /api/health. `warming` is true while the API's warm-up is still asking the engine the story day's first
 * proposals; a Propose started meanwhile waits for that answer, up to half a minute. */
export type Health = { status: "ok"; warming: boolean };
