import { CalendarClock, ChartColumn, ClipboardList, Layers, LogOut, type LucideIcon, Route } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { useMe, useSignOut } from "@/app/session";
import { useSimNow } from "@/demo/clock";
import { RelayMark } from "@/design/Logo";
import { Segmented } from "@/design/Segmented";
import { Sheet } from "@/design/Sheet";
import { cx } from "@/lib/cx";
import { formatStamp } from "@/lib/time";

const NAV: { to: string; label: string; icon: LucideIcon; key: string }[] = [
  { to: "/dispatcher", label: "Queue", icon: ClipboardList, key: "1" },
  { to: "/dispatcher/plan", label: "Plan", icon: Layers, key: "2" },
  { to: "/dispatcher/live", label: "Live", icon: Route, key: "3" },
  { to: "/dispatcher/outlook", label: "Outlook", icon: ChartColumn, key: "4" },
];

export type Depot = "All" | "Peliyagoda" | "Kandy";

/** Letter and number shortcuts stay off while a field has focus or a dialog is open. */
export function typingOrInDialog(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable], dialog"));
}

/** The desk shell: nav rail, and the depot choice kept in the address so a view can be shared. It fills the window
 *  below the demo bar and its pages scroll inside it, so the rail's foot stays on screen and a drag on the plan
 *  board never scrolls the header away. */
export function DispatcherShell() {
  const me = useMe("dispatcher");
  const signOut = useSignOut("dispatcher");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const shell = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const top = useOffsetTop(shell);
  const [shortcuts, setShortcuts] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typingOrInDialog(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcuts(true);
        return;
      }
      const item = NAV.find((n) => n.key === event.key);
      if (item) {
        event.preventDefault();
        navigate({ pathname: item.to, search: params.toString() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, params]);

  // each page opens at its top, as it would with the window scrolling
  const shown = useRef(pathname);
  useEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    main.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const initials = (me.data?.display_name ?? "")
    .split(" ")
    .map((w) => w[0])
    .join("");

  return (
    <div
      ref={shell}
      // --desk-h is the window below the demo bar: the height the pages scroll in, for anything sticky inside them
      style={{ "--desk-h": `calc(100dvh - ${top}px)`, height: "var(--desk-h)" } as CSSProperties}
      className="flex min-h-80 flex-col overflow-hidden bg-asphalt-50"
    >
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Dispatcher"
          className="flex w-[88px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-asphalt-200 bg-white py-5 max-md:hidden"
        >
          <RelayMark size={32} className="mb-3 shrink-0" />
          {NAV.map(({ to, label, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={{ pathname: to, search: params.toString() }}
              end={to === "/dispatcher"}
              aria-keyshortcuts={key}
              className={({ isActive }) =>
                cx(
                  "flex h-16 w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px]",
                  isActive ? "bg-petrol-50 text-petrol-700" : "text-asphalt-500 hover:bg-asphalt-50",
                )
              }
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden />
              <span className="flex items-center gap-1 t-caption">
                <span className="text-current">{label}</span>
                <KeyHint>{key}</KeyHint>
              </span>
            </NavLink>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            aria-keyshortcuts="?"
            onClick={() => setShortcuts(true)}
            className="flex h-[52px] w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] text-asphalt-700 hover:bg-asphalt-50"
          >
            <KeyHint>?</KeyHint>
            <span className="t-caption">Shortcuts</span>
          </button>
          <button
            type="button"
            title="Sign out"
            onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate("/signin?role=dispatcher") })}
            className="flex shrink-0 flex-col items-center gap-1 rounded-[10px] px-2 py-1 text-asphalt-500 hover:bg-asphalt-50"
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
        {/* a div, not main: the phone's Live runs page carries its own main landmark */}
        <div ref={main} data-drag-scroll className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </div>
      </div>
      <nav
        aria-label="Dispatcher, phone"
        className="z-30 grid shrink-0 grid-cols-4 border-t border-asphalt-200 bg-white md:hidden"
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
      <ShortcutsSheet open={shortcuts} onClose={() => setShortcuts(false)} />
    </div>
  );
}

/** How far the element starts below the top of the page: the demo bar's height, kept current as the bar wraps,
 *  appears or goes. */
function useOffsetTop(ref: RefObject<HTMLElement | null>): number {
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const measure = () => setTop(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY)));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const sizes = new ResizeObserver(measure);
    const watchSiblings = () => {
      sizes.disconnect();
      for (let sibling = el.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        sizes.observe(sibling);
      }
    };
    watchSiblings();
    const children = new MutationObserver(() => {
      watchSiblings();
      measure();
    });
    children.observe(parent, { childList: true });
    window.addEventListener("resize", measure);
    return () => {
      sizes.disconnect();
      children.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);
  return top;
}

function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd className="num inline-flex h-5 min-w-5 items-center justify-center rounded-chip border border-asphalt-300 bg-white px-1 t-caption text-asphalt-500 not-italic">
      {children}
    </kbd>
  );
}

const SHORTCUTS: { keys: string[][]; action: string; where: string }[] = [
  { keys: [["1"], ["2"], ["3"], ["4"]], action: "Go to Queue, Plan, Live or Outlook", where: "Everywhere" },
  { keys: [["?"]], action: "Open this list", where: "Everywhere" },
  {
    keys: [
      ["Shift", "A"],
      ["Shift", "P"],
      ["Shift", "K"],
    ],
    action: "Depot: All, Peliyagoda, Kandy hub",
    where: "Where the depot switch allows it",
  },
  { keys: [["Esc"]], action: "Close a drawer, menu or dialog", where: "Everywhere" },
  { keys: [["M"]], action: "Move the focused stop or order to a trip", where: "Plan" },
  {
    keys: [["Space"]],
    action: "Pick up the focused stop or order, move it with the arrow keys, Space again to drop it",
    where: "Plan",
  },
  { keys: [["Ctrl", "Z"]], action: "Undo the last move", where: "Plan" },
  { keys: [["P"]], action: "Propose again, asking first if anything was moved by hand", where: "Plan" },
  { keys: [["D"]], action: "Open deferrals", where: "Plan" },
  { keys: [["Ctrl", "Enter"]], action: "Publish plan, when allowed: opens the publish check", where: "Plan" },
];

/** The shortcuts sheet: every desk key that works, and where. None of them sends anything to a store or a driver. */
function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="dialog"
      width={560}
      title="Keyboard shortcuts"
      meta="Off while a text field has focus. None of them sends anything to a store or a driver."
    >
      <table className="w-full t-dense">
        <thead className="sr-only">
          <tr>
            <th>Keys</th>
            <th>Action</th>
            <th>Where</th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.action} className="border-t border-asphalt-100 align-top first:border-t-0">
              <td className="py-2 pr-4 whitespace-nowrap">
                <span className="inline-flex flex-wrap items-center gap-1">
                  {s.keys.map((combo, i) => (
                    <span key={combo.join("+")} className="inline-flex items-center gap-1">
                      {i > 0 ? <span className="t-caption text-asphalt-500">,</span> : null}
                      {combo.map((k) => (
                        <KeyHint key={k}>{k}</KeyHint>
                      ))}
                    </span>
                  ))}
                </span>
              </td>
              <td className="py-2 pr-4 text-asphalt-900">{s.action}</td>
              <td className="py-2 t-caption text-asphalt-500">{s.where}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
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

const DEPOT_KEYS: Record<string, Depot> = { KeyA: "All", KeyP: "Peliyagoda", KeyK: "Kandy" };

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

  // Shift A, Shift P and Shift K switch the depot, where the switch allows that depot
  useEffect(() => {
    if (!onDepot) return;
    const onKey = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || typingOrInDialog(event)) return;
      const next = DEPOT_KEYS[event.code];
      if (!next || (next === "All" && !allowAll)) return;
      event.preventDefault();
      onDepot(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDepot, allowAll]);

  return (
    <header className="flex min-h-20 shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-asphalt-200 bg-white px-6 py-3">
      <div className="min-w-0">
        <h1 className="t-display max-md:t-h1">{title}</h1>
        {meta ? <div className="flex flex-wrap items-center gap-x-1.5 t-dense text-asphalt-700">{meta}</div> : null}
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
                title: allowAll ? "All depots (Shift A)" : allTitle,
              },
              { value: "Peliyagoda", label: "Peliyagoda", title: "Peliyagoda (Shift P)" },
              { value: "Kandy", label: "Kandy hub", title: "Kandy hub (Shift K)" },
            ]}
          />
        ) : null}
        {children}
      </div>
    </header>
  );
}
