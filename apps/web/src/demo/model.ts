import type { DemoState } from "@/api/types";

type Outage = DemoState["outages"][string];

// In the storm the driver's phone has no signal, whatever the demo bar switch says.
export function inStorm(outage: Outage | undefined, now: Date): { from: Date; to: Date } | null {
  if (!outage) return null;
  const from = new Date(outage.from);
  const to = new Date(outage.to);
  return from.getTime() <= now.getTime() && now.getTime() < to.getTime() ? { from, to } : null;
}

export function playedSummary(count: number): { short: string; long: string } {
  return count === 1
    ? { short: "1 skipped step", long: "the step" }
    : { short: `${count} skipped steps`, long: `the ${count} steps` };
}
