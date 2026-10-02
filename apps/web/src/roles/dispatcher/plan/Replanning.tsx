import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { Health } from "@/api/types";

/** Seconds since `active` turned on, counted while it stays on. */
function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    setSeconds(0);
    const tick = window.setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [active]);
  return seconds;
}

/** How long a search runs before Relay asks the API whether it is still warming up, and how often it asks again. */
export const WARMING_FIRST_ASK_MS = 2_000;
export const WARMING_ASK_AGAIN_MS = 5_000;

/** Whether the API is still warming the engine cache after it started (GET /api/health). A plan asked for meanwhile
 *  waits for the warm-up's answer. Asked once the search has run a moment, then again while the warm-up lasts. */
function useWarming(active: boolean): boolean {
  const [warming, setWarming] = useState(false);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer = 0;
    const ask = async () => {
      const health = await api.get<Health>("/api/health").catch(() => null);
      if (stopped) return;
      setWarming(Boolean(health?.warming));
      if (health?.warming) timer = window.setTimeout(ask, WARMING_ASK_AGAIN_MS);
    };
    timer = window.setTimeout(ask, WARMING_FIRST_ASK_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      setWarming(false);
    };
  }, [active]);
  return warming;
}

/** While the engine searches: a proposal Relay has made before comes back at once, a new fleet or new orders take
 *  longer, and the wait is shown rather than hidden behind a button label. */
export function Replanning({ active }: { active: boolean }) {
  const seconds = useElapsed(active);
  const warming = useWarming(active);
  if (!active) return null;
  return (
    <p className="flex items-center gap-2 t-caption text-asphalt-700">
      <RefreshCw
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className="shrink-0 animate-spin motion-reduce:animate-none"
      />
      <span role="status">
        {warming
          ? "Relay has just started and is still warming up the planner. This plan can take up to a minute."
          : "Relay is checking every vehicle and every rule. A new fleet can take up to a minute."}
      </span>
      <span className="num text-asphalt-500" aria-hidden>
        {seconds} s
      </span>
    </p>
  );
}
