import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

export type Density = "desk" | "store" | "field";
type Variant = "primary" | "secondary" | "quiet" | "danger" | "link";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  density?: Density;
  icon?: LucideIcon;
  iconAfter?: LucideIcon;
  full?: boolean;
  compact?: boolean;
  /** Field screens say what is left instead of greying out: "Add a name and a photo". */
  reason?: ReactNode;
};

/** Store and field buttons grow to a second line rather than clip: Sinhala and Tamil labels run longer. */
const HEIGHT: Record<Density, { primary: string; other: string; compact: string; text: string; icon: number }> = {
  desk: { primary: "h-9", other: "h-9", compact: "h-8", text: "t-dense-strong", icon: 20 },
  store: { primary: "min-h-12 py-1.5", other: "min-h-12 py-1.5", compact: "min-h-11 py-1", text: "t-button", icon: 20 },
  field: {
    primary: "min-h-14 py-2",
    other: "min-h-12 py-1.5",
    compact: "min-h-12 py-1",
    text: "t-field-button",
    icon: 24,
  },
};

const VARIANT: Record<Variant, string> = {
  primary: "bg-petrol-700 text-white hover:bg-petrol-800 active:bg-petrol-800",
  secondary: "bg-white text-asphalt-900 border border-asphalt-300 hover:bg-asphalt-50",
  quiet: "bg-transparent text-asphalt-900 hover:bg-asphalt-100",
  link: "bg-transparent text-petrol-700 hover:bg-petrol-50",
  danger: "bg-problem text-white hover:opacity-90",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-button px-4 text-center transition-colors select-none";

function sizeOf(density: Density, variant: Variant, compact: boolean | undefined) {
  const size = HEIGHT[density];
  return {
    height: compact ? size.compact : variant === "primary" ? size.primary : size.other,
    text: compact && density === "field" ? "t-body-strong" : size.text,
    icon: size.icon,
  };
}

/** A button's look for something that is not a button, such as a link that opens another screen, so the two never
 *  drift apart. The icon size to draw beside its label comes with it. */
export function buttonLook({
  variant = "secondary",
  density = "store",
  full,
  compact,
}: {
  variant?: Variant;
  density?: Density;
  full?: boolean;
  compact?: boolean;
}): { className: string; icon: number } {
  const size = sizeOf(density, variant, compact);
  return { className: cx(BASE, size.height, size.text, full && "w-full", VARIANT[variant]), icon: size.icon };
}

export function Button({
  variant = "secondary",
  density = "store",
  icon: Icon,
  iconAfter: IconAfter,
  full,
  compact,
  reason,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: Props) {
  const size = sizeOf(density, variant, compact);
  const showReason = disabled && reason && density === "field";
  return (
    <button
      type={type}
      disabled={disabled}
      className={cx(
        BASE,
        "disabled:cursor-not-allowed",
        size.height,
        size.text,
        full && "w-full",
        showReason
          ? "bg-asphalt-100 text-asphalt-700"
          : disabled
            ? "bg-asphalt-200 text-asphalt-500"
            : VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {Icon && !showReason ? <Icon size={size.icon} strokeWidth={1.75} aria-hidden /> : null}
      {showReason ? reason : children}
      {IconAfter && !showReason ? <IconAfter size={size.icon} strokeWidth={1.75} aria-hidden /> : null}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  density = "store",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; density?: Density }) {
  const box = density === "desk" ? "size-8" : density === "store" ? "size-11" : "size-12";
  const iconSize = density === "field" ? 24 : 20;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-button text-asphalt-900 hover:bg-asphalt-100",
        box,
        className,
      )}
      {...rest}
    >
      <Icon size={iconSize} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
