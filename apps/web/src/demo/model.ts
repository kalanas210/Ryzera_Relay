import type { DemoState } from "@/api/types";

type Outage = DemoState["outages"][string];

/** The story's storm for a driver's phone, while it lasts at `now`: the phone has no signal whatever the demo bar's
 *  switch says. Null before it starts and after it ends. */
export function inStorm(outage: Outage | undefined, now: Date): { from: Date; to: Date } | null {
  if (!outage) return null;
  const from = new Date(outage.from);
  const to = new Date(outage.to);
  return from.getTime() <= now.getTime() && now.getTime() < to.getTime() ? { from, to } : null;
}

/** How the demo bar counts the story steps a jump played: one short line on a phone, the full sentence on a desk. */
export function playedSummary(count: number): { short: string; long: string } {
  return count === 1
    ? { short: "1 skipped step", long: "the step" }
    : { short: `${count} skipped steps`, long: `the ${count} steps` };
}
