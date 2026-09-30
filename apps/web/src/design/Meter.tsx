import { Box, Fuel, type LucideIcon, Timer, Weight } from "lucide-react";
import { cx } from "@/lib/cx";

export type Measure = "weight" | "volume" | "time" | "fuel";

const ICON: Record<Measure, LucideIcon> = { weight: Weight, volume: Box, time: Timer, fuel: Fuel };

export function meterState(value: number, limit: number, measure: Measure): "normal" | "near" | "over" {
  const share = limit > 0 ? value / limit : 0;
  if (share > 1 + 1e-9) return "over";
  if (share >= (measure === "fuel" ? 0.85 : 0.9)) return "near";
  return "normal";
}

const BAR = { normal: "bg-petrol-700", near: "bg-attention", over: "bg-problem" };
const TEXT = { normal: "text-asphalt-900", near: "text-attention", over: "text-problem" };

type Props = {
  measure: Measure;
  value: number;
  limit: number;
  /** "801.6 of 1,040 kg" */
  label: string;
  caption?: string;
  size?: "full" | "compact";
  title?: string;
  className?: string;
};

/** Capacity meter: how close a trip is to a limit. Normal below 90% (fuel 85%), near the limit up to 100%,
 *  over above it, with the word "Over" so it never relies on color. */
export function Meter({ measure, value, limit, label, caption, size = "compact", title, className }: Props) {
  const state = meterState(value, limit, measure);
  const pct = Math.max(0, Math.min(100, limit > 0 ? (value / limit) * 100 : 0));
  const Icon = ICON[measure];
  if (size === "full") {
    return (
      <div className={cx("flex flex-col gap-1", className)}>
        <div className="flex items-center gap-1.5 t-caption text-asphalt-700">
          <Icon size={16} strokeWidth={1.75} aria-hidden />
          {title}
        </div>
        <div className={cx("num t-label-strong", TEXT[state])}>
          {state === "over" ? "Over · " : ""}
          {label}
        </div>
        <div
          // biome-ignore lint/a11y/useSemanticElements: the native meter can't take the design's three states reliably
          className="h-2 overflow-hidden rounded-full bg-asphalt-100"
          role="meter"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-label={title}
        >
          <div
            className={cx("h-full rounded-full", BAR[state])}
            style={{ width: `${state === "over" ? 100 : pct}%` }}
          />
        </div>
        {caption ? <p className="num t-caption text-asphalt-500">{caption}</p> : null}
      </div>
    );
  }
  return (
    <div className={cx("flex items-center gap-2", className)} title={title}>
      <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-500" />
      <div
        // biome-ignore lint/a11y/useSemanticElements: the native meter can't take the design's three states reliably
        className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-asphalt-100"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={title}
      >
        <div className={cx("h-full rounded-full", BAR[state])} style={{ width: `${state === "over" ? 100 : pct}%` }} />
      </div>
      <span className={cx("num t-caption truncate", TEXT[state])}>{label}</span>
    </div>
  );
}
