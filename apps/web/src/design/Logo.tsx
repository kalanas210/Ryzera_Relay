import { cx } from "@/lib/cx";

/** The Relay mark: a baton passed from one hand to the next. */
export function RelayMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#0F5563" />
      <path d="M12 20L20 12" stroke="#F2B705" strokeWidth="5" strokeLinecap="round" />
      <rect x="18.01" y="15.13" width="10" height="4" rx="2" transform="rotate(-45 23.01 17.13)" fill="#FFFFFF" />
      <rect
        x="3.99"
        y="12.87"
        width="10"
        height="4"
        rx="2"
        transform="rotate(-45 8.99 14.87)"
        fill="#FFFFFF"
        fillOpacity="0.55"
      />
    </svg>
  );
}

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <RelayMark size={size} />
      <span className={cx(size >= 32 ? "t-h1" : "t-h2", "latin text-asphalt-900")}>Relay</span>
    </span>
  );
}
