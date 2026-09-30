import { Minus, Plus } from "lucide-react";
import { cx } from "@/lib/cx";

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  /** "dairy crates": the buttons read "Fewer dairy crates" and "More dairy crates". */
  unit: string;
  size?: "store" | "field";
};

/** A number stepper with a typeable value. */
export function Stepper({ value, onChange, min = 0, max = 999, label, unit, size = "store" }: Props) {
  const box = size === "field" ? "size-16" : "size-12";
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div
      className={cx(
        "inline-flex shrink-0 items-center rounded-chip border border-asphalt-300 bg-white",
        size === "field" ? "h-16" : "h-12",
      )}
    >
      <button
        type="button"
        aria-label={`Fewer ${unit}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className={cx(box, "flex items-center justify-center text-asphalt-900 disabled:text-asphalt-300")}
      >
        <Minus size={20} strokeWidth={1.75} aria-hidden />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          onChange(clamp(digits ? Number(digits) : 0));
        }}
        className={cx("num t-h3 h-full bg-transparent text-center outline-none", size === "field" ? "w-20" : "w-13")}
      />
      <button
        type="button"
        aria-label={`More ${unit}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={cx(box, "flex items-center justify-center text-asphalt-900 disabled:text-asphalt-300")}
      >
        <Plus size={20} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
