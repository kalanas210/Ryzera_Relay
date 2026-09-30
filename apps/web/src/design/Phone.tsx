import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { cx } from "@/lib/cx";
import { IconButton } from "./Button";

/** The phone layout the field and store roles share: a fixed header, scrolling content and an optional
 *  fixed action bar. On a wide screen the same column sits centered. */
export function PhoneScreen({
  header,
  children,
  bar,
  className,
}: {
  header: ReactNode;
  children: ReactNode;
  bar?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-asphalt-50", className)}>
      <div className="sticky top-0 z-20">{header}</div>
      <main className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-6">{children}</main>
      {bar ? (
        <div className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-asphalt-200 bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {bar}
        </div>
      ) : null}
    </div>
  );
}

export function HomeHeader({ title, meta, right }: { title: ReactNode; meta?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex min-h-20 items-center gap-3 border-b border-asphalt-200 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <h1 className="t-h1">{title}</h1>
        {meta ? <p className="t-label text-asphalt-700">{meta}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function BackHeader({
  title,
  back,
  right,
  density = "store",
}: {
  title: ReactNode;
  back?: string | (() => void) | null;
  right?: ReactNode;
  density?: "store" | "field";
}) {
  const navigate = useNavigate();
  return (
    <header
      className={cx(
        "flex min-h-16 items-center gap-1 border-b border-asphalt-200 bg-white py-2 pr-4",
        back === null ? "pl-4" : "pl-1",
      )}
    >
      {back !== null ? (
        <IconButton
          icon={ArrowLeft}
          label="Back"
          density={density}
          onClick={() => (typeof back === "function" ? back() : back ? navigate(back) : navigate(-1))}
        />
      ) : null}
      <h1 className={cx("min-w-0 flex-1", density === "field" ? "t-h2 truncate" : "t-h1")}>{title}</h1>
      {right}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-card border border-asphalt-200 bg-white", className)}>{children}</section>;
}
