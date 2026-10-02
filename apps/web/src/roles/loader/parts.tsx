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
import { type PointerEvent, useRef, useState } from "react";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { Stepper } from "@/design/Stepper";
import { useLoaderText } from "@/i18n";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import type { LoadLine } from "./api";
import { weekdayName } from "./days";

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

/** "Stop 3 · Hemmathagama" on one line where it fits. Where it does not, the place takes the next line and the dot
 *  goes with the break: the place carries the dot in front of it, the row is pulled left by the dot's width, and a
 *  dot that starts a line falls outside the clip. In Sinhala and Tamil the place always takes its own line, as the
 *  " · " form does not fit. */
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
  return (
    <span className="block overflow-x-clip">
      <span className="-ml-[0.8em] flex flex-wrap">
        <span className="pl-[0.8em]">{t("load.stopShort", { n: seq })}</span>
        <span className="latin min-w-0 [overflow-wrap:anywhere]">
          <span aria-hidden className="inline-block w-[0.8em] text-center">
            ·
          </span>
          {place}
        </span>
      </span>
    </span>
  );
}

const LONG_PRESS_MS = 550;

type StatusLine = { text: string; className: string; icon?: LucideIcon };

/** One case type for one stop. The whole row checks with one gloved tap; Flag is its own button, so a check is
 *  never read as a problem. Press and hold to count part of a line on. A line whose stop moved after it went on
 *  shows as changed until the loader taps it to confirm where it sits. */
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
}) {
  const { t } = useLoaderText();
  const press = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const flagged = line.status === "flag_waiting" || line.status === "decided";
  const changed = !flagged && line.changed_by_plan;
  const damaged = line.shortfall?.kind === "damaged";
  const checked = line.status === "checked";
  const inProgress = line.status === "in_progress";
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

  const missing = line.qty - line.loaded;
  const statusLines: StatusLine[] = [];
  if (flagged && line.shortfall) {
    const s = line.shortfall;
    if (line.status === "flag_waiting") {
      statusLines.push({
        text: damaged
          ? t("load.damagedLine", { loaded: line.loaded, damaged: s.qty })
          : t("load.missingLine", { loaded: line.loaded, missing: s.qty }),
        className: cx(labelStrong, damaged ? "text-problem" : "text-attention"),
      });
      // A flag that has not left the tablet cannot be answered: it says so, in the waiting treatment, and turns
      // into a problem 15 minutes before departure like any flag without an answer.
      statusLines.push(
        unsent
          ? {
              text: t("load.notSent"),
              className: noAnswer ? cx(labelStrong, "text-problem") : cx(label, "text-asphalt-700"),
              icon: CloudOff,
            }
          : noAnswer
            ? { text: t("load.noAnswerYet"), className: cx(labelStrong, "text-problem"), icon: CircleAlert }
            : {
                text: t("load.waitingFor", { name: calledName(dispatcher) }),
                className: cx(label, damaged ? "text-problem" : "text-attention"),
              },
      );
    } else {
      statusLines.push({
        text: t("load.shortLine", { loaded: line.loaded, short: missing }),
        className: cx(labelStrong, "text-attention"),
      });
      statusLines.push({
        text:
          s.decision === "send_short" && s.added_to_day
            ? t("load.comeOn", { count: missing, day: weekdayName(t, s.added_to_day) })
            : t("load.notReplaced"),
        className: cx(label, "text-asphalt-700"),
      });
    }
  }

  return (
    <div
      data-line={line.id}
      className={cx(
        "relative flex items-center gap-2 overflow-hidden rounded-button pr-2",
        tone,
        large ? "min-h-18" : "min-h-16",
      )}
    >
      {chilled ? <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-chilled" /> : null}
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
        className="flex min-w-0 flex-1 touch-manipulation items-center gap-2 py-2 pl-2 text-left select-none"
      >
        <span className="flex size-12 shrink-0 items-center justify-center">
          <SlotIcon size={large ? 32 : 28} strokeWidth={1.75} aria-hidden className={slotColor} />
        </span>
        <span className={cx("flex shrink-0 flex-col items-end", large ? "w-12" : "w-9")}>
          <span className={cx("num text-asphalt-900", large ? "t-display" : "t-h1")}>
            {flagged ? line.loaded : line.qty}
          </span>
          {flagged ? <span className="num t-caption text-asphalt-700">{t("load.of", { n: line.qty })}</span> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cx("text-asphalt-900", large ? "text-[24px] leading-8 font-semibold" : "t-field")}>
            {t(`cases.${line.case_type}`, { defaultValue: line.case_type })}
          </span>
          <span className={cx("flex items-center gap-1 text-asphalt-700", label)}>
            {chilled ? (
              <Snowflake size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-chilled" />
            ) : (
              <Package size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            )}
            {t("load.lineStop", { n: stop, kind })}
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
          {statusLines.map((s) => (
            <span key={s.text} className={cx(s.icon && "flex items-center gap-1", s.className)}>
              {s.icon ? <s.icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" /> : null}
              {s.text}
            </span>
          ))}
        </span>
      </button>
      <Button
        density="field"
        compact
        icon={flagged ? undefined : CircleAlert}
        iconAfter={flagged ? ChevronRight : undefined}
        onClick={onFlag}
        className={cx("shrink-0 px-2.5", large ? "min-w-[104px]" : "min-w-[84px]")}
      >
        {flagged ? t("load.view") : t("load.flag")}
      </Button>
    </div>
  );
}

/** "How many are on?": for a line that goes on in several trips from the shelf. Each open starts from what the
 *  line has on now, never from a count left on the stepper last time. */
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
  const [value, setValue] = useState(0);
  const [forLine, setForLine] = useState<string | null>(null);
  if (line && forLine !== line.id) {
    setForLine(line.id);
    setValue(line.loaded || line.qty);
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
        <Button
          variant="primary"
          density="field"
          full
          onClick={() => {
            onSave(value);
            onClose();
          }}
        >
          {t("load.countSave")}
        </Button>
      }
    >
      {line ? (
        <div className="flex items-center justify-center gap-3 py-4">
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
        </div>
      ) : null}
    </Sheet>
  );
}
