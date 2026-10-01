import { cx } from "@/lib/cx";

export type MarkerState = "pending" | "next" | "done" | "short" | "failed";

const STYLE: Record<MarkerState, string> = {
  pending: "bg-white border-asphalt-300 text-asphalt-700",
  next: "bg-signal-400 border-signal-ink text-signal-ink",
  done: "bg-done-soft border-done text-done",
  short: "bg-attention-soft border-attention text-attention",
  failed: "bg-problem-soft border-problem text-problem",
};

/** A stop's number in a circle, shared by the dock, the driver and the store's tracker. Signal yellow marks the
 *  stop being worked on: loaded now at the dock, next on the road. */
export function StopMarker({
  n,
  state,
  size = 32,
  className,
}: {
  n: number;
  state: MarkerState;
  size?: 28 | 32;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "num inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] t-h3",
        size === 32 ? "size-8" : "size-7",
        STYLE[state],
        className,
      )}
    >
      {n}
    </span>
  );
}
