import { useEffect, useState } from "react";
import { useDemoState } from "@/app/session";

/** Scenario time, ticking between fetches of the demo state. Every screen reads "now" from here,
 *  so cutoff countdowns and "no word since 5:41 AM" follow the story's clock, not the wall clock. */
export function useSimNow(tickMs = 1000): Date | null {
  const { data, dataUpdatedAt } = useDemoState();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);
  if (!data) return null;
  const elapsed = (Date.now() - dataUpdatedAt) * data.rate;
  return new Date(Date.parse(data.now) + elapsed);
}
