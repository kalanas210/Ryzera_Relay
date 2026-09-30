import {
  Building2,
  CalendarClock,
  Check,
  Circle,
  CircleCheck,
  CircleDot,
  ClipboardList,
  Clock,
  CloudOff,
  History,
  Info,
  type LucideIcon,
  Package,
  PackageX,
  RefreshCw,
  Snowflake,
  TriangleAlert,
  Truck,
  Van,
} from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type Tone = "chilled" | "done" | "attention" | "problem" | "waiting" | "neutral" | "muted" | "petrol";

/** One set of status words for every role (specs/components.md, Status words). */
export const CHIPS = {
  chilled: { tone: "chilled", icon: Snowflake, label: "Chilled" },
  dry: { tone: "muted", icon: Package, label: "Dry" },
  vanOnly: { tone: "neutral", icon: Van, label: "Van only" },
  truck: { tone: "neutral", icon: Truck, label: "Large truck" },
  mall: { tone: "neutral", icon: Building2, label: "Mall window" },
  waited: { tone: "attention", icon: History, label: "Waited last run" },
  toDefer: { tone: "attention", icon: Clock, label: "To defer" },
  deferred: { tone: "attention", icon: Clock, label: "Deferred" },
  received: { tone: "neutral", icon: ClipboardList, label: "Received by Waypoint" },
  scheduled: { tone: "neutral", icon: CalendarClock, label: "Scheduled" },
  onTheWay: { tone: "neutral", icon: Truck, label: "On the way" },
  delivered: { tone: "done", icon: Check, label: "Delivered" },
  confirmed: { tone: "done", icon: CircleCheck, label: "Receipt confirmed" },
  waitingToSend: { tone: "waiting", icon: CloudOff, label: "Waiting to send" },
  noSignal: { tone: "waiting", icon: CloudOff, label: "No signal" },
  estimatePassed: { tone: "waiting", icon: History, label: "Estimate passed" },
  sending: { tone: "waiting", icon: RefreshCw, label: "Sending" },
  short: { tone: "attention", icon: PackageX, label: "Short" },
  lateRisk: { tone: "problem", icon: TriangleAlert, label: "Late risk" },
  ruleBroken: { tone: "problem", icon: TriangleAlert, label: "Rule broken" },
  failed: { tone: "problem", icon: TriangleAlert, label: "Failed" },
  proposed: { tone: "petrol", icon: CircleDot, label: "Proposed" },
  edited: { tone: "attention", icon: Clock, label: "Edited" },
  ready: { tone: "done", icon: CircleCheck, label: "Ready" },
  notStarted: { tone: "waiting", icon: Circle, label: "Not started" },
  loading: { tone: "petrol", icon: CircleDot, label: "Loading" },
  planChanged: { tone: "attention", icon: RefreshCw, label: "Plan changed" },
  flagWaiting: { tone: "attention", icon: Clock, label: "1 flag waiting" },
  workshop: { tone: "waiting", icon: Info, label: "In the workshop" },
  needsAnswer: { tone: "attention", icon: Clock, label: "Needs your answer" },
  twoCopies: { tone: "attention", icon: Clock, label: "Two copies" },
  resolved: { tone: "done", icon: CircleCheck, label: "Conflict resolved" },
} satisfies Record<string, { tone: Tone; icon: LucideIcon; label: string }>;

export type ChipKind = keyof typeof CHIPS;

const TONE: Record<Tone, string> = {
  chilled: "bg-chilled-soft text-chilled",
  done: "bg-done-soft text-done",
  attention: "bg-attention-soft text-attention",
  problem: "bg-problem-soft text-problem",
  // The Waiting rule: text and icons asphalt-700 on the soft fill, with an asphalt-300 border.
  waiting: "bg-waiting-soft text-asphalt-700 border border-asphalt-300",
  neutral: "bg-asphalt-100 text-asphalt-900",
  muted: "bg-asphalt-100 text-asphalt-700",
  petrol: "bg-petrol-50 text-petrol-700",
};

type Props = {
  kind?: ChipKind;
  tone?: Tone;
  icon?: LucideIcon;
  children?: ReactNode;
  density?: "desk" | "store" | "field";
  className?: string;
};

export function StatusChip({ kind, tone, icon, children, density = "store", className }: Props) {
  const preset = kind ? CHIPS[kind] : undefined;
  const Icon = icon ?? preset?.icon;
  const t = tone ?? preset?.tone ?? "neutral";
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-chip t-label",
        density === "desk" ? "min-h-6 px-2" : "min-h-7 px-2 py-1",
        TONE[t],
        className,
      )}
    >
      {Icon ? <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" /> : null}
      <span className="min-w-0">{children ?? preset?.label}</span>
    </span>
  );
}
