import { CalendarClock, ChartColumn, ClipboardList, Layers, LogOut, type LucideIcon, Route } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useSearchParams } from "react-router";
import { useMe, useSignOut } from "@/app/session";
import { useSimNow } from "@/demo/clock";
import { RelayMark } from "@/design/Logo";
import { Segmented } from "@/design/Segmented";
import { cx } from "@/lib/cx";
import { formatStamp } from "@/lib/time";

const NAV: { to: string; label: string; icon: LucideIcon; key: string }[] = [
  { to: "/dispatcher", label: "Queue", icon: ClipboardList, key: "1" },
  { to: "/dispatcher/plan", label: "Plan", icon: Layers, key: "2" },
  { to: "/dispatcher/live", label: "Live", icon: Route, key: "3" },
  { to: "/dispatcher/outlook", label: "Outlook", icon: ChartColumn, key: "4" },
];

export type Depot = "All" | "Peliyagoda" | "Kandy";

/** The desk shell: nav rail, and the depot choice kept in the address so a view can be shared. */
export function DispatcherShell() {
  const me = useMe("dispatcher");
  const signOut = useSignOut("dispatcher");
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("input, textarea, select, [contenteditable]") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const item = NAV.find((n) => n.key === event.key);
      if (item) {
        event.preventDefault();
        navigate({ pathname: item.to, search: params.toString() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, params]);

  const initials = (me.data?.display_name ?? "")
    .split(" ")
    .map((w) => w[0])
    .join("");

  return (
    <div className="flex min-h-dvh flex-col bg-asphalt-50">
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Dispatcher"
          className="sticky top-0 flex h-dvh w-[88px] shrink-0 flex-col items-center gap-2 border-r border-asphalt-200 bg-white py-5 max-md:hidden"
        >
          <RelayMark size={32} className="mb-3" />
          {NAV.map(({ to, label, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={{ pathname: to, search: params.toString() }}
              end={to === "/dispatcher"}
              className={({ isActive }) =>
                cx(
                  "flex h-16 w-[72px] flex-col items-center justify-center gap-1 rounded-[10px]",
                  isActive ? "bg-petrol-50 text-petrol-700" : "text-asphalt-500 hover:bg-asphalt-50",
                )
              }
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden />
              <span className="flex items-center gap-1 t-caption">
                <span className="text-current">{label}</span>
                <kbd className="num inline-flex size-5 items-center justify-center rounded-chip border border-asphalt-300 bg-white t-caption text-asphalt-500 not-italic">
                  {key}
                </kbd>
              </span>
            </NavLink>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            title="Sign out"
            onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate("/signin?role=dispatcher") })}
            className="flex flex-col items-center gap-1 rounded-[10px] px-2 py-1 text-asphalt-500 hover:bg-asphalt-50"
          >
            <span className="latin flex size-9 items-center justify-center rounded-full bg-asphalt-100 t-label-strong text-asphalt-900">
              {initials}
            </span>
            <span className="inline-flex items-center gap-1 t-caption">
              <LogOut size={12} strokeWidth={1.75} aria-hidden />
              Sign out
            </span>
          </button>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
      <nav
        aria-label="Dispatcher, phone"
        className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-asphalt-200 bg-white md:hidden"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={{ pathname: to, search: params.toString() }}
            end={to === "/dispatcher"}
            className={({ isActive }) =>
              cx(
                "flex h-14 flex-col items-center justify-center gap-0.5 t-caption",
                isActive ? "text-petrol-700" : "text-asphalt-500",
              )
            }
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function useDepot(defaultDepot: Depot = "All"): [Depot, (d: Depot) => void] {
  const [params, setParams] = useSearchParams();
  const depot = (params.get("depot") as Depot | null) ?? defaultDepot;
  return [
    depot,
    (d) =>
      setParams(
        (p) => {
          p.set("depot", d);
          return p;
        },
        { replace: true },
      ),
  ];
}

/** Desktop page header: title, meta, the scenario clock, the depot switch and page controls. */
export function DeskHeader({
  title,
  meta,
  depot,
  onDepot,
  allowAll = true,
  allTitle = "Plans are made one depot at a time, because each vehicle serves only its home depot.",
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  depot?: Depot;
  onDepot?: (d: Depot) => void;
  allowAll?: boolean;
  /** Why "All" is off on this page. */
  allTitle?: string;
  children?: ReactNode;
}) {
  const now = useSimNow(15_000);
  return (
    <header className="flex min-h-20 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-asphalt-200 bg-white px-6 py-3">
      <div className="min-w-0">
        <h1 className="t-display max-md:t-h1">{title}</h1>
        {meta ? <div className="flex items-center gap-1.5 t-dense text-asphalt-700">{meta}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {now ? (
          <span className="inline-flex items-center gap-1.5 max-md:hidden">
            <CalendarClock size={20} strokeWidth={1.75} aria-hidden className="text-asphalt-500" />
            <span className="num t-label text-asphalt-700">{formatStamp(now)}</span>
          </span>
        ) : null}
        {depot && onDepot ? (
          <Segmented<Depot>
            size="desk"
            label="Depot"
            value={depot}
            onChange={onDepot}
            segments={[
              {
                value: "All",
                label: "All",
                disabled: !allowAll,
                title: allowAll ? undefined : allTitle,
              },
              { value: "Peliyagoda", label: "Peliyagoda" },
              { value: "Kandy", label: "Kandy hub" },
            ]}
          />
        ) : null}
        {children}
      </div>
    </header>
  );
}
