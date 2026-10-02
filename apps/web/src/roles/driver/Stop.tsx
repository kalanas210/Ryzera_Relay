import { Box, CircleCheck, MapPin, PackageCheck, TriangleAlert, X } from "lucide-react";
import { useId } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { PhoneScreen } from "@/design/Phone";
import { StatusChip } from "@/design/StatusChip";
import { StopMarker } from "@/design/StopMarker";
import { calledName } from "@/lib/names";
import { minutesBetween, nextStop, onRunDate, type StopLocal, stopLocal, windowState } from "./local";
import {
  accessIcon,
  DriverHeader,
  GoodsChip,
  markerState,
  PlaceName,
  SectionTitle,
  SendChip,
  WindowLine,
} from "./parts";
import { movedNotice } from "./Question";
import { useDriver } from "./sync";
import type { DriverRun, DriverStop, DriverTrip } from "./types";
import { useDriverText } from "./words";

/** The trip a stop belongs to: today's current trip, or a later one. */
export function findStop(run: DriverRun | null, stopId: string): { trip: DriverTrip; stop: DriverStop } | null {
  for (const trip of [run?.trip, ...(run?.later ?? [])]) {
    const stop = trip?.stops.find((s) => s.stop_id === stopId);
    if (trip && stop) return { trip, stop };
  }
  return null;
}

/** DRV-02 Stop: at the outlet. The window, the way in and what comes off the truck, then Arrived (the time saves at
 *  once, the location follows in the background) and Record delivery. */
export function StopPage() {
  const { stopId = "" } = useParams();
  const { run, now, loaded, items, save } = useDriver();
  const { t, clock } = useDriverText();
  const navigate = useNavigate();
  const hintId = useId();
  const found = findStop(run, stopId);
  if (!loaded || !now || !run) return <PhoneScreen header={<DriverHeader back="/driver" />}>{null}</PhoneScreen>;
  if (!found) return <Navigate to="/driver" replace />;
  const { trip, stop } = found;
  const local = stopLocal(items, stop.stop_id);
  const next = nextStop(trip, items);
  const toCome = stop.status === "pending" || stop.status === "arrived";
  const w = windowState(run.run_date, stop.window_open, stop.window_close, now);

  const arrive = async () => {
    // a first arrival with no "Leave the hub" tapped: Relay takes the planned departure as when the truck left
    await save(
      { kind: "arrived", trip_id: trip.trip_id, stop_id: stop.stop_id, base_version: stop.version },
      { locate: true },
    );
  };
  const report = () => navigate(`/driver/report?stop=${stop.stop_id}`);

  let bar = null;
  if (stop.status === "pending" && trip.load === "accepted") {
    bar = (
      <>
        <span id={hintId} className="sr-only">
          {t("stop.arrivedHint")}
        </span>
        <Button
          variant="primary"
          density="field"
          full
          icon={MapPin}
          aria-describedby={hintId}
          onClick={() => void arrive()}
        >
          {t("stop.arrived")}
        </Button>
        <Button variant="quiet" density="field" full icon={TriangleAlert} onClick={report}>
          {t("card.report")}
        </Button>
      </>
    );
  } else if (stop.status === "arrived") {
    bar = (
      <>
        <Button
          variant="primary"
          density="field"
          full
          icon={PackageCheck}
          disabled={w.state === "soon"}
          reason={t("stop.recordFrom", { time: clock(onRunDate(run.run_date, stop.window_open)) })}
          onClick={() => navigate(`/driver/stops/${stop.stop_id}/proof`)}
        >
          {t("stop.record")}
        </Button>
        <Button variant="quiet" density="field" full icon={TriangleAlert} onClick={report}>
          {t("card.report")}
        </Button>
      </>
    );
  }

  return (
    <PhoneScreen
      header={
        <DriverHeader
          back="/driver"
          backLabel={t("header.back")}
          title={t("stop.title", { n: stop.seq, total: trip.stops.length })}
        />
      }
      bar={bar ?? undefined}
    >
      <OutletBlock stop={stop} next={next} />
      <StopState run={run} stop={stop} local={local} />
      <WindowPanel run={run} stop={stop} now={now} toCome={toCome} />
      <DropOff trip={trip} stop={stop} />
    </PhoneScreen>
  );
}

/** The outlet block: marker, place, store and, before Arrived, both named times. */
function OutletBlock({ stop, next }: { stop: DriverStop; next: DriverStop | null }) {
  const { t, storeName, clock, around } = useDriverText();
  const state = stop.status === "arrived" ? "next" : markerState(stop, next);
  return (
    <div className="flex items-start gap-3">
      <StopMarker n={stop.seq} state={state} size={40} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="t-display text-asphalt-900">
          <PlaceName name={stop.place} />
        </h2>
        <p className="t-body text-asphalt-700">
          {storeName(stop)} · <span className="latin">{stop.outlet_id}</span>
        </p>
        {stop.status === "pending" ? (
          <p className="t-label text-asphalt-500">
            {t("stop.times", {
              planned: clock(stop.planned),
              expected: stop.expected ? around(stop.expected) : clock(stop.planned),
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** What has happened at the stop: the arrival strip (in neutral words: the green is for the saved arrival, not the
 *  comparison), the delivery, or the office's change. */
function StopState({ run, stop, local }: { run: DriverRun; stop: DriverStop; local: StopLocal }) {
  const { t, clock, around, duration, place } = useDriverText();
  if (stop.status === "moved" && stop.moved_to) {
    const moved = movedNotice(run, stop);
    return (
      <Notice
        tone="attention"
        field
        title={
          moved
            ? t("run.movedTitle", { n: stop.seq, vehicle: stop.moved_to, time: clock(moved.at) })
            : t("chip.movedTo", { vehicle: stop.moved_to })
        }
      >
        {t("stop.movedBody", { place: place(stop.place).text, vehicle: stop.moved_to })}
      </Notice>
    );
  }
  if (stop.status === "cancelled") {
    return (
      <Notice tone="info" field title={t("stop.cancelledTitle", { n: stop.seq })}>
        {t("stop.cancelledBody")}
      </Notice>
    );
  }
  if (stop.status === "failed") {
    return <Notice tone="problem" icon={X} field title={t("stop.failedTitle")} />;
  }
  if (stop.status === "delivered" && stop.completed_at) {
    return (
      <Strip
        title={t("stop.deliveredTitle", { time: clock(stop.completed_at) })}
        lines={stop.receiver ? [t("stop.receivedBy", { name: stop.receiver })] : []}
        local={local}
      />
    );
  }
  if (stop.status === "arrived" && stop.arrived_at) {
    const late = minutesBetween(stop.planned, stop.arrived_at);
    const time = clock(stop.arrived_at);
    const title =
      late > 0
        ? t("stop.behind", { time, d: duration(late) })
        : late < 0
          ? t("stop.ahead", { time, d: duration(-late) })
          : t("stop.onPlan", { time });
    const fix = local.arrival;
    const where = !fix
      ? null
      : fix.held
        ? t("stop.locationFinding")
        : fix.record.lat != null
          ? t("stop.locationSaved")
          : t("stop.locationNotFound");
    return (
      <Strip
        title={title}
        lines={stop.expected ? [t("stop.expected", { time: around(stop.expected) })] : []}
        note={where}
        local={local}
      />
    );
  }
  return null;
}

/** Notice / done as the arrival strip: title, the expected time, the location line, and the waiting mark. */
function Strip({
  title,
  lines,
  note,
  local,
}: {
  title: string;
  lines: string[];
  note?: string | null;
  local: StopLocal;
}) {
  return (
    <section role="status" className="flex items-start gap-3 rounded-card bg-done-soft px-4 py-3">
      <CircleCheck size={24} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-done" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="t-h3 text-asphalt-900">{title}</p>
        {lines.map((line) => (
          <p key={line} className="t-body text-asphalt-900">
            {line}
          </p>
        ))}
        {note ? <p className="t-label text-asphalt-700">{note}</p> : null}
        {local.waiting ? (
          <div className="mt-2">
            <SendChip local={local} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Window panel: the receiving window, how it stands now, and where to unload. */
function WindowPanel({ run, stop, now, toCome }: { run: DriverRun; stop: DriverStop; now: Date; toCome: boolean }) {
  const { t, windowOf, access } = useDriverText();
  const Access = accessIcon(stop);
  const closed = windowState(run.run_date, stop.window_open, stop.window_close, now).state === "closed";
  return (
    <section className="flex flex-col gap-1 rounded-card border border-asphalt-200 bg-white px-4 pt-4 pb-1">
      <p className="t-label text-asphalt-500">{t("window.receiving")}</p>
      <p className="num t-h1 text-asphalt-900">{windowOf(run.run_date, stop.window_open, stop.window_close)}</p>
      {toCome ? <WindowLine stop={stop} runDate={run.run_date} now={now} short /> : null}
      {toCome && closed ? (
        <p className="t-body text-asphalt-700">{t("window.late", { name: calledName(run.dispatcher) })}</p>
      ) : null}
      <div className="mt-2 flex min-h-14 items-center gap-3 border-t border-asphalt-200">
        <Access size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-700" />
        <span className="flex-1 t-body text-asphalt-700">{t("card.unloadAt")}</span>
        <span className="t-field text-asphalt-900">{access(stop)}</span>
      </div>
    </section>
  );
}

/** Drop off: the order and each line as it came off the truck, with a short line explained under it. */
function DropOff({ trip, stop }: { trip: DriverTrip; stop: DriverStop }) {
  const { t, cases, caseLine, weekday } = useDriverText();
  return (
    <section className="mt-1 flex flex-col gap-2">
      <SectionTitle right={<GoodsChip temp={trip.temp} />}>{t("stop.dropOff")}</SectionTitle>
      <p className="num t-body text-asphalt-700">
        {t("stop.order", { order: stop.order_ref, cases: cases(stop.cases) })}
      </p>
      <div className="rounded-card border border-asphalt-200 bg-white px-4">
        {stop.lines.map((line, i) => (
          <div key={line.case_type} className={i > 0 ? "border-t border-asphalt-200" : undefined}>
            <div className="flex min-h-14 items-center gap-3">
              <Box size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-700" />
              <span className="min-w-0 flex-1 t-field text-asphalt-900">{caseLine(line.case_type, line.name)}</span>
              <span className="num t-h1 text-asphalt-900">{line.loaded}</span>
            </div>
            {line.short > 0 ? (
              <div className="flex flex-col items-start gap-1 pb-3 pl-9">
                <StatusChip kind="short">{t("chip.shortTold", { count: line.short })}</StatusChip>
                <p className="t-label text-asphalt-700">
                  {line.short_until
                    ? t("stop.shortWhy", { ordered: line.ordered, short: line.short, day: weekday(line.short_until) })
                    : t("stop.shortNone", { ordered: line.ordered, short: line.short })}
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
