import {
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  Package,
  PackageX,
  Snowflake,
  Square,
  SquareCheck,
  TriangleAlert,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { Stepper } from "@/design/Stepper";
import { useLoaderText, weekdayIn } from "@/i18n";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import type { LoadLine } from "./api";

/** Load progress bar: petrol while loading, green when complete, with the short share in amber at the end. */
export function LoadProgress({
  loaded,
  total,
  short = 0,
  height = 8,
  complete = false,
}: {
  loaded: number;
  total: number;
  short?: number;
  height?: 6 | 8;
  complete?: boolean;
}) {
  const share = total ? Math.min(100, (loaded / total) * 100) : 0;
  const shortShare = total ? Math.min(100 - share, (short / total) * 100) : 0;
  const done = complete || loaded + short >= total;
  return (
    <div
      role="progressbar"
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

const LONG_PRESS_MS = 550;

/** One case type for one stop. The whole row checks with one gloved tap; Flag is its own button, so a check is
 *  never read as a problem. Press and hold to count part of a line on. */
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
}) {
  const { t, lang } = useLoaderText();
  const press = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const flagged = line.status === "flag_waiting" || line.status === "decided";
  const damaged = line.shortfall?.kind === "damaged";
  const checked = line.status === "checked";
  const inProgress = line.status === "in_progress";

  const tone = flagged
    ? damaged
      ? "bg-problem-soft border border-problem"
      : "bg-attention-soft border border-attention"
    : checked
      ? "bg-done-soft border border-done"
      : "bg-white border border-asphalt-200";

  const SlotIcon = flagged
    ? line.status === "decided"
      ? PackageX
      : damaged
        ? TriangleAlert
        : Clock
    : checked
      ? SquareCheck
      : Square;
  const slotColor = flagged
    ? damaged
      ? "text-problem"
      : "text-attention"
    : checked
      ? "text-done"
      : "text-asphalt-700";

  const startPress = () => {
    held.current = false;
    if (flagged) return;
    press.current = window.setTimeout(() => {
      held.current = true;
      onCount();
    }, LONG_PRESS_MS);
  };
  const endPress = () => window.clearTimeout(press.current);

  const missing = line.qty - line.loaded;
  const statusLines: { text: string; className: string }[] = [];
  if (flagged && line.shortfall) {
    const s = line.shortfall;
    if (line.status === "flag_waiting") {
      statusLines.push({
        text: damaged
          ? t("load.damagedLine", { loaded: line.loaded, damaged: s.qty })
          : t("load.missingLine", { loaded: line.loaded, missing: s.qty }),
        className: cx("t-label-strong", damaged ? "text-problem" : "text-attention"),
      });
      statusLines.push({
        text: t("load.waitingFor", { name: calledName(dispatcher) }),
        className: cx("t-label", damaged ? "text-problem" : "text-attention"),
      });
    } else {
      statusLines.push({
        text: t("load.shortLine", { loaded: line.loaded, short: missing }),
        className: "t-label-strong text-attention",
      });
      statusLines.push({
        text:
          s.decision === "send_short" && s.added_to_day
            ? t("load.comeOn", { count: missing, day: weekdayIn(lang, s.added_to_day) })
            : t("load.notReplaced"),
        className: "t-label text-asphalt-700",
      });
    }
  }

  return (
    <div
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
          event.preventDefault();
          if (!flagged) onCount();
        }}
        className="flex min-w-0 flex-1 touch-manipulation items-center gap-2 py-2 pl-2 text-left select-none"
      >
        <span className="flex size-12 shrink-0 items-center justify-center">
          <SlotIcon size={large ? 32 : 28} strokeWidth={1.75} aria-hidden className={slotColor} />
        </span>
        <span className="flex w-9 shrink-0 flex-col items-end">
          <span className={cx("num text-asphalt-900", large ? "t-display" : "t-h1")}>
            {flagged ? line.loaded : line.qty}
          </span>
          {flagged ? <span className="num t-caption text-asphalt-700">{t("load.of", { n: line.qty })}</span> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cx("text-asphalt-900", large ? "text-[24px] leading-8 font-semibold" : "t-field")}>
            {t(`cases.${line.case_type}`, { defaultValue: line.case_type })}
          </span>
          <span className="flex items-center gap-1 t-label text-asphalt-700">
            {chilled ? (
              <Snowflake size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-chilled" />
            ) : (
              <Package size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            )}
            {t("load.lineStop", { n: stop, kind })}
          </span>
          {inProgress ? (
            <span className="num t-label-strong text-petrol-700">
              {t("load.onSoFar", { loaded: line.loaded, total: line.qty })}
            </span>
          ) : null}
          {checked ? (
            <span className="flex items-center gap-1 t-label text-done">
              <Check size={16} strokeWidth={1.75} aria-hidden />
              {t("load.loaded")}
            </span>
          ) : null}
          {statusLines.map((s) => (
            <span key={s.text} className={s.className}>
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
        className="min-w-[84px] shrink-0 px-2.5"
      >
        {flagged ? t("load.view") : t("load.flag")}
      </Button>
    </div>
  );
}

/** "How many are on?": for a line that goes on in several trips from the shelf. */
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
  }
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
            unit={t(`cases.${line.case_type}`, { defaultValue: line.case_type })}
            size="field"
          />
          <span className="num t-body text-asphalt-700">{t("load.of", { n: line.qty })}</span>
        </div>
      ) : null}
    </Sheet>
  );
}
