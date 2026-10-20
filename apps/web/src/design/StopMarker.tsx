import { Check, X } from "lucide-react";
import { cx } from "@/lib/cx";

export type MarkerState = "pending" | "next" | "done" | "short" | "failed" | "delivered" | "undelivered" | "moved";

const STYLE: Record<MarkerState, string> = {
  pending: "bg-white border-asphalt-300 text-asphalt-700",
  next: "bg-signal-400 border-signal-ink text-signal-ink",
  done: "bg-done-soft border-done text-done",
  short: "bg-attention-soft border-attention text-attention",
  failed: "bg-problem-soft border-problem text-problem",
  // In the driver's run a delivered stop is a solid check and an undelivered one a solid cross.
  delivered: "bg-done border-done text-white",
  undelivered: "bg-problem border-problem text-white",
  // A stop handed to another vehicle. Still on the list, no longer this truck's (components.md, attention ring).
  moved: "bg-attention-soft border-attention text-attention",
};

const SIZE = {
  28: { box: "size-7", text: "t-h3", icon: 16 },
  32: { box: "size-8", text: "t-h3", icon: 20 },
  40: { box: "size-10", text: "t-h2", icon: 24 },
} as const;

// Signal yellow marks the stop being worked on, loaded now at the dock or next on the road.
// The check and cross replace the number on screen, and the number stays for screen readers.
export function StopMarker({
  n,
  state,
  size = 32,
  className,
}: {
  n: number;
  state: MarkerState;
  size?: 28 | 32 | 40;
  className?: string;
}) {
  const s = SIZE[size];
  const Icon = state === "delivered" ? Check : state === "undelivered" ? X : null;
  return (
    <span
      className={cx(
        "num inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px]",
        s.box,
        s.text,
        STYLE[state],
        className,
      )}
    >
      {Icon ? (
        <>
          <Icon size={s.icon} strokeWidth={1.75} aria-hidden />
          <span className="sr-only">{n}</span>
        </>
      ) : (
        n
      )}
    </span>
  );
}
