import {
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  CloudOff,
  type LucideIcon,
  Package,
  PackageX,
  RefreshCw,
  Snowflake,
  Square,
  SquareCheck,
  TriangleAlert,
} from "lucide-react";
import { type PointerEvent, type ReactNode, useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { Stepper } from "@/design/Stepper";
import { useLoaderText } from "@/i18n";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import type { LoadLine, Shortfall } from "./api";
import { colomboDay } from "./days";

/** Load progress bar: petrol while loading, green when complete, with the short share in amber at the end. */
export function LoadProgress({
  loaded,
  total,
  short = 0,
  height = 8,
  complete = false,
  label,
}: {
  loaded: number;
  total: number;
  short?: number;
  height?: 6 | 8;
  complete?: boolean;
  /** "116 of 383 cases loaded", in the reader's language. */
  label?: string;
}) {
  const share = total ? Math.min(100, (loaded / total) * 100) : 0;
  const shortShare = total ? Math.min(100 - share, (short / total) * 100) : 0;
  const done = complete || loaded + short >= total;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={loaded}
      className="flex w-full overflow-hidden rounded bg-asphalt-200"
      style={{ height }}
    >
      <div className={cx("h-full", done ? "bg-done" : "bg-petrol-700")} style={{ width: `${share}%` }} />
      {done && shortShare > 0 ? <div className="h-full bg-attention" style={{ width: `${shortShare}%` }} /> : null}
    </div>
  );
}

/** "Stop 3 · Hemmathagama" on one line where it fits. Where it does not, the second part takes the next line and the
 *  dot goes with the break: the second part carries the dot in front of it, the row is pulled left by the dot's
 *  width, and a dot that starts a line falls outside the clip. A dangling "Stop 3 ·" never ends a line. */
export function DotJoin({ first, second, className }: { first: ReactNode; second: ReactNode; className?: string }) {
  return (
    <span className={cx("block overflow-x-clip", className)}>
      <span className="-ml-[0.8em] flex flex-wrap">
        <span className="pl-[0.8em]">{first}</span>
        <span className="min-w-0 [overflow-wrap:anywhere]">
          <span aria-hidden className="inline-block w-[0.8em] text-center">
            ·
          </span>
          {second}
        </span>
      </span>
    </span>
  );
}

/** The stop's title. In Sinhala and Tamil the place always takes its own line, as the " · " form does not fit. */
export function StopTitle({ seq, place }: { seq: number; place: string }) {
  const { t, lang } = useLoaderText();
  if (lang !== "en") {
    return (
      <>
        <span className="block">{t("load.stopShort", { n: seq })}</span>
        <span className="latin block">{place}</span>
      </>
    );
  }
  return <DotJoin first={t("load.stopShort", { n: seq })} second={<span className="latin">{place}</span>} />;
}

/** One of several texts in a box sized for the largest of them, so trading one for another never moves what is
 *  around it: a flag's answer arriving, a PIN error clearing, a label following the choice above it. The others
 *  are laid out in the same place, hidden, so the box holds the tallest and widest. */
export function Swap({
  shown,
  options,
  as: Tag = "span",
  className,
}: {
  shown: string;
  options: Record<string, ReactNode>;
  as?: "span" | "div";
  className?: string;
}) {
  return (
    <Tag className={cx("grid", className)}>
      {Object.entries(options).map(([key, node]) => (
        <Tag key={key} className={cx("col-start-1 row-start-1 min-w-0", key !== shown && "invisible")}>
          {node}
        </Tag>
      ))}
    </Tag>
  );
}

/** How long a button that has just appeared, or just moved, waits before it takes a tap. */
export const SETTLE_MS = 500;

/** Wraps a button's tap so it does nothing in the first half second after the button appears or `moved` changes. A
 *  double tap meant for the button that was there before (a line's check, Go to handover) then lands on nothing,
 *  instead of on an irreversible Load complete that took its place under the finger. */
export function useSettledTap(moved?: unknown): (action: () => void) => () => void {
  const since = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `moved` is the trigger, not a value read here
  useLayoutEffect(() => {
    since.current = performance.now();
  }, [moved]);
  return useCallback(
    (action: () => void) => () => {
      if (performance.now() - since.current >= SETTLE_MS) action();
    },
    [],
  );
}

const LONG_PRESS_MS = 550;

type StatusLine = { text: string; className: string; icon?: LucideIcon };

type Text = ReturnType<typeof useLoaderText>["t"];

/** Every way a flagged line's two status lines can read: waiting, not sent, no answer close to departure, or
 *  decided (with the day the cases come, any day of the week). The row is sized for the longest in the reader's
 *  language, so the dispatcher's answer arriving never changes its height under a finger. */
function flagStates(
  t: Text,
  line: LoadLine,
  s: Shortfall,
  dispatcher: string | null,
  label: string,
  labelStrong: string,
): Record<string, StatusLine[]> {
  const damaged = s.kind === "damaged";
  const tone = damaged ? "text-problem" : "text-attention";
  const first: StatusLine = {
    text: damaged
      ? t("load.damagedLine", { loaded: line.loaded, damaged: s.qty })
      : t("load.missingLine", { loaded: line.loaded, missing: s.qty }),
    className: cx(labelStrong, tone),
  };
  const short = line.status === "decided" ? line.qty - line.loaded : s.qty;
  const decided: StatusLine = {
    text: t("load.shortLine", { loaded: line.loaded, short }),
    className: cx(labelStrong, "text-attention"),
  };
  const states: Record<string, StatusLine[]> = {
    waiting: [first, { text: t("load.waitingFor", { name: calledName(dispatcher) }), className: cx(label, tone) }],
    // A flag that has not left the tablet cannot be answered: it says so, in the waiting treatment, and turns into
    // a problem 15 minutes before departure like any flag without an answer.
    unsent: [first, { text: t("load.notSent"), className: cx(label, "text-asphalt-700"), icon: CloudOff }],
    unsentLate: [first, { text: t("load.notSent"), className: cx(labelStrong, "text-problem"), icon: CloudOff }],
    late: [first, { text: t("load.noAnswerYet"), className: cx(labelStrong, "text-problem"), icon: CircleAlert }],
    notReplaced: [decided, { text: t("load.notReplaced"), className: cx(label, "text-asphalt-700") }],
  };
  for (let day = 0; day < 7; day++) {
    states[`day${day}`] = [
      decided,
      {
        text: t("load.comeOn", { count: short, day: t(`dates.weekdays.${day}`) }),
        className: cx(label, "text-asphalt-700"),
      },
    ];
  }
  return states;
}

function flagState(line: LoadLine, s: Shortfall, unsent: boolean, noAnswer: boolean): string {
  if (line.status === "decided") {
    return s.decision === "send_short" && s.added_to_day ? `day${colomboDay(s.added_to_day).weekday}` : "notReplaced";
  }
  if (unsent) return noAnswer ? "unsentLate" : "unsent";
  return noAnswer ? "late" : "waiting";
}

/** One case type for one stop. The whole row checks with one gloved tap; Flag is its own button, so a check is
 *  never read as a problem. Press and hold to count part of a line on. A line whose stop moved after it went on
 *  shows as changed until the loader taps it to confirm where it sits. Once the load is marked complete the row is
 *  a record: nothing on it checks or flags, and a flagged line still opens its flag. */
export function LoadLineRow({
  line,
  stop,
  kind,
  chilled,
  dispatcher,
  onToggle,
  onCount,
  onFlag,
  large = false,
  noAnswer = false,
  unsent = false,
  readOnly = false,
}: {
  line: LoadLine;
  stop: number;
  kind: string;
  chilled: boolean;
  dispatcher: string | null;
  onToggle: () => void;
  onCount: () => void;
  onFlag: () => void;
  large?: boolean;
  /** The flag still waits 15 minutes before departure. */
  noAnswer?: boolean;
  /** The flag is still on this tablet a minute after it was made. */
  unsent?: boolean;
  /** The load is marked complete. */
  readOnly?: boolean;
}) {
  const { t, lang } = useLoaderText();
  const press = useRef<number | undefined>(undefined);
  const held = useRef(false);
  // The line's group and its Flag and View buttons say which line they are for: "Rice and dhal, Stop 3 · Dry"
  const nameId = useId();
  const whereId = useId();
  const flagged = line.status === "flag_waiting" || line.status === "decided";
  const changed = !flagged && line.changed_by_plan;
  const damaged = line.shortfall?.kind === "damaged";
  const checked = line.status === "checked";
  const inProgress = line.status === "in_progress";
  const live = flagged || !readOnly;
  const label = large ? "t-body" : "t-label";
  const labelStrong = large ? "t-body-strong" : "t-label-strong";

  const tone = flagged
    ? damaged
      ? "bg-problem-soft border border-problem"
      : "bg-attention-soft border border-attention"
    : changed
      ? "bg-white border-2 border-attention"
      : checked
        ? "bg-done-soft border border-done"
        : "bg-white border border-asphalt-200";

  const SlotIcon = flagged
    ? line.status === "decided"
      ? PackageX
      : damaged
        ? TriangleAlert
        : Clock
    : changed
      ? RefreshCw
      : checked
        ? SquareCheck
        : Square;
  const slotColor = flagged
    ? damaged
      ? "text-problem"
      : "text-attention"
    : changed
      ? "text-attention"
      : checked
        ? "text-done"
        : "text-asphalt-700";

  // The count sheet opens while the finger is still down; the sheet itself ignores the release of that press.
  const startPress = (event: PointerEvent) => {
    held.current = false;
    if (flagged || event.button !== 0) return;
    press.current = window.setTimeout(() => {
      held.current = true;
      onCount();
    }, LONG_PRESS_MS);
  };
  const endPress = () => window.clearTimeout(press.current);

  const s = flagged ? line.shortfall : null;
  const states = s ? flagStates(t, line, s, dispatcher, label, labelStrong) : null;
  // a 16 px icon centred on the first line of a status line that may wrap
  const iconTop = large ? "mt-[3px]" : "mt-px";

  const content = (
    <>
      <span className="flex size-12 shrink-0 items-center justify-center">
        <SlotIcon size={large ? 32 : 28} strokeWidth={1.75} aria-hidden className={slotColor} />
      </span>
      <span className={cx("flex shrink-0 flex-col items-end", large ? "min-w-12" : "min-w-9")}>
        <span className={cx("num text-asphalt-900", large ? "t-display" : "t-h1")}>
          {flagged ? line.loaded : line.qty}
        </span>
        {flagged ? (
          <span className="num t-caption whitespace-nowrap text-asphalt-700">{t("load.of", { n: line.qty })}</span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={nameId} className={cx("text-asphalt-900", large ? "text-[24px] leading-8 font-semibold" : "t-field")}>
          {t(`cases.${line.case_type}`, { defaultValue: line.case_type })}
        </span>
        {/* Status line 1 always names the stop. Where it does not fit, the kind takes the next line, dot and all. */}
        <span id={whereId} className={cx("flex items-start gap-1 text-asphalt-700", label)}>
          {chilled ? (
            <Snowflake size={16} strokeWidth={1.75} aria-hidden className={cx("shrink-0 text-chilled", iconTop)} />
          ) : (
            <Package size={16} strokeWidth={1.75} aria-hidden className={cx("shrink-0", iconTop)} />
          )}
          <DotJoin first={t("load.stopShort", { n: stop })} second={kind} className="min-w-0 flex-1" />
        </span>
        {inProgress ? (
          <span className={cx("num text-petrol-700", labelStrong)}>
            {t("load.onSoFar", { loaded: line.loaded, total: line.qty })}
          </span>
        ) : null}
        {checked && !changed ? (
          <span className={cx("flex items-center gap-1 text-done", label)}>
            <Check size={16} strokeWidth={1.75} aria-hidden />
            {t("load.loaded")}
          </span>
        ) : null}
        {changed ? <span className={cx("text-attention", labelStrong)}>{t("load.changedLine")}</span> : null}
        {s && states ? (
          <Swap
            shown={flagState(line, s, unsent, noAnswer)}
            options={Object.fromEntries(
              Object.entries(states).map(([key, lines]) => [
                key,
                <span key={key} className="flex flex-col gap-0.5">
                  {lines.map((status) => (
                    <span key={status.text} className={cx(status.icon && "flex items-start gap-1", status.className)}>
                      {status.icon ? (
                        <status.icon size={16} strokeWidth={1.75} aria-hidden className={cx("shrink-0", iconTop)} />
                      ) : null}
                      {status.text}
                    </span>
                  ))}
                </span>,
              ]),
            )}
          />
        ) : null}
      </span>
    </>
  );

  // The tap area keeps room for a text column about 104 wide beside the slot and the count, or 140 for a flagged
  // line in Sinhala or Tamil, whose status lines run long. Where the line button would squeeze it narrower (Tamil
  // on a 375 wide phone, say), the button drops under the text instead of stacking the words three lines deep.
  const main = cx(
    "flex min-w-0 grow items-center gap-2 py-2 pl-2 text-left",
    flagged && lang !== "en" ? "basis-64" : "basis-53",
  );
  return (
    // biome-ignore lint/a11y/useSemanticElements: a load line and its buttons, not a set of form fields
    <div
      role="group"
      aria-labelledby={`${nameId} ${whereId}`}
      data-line={line.id}
      className={cx(
        "relative flex flex-wrap items-center gap-x-2 overflow-hidden rounded-button pr-2",
        tone,
        large ? "min-h-18" : "min-h-16",
      )}
    >
      {chilled ? <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-chilled" /> : null}
      {live ? (
        <button
          type="button"
          aria-pressed={flagged ? undefined : checked}
          onClick={() => {
            if (held.current) {
              held.current = false;
              return;
            }
            if (flagged) onFlag();
            else onToggle();
          }}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(event) => {
            // Android raises this during a long press: count once, and keep the release from toggling the line
            event.preventDefault();
            endPress();
            if (flagged) return;
            held.current = true;
            onCount();
          }}
          className={cx(main, "touch-manipulation select-none")}
        >
          {content}
        </button>
      ) : (
        <div className={main}>{content}</div>
      )}
      {live ? (
        <Button
          density="field"
          compact
          icon={flagged ? undefined : CircleAlert}
          iconAfter={flagged ? ChevronRight : undefined}
          onClick={onFlag}
          aria-describedby={`${nameId} ${whereId}`}
          className={cx("my-2 ml-auto shrink-0 px-2.5", large ? "min-w-[104px]" : "min-w-[84px]")}
        >
          {flagged ? t("load.view") : t("load.flag")}
        </Button>
      ) : null}
    </div>
  );
}

/** "How many are on?": for a line that goes on in several trips from the shelf. Each open starts from what the
 *  line has on now (none, for a line not started), never from a count left on the stepper last time. Enter in the
 *  number saves, as Save does. */
export function CountSheet({
  line,
  onClose,
  onSave,
}: {
  line: LoadLine | null;
  onClose: () => void;
  onSave: (loaded: number) => void;
}) {
  const { t } = useLoaderText();
  const form = useId();
  const [value, setValue] = useState(0);
  const [forLine, setForLine] = useState<string | null>(null);
  if (line && forLine !== line.id) {
    setForLine(line.id);
    setValue(line.loaded);
  } else if (!line && forLine !== null) {
    setForLine(null);
  }
  const item = line ? t(`casesLower.${line.case_type}`, { defaultValue: line.case_type }) : "";
  return (
    <Sheet
      open={Boolean(line)}
      onClose={onClose}
      title={line ? t(`cases.${line.case_type}`, { defaultValue: line.case_type }) : ""}
      meta={t("load.countTitle")}
      closeLabel={t("who.close")}
      footer={
        <Button type="submit" form={form} variant="primary" density="field" full>
          {t("load.countSave")}
        </Button>
      }
    >
      {line ? (
        <form
          id={form}
          onSubmit={(event) => {
            event.preventDefault();
            onSave(value);
            onClose();
          }}
          className="flex items-center justify-center gap-3 py-4"
        >
          <Stepper
            value={value}
            onChange={setValue}
            min={0}
            max={line.qty}
            label={t("load.countTitle")}
            unit={item}
            fewerLabel={t("flag.fewer", { item })}
            moreLabel={t("flag.more", { item })}
            size="field"
          />
          <span className="num t-label text-asphalt-700">{t("load.of", { n: line.qty })}</span>
        </form>
      ) : null}
    </Sheet>
  );
}
