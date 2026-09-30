import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type Segment<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  /** The selected icon takes its status color, e.g. the chilled snowflake. */
  iconClass?: string;
  badge?: number;
  disabled?: boolean;
  title?: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  segments: Segment<T>[];
  label: string;
  size?: "desk" | "store";
  className?: string;
};

/** Input / segmented control: a track with one selected segment. */
export function Segmented<T extends string>({ value, onChange, segments, label, size = "store", className }: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "inline-flex items-stretch gap-1 rounded-chip border border-asphalt-200 bg-asphalt-100 p-0.5",
        size === "store" ? "h-12" : "h-9",
        className,
      )}
    >
      {segments.map((s) => {
        const selected = s.value === value;
        const Icon = s.icon;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a styled radio group
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={s.disabled}
            title={s.title}
            onClick={() => onChange(s.value)}
            className={cx(
              "flex flex-1 items-center justify-center gap-2 rounded-chip px-3 whitespace-nowrap",
              selected
                ? "border border-asphalt-300 bg-white t-label-strong text-asphalt-900"
                : "t-label text-asphalt-700 hover:text-asphalt-900",
              s.disabled && "text-asphalt-300",
            )}
          >
            {Icon ? (
              <Icon
                size={size === "store" ? 20 : 16}
                strokeWidth={1.75}
                aria-hidden
                className={selected ? s.iconClass : undefined}
              />
            ) : null}
            {s.label}
            {s.badge ? (
              <span className="num rounded-chip bg-asphalt-200 px-1.5 py-0.5 t-caption text-asphalt-900">
                {s.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
