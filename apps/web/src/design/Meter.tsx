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
  label: string;
  caption?: string;
  // full is the trip detail's 2 x 2 grid. compact is a trip card's line. fuel is a lane's vehicle block.
  size?: "full" | "compact" | "fuel";
  title?: string;
  className?: string;
};

// Near starts at 90% (fuel 85%), over is above 100%. Over also shows the word, so color is not the only sign.
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
        {/* biome-ignore lint/a11y/useSemanticElements: the native meter can't take the design's three states reliably */}
        <div
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
  const bar = (
    // biome-ignore lint/a11y/useSemanticElements: the native meter can't take the design's three states reliably
    <div
      className={cx(
        "h-1 overflow-hidden rounded-full bg-asphalt-100",
        // A narrow card gives up bar before it gives up a digit of the value.
        size === "fuel" ? "w-full" : "w-16 min-w-6 shrink",
      )}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-label={title}
    >
      <div className={cx("h-full rounded-full", BAR[state])} style={{ width: `${state === "over" ? 100 : pct}%` }} />
    </div>
  );
  if (size === "fuel") {
    return (
      <div className={cx("flex flex-col gap-1", className)} title={title}>
        <div className="flex items-baseline justify-between gap-2 t-caption">
          <span className="text-asphalt-500">Fuel</span>
          <span className={cx("num whitespace-nowrap", TEXT[state])}>{label}</span>
        </div>
        {bar}
      </div>
    );
  }
  return (
    <div className={cx("flex items-center gap-2", className)} title={title}>
      <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-500" />
      {bar}
      <span className={cx("num shrink-0 t-caption whitespace-nowrap", TEXT[state])}>{label}</span>
    </div>
  );
}
