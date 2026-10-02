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
  /** The buttons' names in the reader's language, when the screen is not in English. */
  fewerLabel?: string;
  moreLabel?: string;
  size?: "store" | "field";
};

/** A number stepper with a typeable value. The field size is the loader's: 64 px buttons and a Display value. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  label,
  unit,
  fewerLabel = `Fewer ${unit}`,
  moreLabel = `More ${unit}`,
  size = "store",
}: Props) {
  const field = size === "field";
  const box = field ? "size-16" : "size-12";
  const icon = field ? 24 : 20;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div
      className={cx(
        "inline-flex shrink-0 items-center rounded-chip border border-asphalt-300 bg-white",
        field ? "h-16" : "h-12",
      )}
    >
      <button
        type="button"
        aria-label={fewerLabel}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className={cx(box, "flex items-center justify-center text-asphalt-900 disabled:text-asphalt-300")}
      >
        <Minus size={icon} strokeWidth={1.75} aria-hidden />
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
        className={cx("num h-full bg-transparent text-center outline-none", field ? "t-display w-20" : "t-h3 w-13")}
      />
      <button
        type="button"
        aria-label={moreLabel}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={cx(box, "flex items-center justify-center text-asphalt-900 disabled:text-asphalt-300")}
      >
        <Plus size={icon} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
