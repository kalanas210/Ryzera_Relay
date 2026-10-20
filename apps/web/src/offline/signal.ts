// The demo's "no signal" switch. A judge on a desktop browser cannot drive into the hills, so the demo bar
// cuts the driver's phone off. It sends and fetches nothing, as with no network. Kept for this browser only.
import { useSyncExternalStore } from "react";

const KEY = "relay.phone.noSignal";

export type ForcedSignal = {
  on: boolean;
  // scenario time the switch went on, for "No signal since 5:41 AM"
  since: string | null;
};

const OFF: ForcedSignal = { on: false, since: null };

function read(): ForcedSignal {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return OFF;
    const parsed = JSON.parse(raw) as Partial<ForcedSignal>;
    return parsed.on ? { on: true, since: typeof parsed.since === "string" ? parsed.since : null } : OFF;
  } catch {
    return OFF;
  }
}

let state: ForcedSignal = typeof window === "undefined" ? OFF : read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function forcedSignal(): ForcedSignal {
  return state;
}

export function setForcedOffline(on: boolean, since: string | null = null) {
  state = on ? { on: true, since } : OFF;
  try {
    if (on) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // private mode: the switch lasts for this page only
  }
  for (const listener of listeners) listener();
}

export function useForcedSignal(): ForcedSignal {
  return useSyncExternalStore(subscribe, forcedSignal, () => OFF);
}
