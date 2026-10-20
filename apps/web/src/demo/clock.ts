import { useEffect, useState } from "react";
import { useDemoState } from "@/app/session";

// Scenario time. Every screen reads "now" from here, so countdowns follow the story's clock.
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
