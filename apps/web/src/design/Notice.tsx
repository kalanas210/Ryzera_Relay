import { CircleCheck, Clock, CloudOff, Info, type LucideIcon, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type NoticeTone = "info" | "attention" | "problem" | "done" | "waiting";

const STYLE: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: "bg-white border border-asphalt-200", icon: "text-asphalt-700", Icon: Info },
  attention: { box: "bg-attention-soft", icon: "text-attention", Icon: Clock },
  problem: { box: "bg-problem-soft", icon: "text-problem", Icon: TriangleAlert },
  done: { box: "bg-done-soft", icon: "text-done", Icon: CircleCheck },
  waiting: { box: "bg-waiting-soft border border-asphalt-300", icon: "text-asphalt-700", Icon: CloudOff },
};

type Props = {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
  field?: boolean;
  className?: string;
  role?: "status" | "alert";
};

export function Notice({ tone = "info", title, children, icon, action, compact, field, className, role }: Props) {
  const s = STYLE[tone];
  const Icon = icon ?? s.Icon;
  return (
    <div
      role={role}
      className={cx(
        "flex items-start gap-3",
        compact ? "rounded-button px-3 py-2" : "rounded-card px-4 py-3",
        s.box,
        className,
      )}
    >
      <Icon size={field ? 24 : 20} strokeWidth={1.75} aria-hidden className={cx("mt-0.5 shrink-0", s.icon)} />
      <div className="min-w-0 flex-1">
        {title ? <p className="t-h3 text-asphalt-900">{title}</p> : null}
        {children ? <div className={cx(field ? "t-body" : "t-dense", "text-asphalt-900")}>{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
