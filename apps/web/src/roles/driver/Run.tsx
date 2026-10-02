import { useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, Info, PackageCheck, PackageX, Send, Truck, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/api/client";
import { useDemoState } from "@/app/session";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { PhoneScreen } from "@/design/Phone";
import { Sheet } from "@/design/Sheet";
import { StatusChip } from "@/design/StatusChip";
import { StopMarker } from "@/design/StopMarker";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { phone } from "@/offline/phone";
import { LanguageRow } from "./DriverShell";
import { useLocationOff } from "./device";
import { doneCount, nextStop, ownStops } from "./local";
import { DriverHeader, Helper, NextStopCard, PlaceName, SendChip, StepProgress, StopRow, TextField } from "./parts";
import { QuestionCards, RunChanges, useOpenQuestion } from "./Question";
import { RUN_KEY, useDriver } from "./sync";
import type { DriverRun, DriverStop, DriverTrip } from "./types";
import { useDriverText } from "./words";

const weight = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** DRV-01 Today's run: the handover to accept, then the next stop and every stop of the trip. Works from the run kept
 *  on the phone when there is no signal, with one notice saying so (DEG-01). */
export function RunPage() {
  const { run, loaded, now, offline } = useDriver();
  const { t } = useDriverText();
  useTopWhenAccepted(run?.trip?.load ?? null);
  const header = <DriverHeader root title={t("header.run")} />;
  if (!loaded || !now) return <PhoneScreen header={header}>{null}</PhoneScreen>;
  if (!run) {
    return (
      <PhoneScreen header={header}>
        <Notice tone={offline ? "waiting" : "info"} field>
          {t("run.noSnapshot")}
        </Notice>
      </PhoneScreen>
    );
  }
  const trip = run.trip;
  if (!trip) {
    return (
      <PhoneScreen header={header}>
        <OfflineNotice />
        {run.published || !run.vehicle_id ? (
          <Notice tone="info" field>
            {t("run.noRun")}
          </Notice>
        ) : (
          <NotPublished run={run} />
        )}
        <LanguageRow />
      </PhoneScreen>
    );
  }
  if (trip.load === "to_accept") return <AcceptLoad run={run} trip={trip} />;
  return <Run run={run} trip={trip} now={now} />;
}

/** The hub's plan for the run is still a draft: which day, and who publishes it. In the demo, how to get there. */
function NotPublished({ run }: { run: DriverRun }) {
  const { t, weekday } = useDriverText();
  const demo = useDemoState().data;
  const name = calledName(run.dispatcher);
  return (
    <Notice tone="info" field title={t("run.notPublishedTitle", { day: weekday(run.run_date) })}>
      <p>{name ? t("run.notPublished", { name }) : t("run.notPublishedNoName")}</p>
      {demo?.demo_mode && demo.next ? (
        <p className="mt-1 t-label text-asphalt-700">
          {name ? t("run.demoPublish", { name }) : t("run.demoPublishNoName")}
        </p>
      ) : null}
    </Notice>
  );
}

/** Once the load is accepted the run takes the screen's place: it starts at the top, with the next stop in view. */
function useTopWhenAccepted(load: DriverTrip["load"] | null) {
  const before = useRef(load);
  useEffect(() => {
    if (before.current === "to_accept" && load === "accepted") window.scrollTo({ top: 0 });
    before.current = load;
  }, [load]);
}

/** DEG-01: the run list only, never a task screen. No button, no red. */
function OfflineNotice() {
  const { offline, offlineSince } = useDriver();
  const { t, clock } = useDriverText();
  if (!offline) return null;
  return (
    <Notice
      tone="waiting"
      field
      title={offlineSince ? t("run.noSignalSince", { time: clock(offlineSince) }) : t("run.noSignal")}
    >
      {t("run.offlineBody")}
    </Notice>
  );
}

/** Trip strip: the date, the trip, how far along it is, and when the load was accepted and the truck left. */
function TripStrip({ run, trip, next }: { run: DriverRun; trip: DriverTrip; next: DriverStop | null }) {
  const { t, clock, date, tripLine, hub } = useDriverText();
  const h = hub(trip);
  const accepted = trip.load === "accepted" && trip.handover.accepted_at;
  const leave = trip.departed_at
    ? t("trip.left", { ...h, time: clock(trip.departed_at) })
    : accepted
      ? t("trip.plannedLeaveShort", { time: clock(trip.planned_depart) })
      : t("trip.plannedLeave", { ...h, time: clock(trip.planned_depart) });
  return (
    <div className="flex flex-col gap-2">
      <p className="t-body text-asphalt-700">{date(run.run_date)}</p>
      <h2 className="t-h3 text-asphalt-900">{tripLine(trip)}</h2>
      <div className="flex flex-col gap-1.5">
        <p className="t-label text-asphalt-700">
          {t("trip.progress", { done: doneCount(trip), total: ownStops(trip).length })}
        </p>
        <StepProgress trip={trip} next={next} />
      </div>
      <p className="t-label text-asphalt-500">
        {accepted && trip.handover.accepted_at ? (
          <>{t("trip.accepted", { time: clock(trip.handover.accepted_at) })} · </>
        ) : null}
        {/* a line of its own when it does not fit after the load, wrapped inside when wider than the screen (Tamil) */}
        <span className="inline-block max-w-full">{leave}</span>
      </p>
    </div>
  );
}

function Run({ run, trip, now }: { run: DriverRun; trip: DriverTrip; now: Date }) {
  const { t, clock } = useDriverText();
  const { items, save } = useDriver();
  const navigate = useNavigate();
  const questionOpen = useOpenQuestion(run);
  const next = nextStop(trip, items);
  const accepted = trip.load === "accepted";
  const loading = trip.load === "not_started" || trip.load === "loading";
  const leaving = accepted && !trip.departed_at && !trip.finished_at;
  const loaderName = calledName(trip.loader);

  return (
    <PhoneScreen
      header={<DriverHeader root title={t("header.run")} />}
      bar={
        leaving && !questionOpen ? (
          <>
            <Helper icon={Info}>{t("run.leaveHelper")}</Helper>
            <Button
              variant="primary"
              density="field"
              full
              icon={Truck}
              onClick={() => void save({ kind: "departed", trip_id: trip.trip_id })}
            >
              {t("run.leave")}
            </Button>
          </>
        ) : undefined
      }
    >
      <QuestionCards run={run} trip={trip} />
      <TripStrip run={run} trip={trip} next={loading ? null : next} />
      <OfflineNotice />
      <ReadNotices run={run} />
      <LocationNotice />
      <Rejected run={run} trip={trip} />
      <RunChanges run={run} trip={trip} />
      {trip.load === "not_started" ? (
        <Notice tone="info" field title={t("run.notStartedTitle", { vehicle: trip.vehicle_id })}>
          {t("run.loadingBody")}
        </Notice>
      ) : trip.load === "loading" ? (
        <Notice
          tone="info"
          field
          title={
            loaderName
              ? t("run.loadingTitle", { name: loaderName, vehicle: trip.vehicle_id })
              : t("run.loadingTitleNoName", { vehicle: trip.vehicle_id })
          }
        >
          {t("run.loadingBody")}
        </Notice>
      ) : next ? (
        <NextStopCard run={run} trip={trip} stop={next} now={now} primary={!leaving && !questionOpen} />
      ) : trip.finished_at ? (
        <Notice tone="done" field title={t("run.finished", { n: trip.trip_no, time: clock(trip.finished_at) })}>
          <Button density="field" full className="mt-2" onClick={() => navigate("/driver/summary")}>
            {t("run.openSummary")}
          </Button>
        </Notice>
      ) : (
        <section className="flex flex-col gap-3 rounded-card border border-asphalt-300 bg-white p-5">
          <h2 className="t-h2 text-asphalt-900">{t("run.allDone", { count: doneCount(trip) })}</h2>
          <Button
            variant={questionOpen ? "secondary" : "primary"}
            density="field"
            full
            onClick={() => navigate("/driver/summary")}
          >
            {t("run.openSummary")}
          </Button>
        </section>
      )}
      <section className="mt-2 flex flex-col gap-2">
        <h2 className="t-h2 text-asphalt-900">{t("run.allStops")}</h2>
        <div className="overflow-hidden rounded-card border border-asphalt-200 bg-white">
          {trip.stops.map((stop, i) => (
            <div key={stop.stop_id}>
              {i > 0 ? <div aria-hidden className="ml-[60px] h-px bg-asphalt-200" /> : null}
              <StopRow run={run} stop={stop} next={loading ? null : next} />
            </div>
          ))}
        </div>
      </section>
      <LanguageRow />
    </PhoneScreen>
  );
}

/** Messages the office sent this driver are marked read once they are on the screen. */
function ReadNotices({ run }: { run: DriverRun }) {
  const { offline } = useDriver();
  const client = useQueryClient();
  const unread = run.notices.filter((n) => n.kind === "stop_moved" && !n.read_at).map((n) => n.id);
  const key = unread.join(",");
  useEffect(() => {
    if (offline || !key) return;
    for (const id of key.split(",")) {
      void api
        .post(`/api/driver/notices/${id}/read`, {}, { role: "driver" })
        .then(() =>
          client.setQueryData<DriverRun>(RUN_KEY, (cur) =>
            cur ? { ...cur, notices: cur.notices.map((n) => (n.id === id ? { ...n, read_at: cur.now } : n)) } : cur,
          ),
        )
        .catch(() => {
          // read again on the next visit
        });
    }
  }, [key, offline, client]);
  return null;
}

/** Location off: said once on this phone, so the driver knows a stop without a location still counts. */
function LocationNotice() {
  const off = useLocationOff();
  const { t } = useDriverText();
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    void phone.get<boolean>("locationNoticeSeen").then((kept) => setSeen(Boolean(kept?.value)));
  }, []);
  const show = off && seen === false;
  useEffect(() => {
    if (show) void phone.put("locationNoticeSeen", true);
  }, [show]);
  if (!show) return null;
  return (
    <Notice tone="info" field>
      {t("run.locationOff")}
    </Notice>
  );
}

/** A record Relay would not take never vanishes: the driver is told, with Relay's reason. */
function Rejected({ run, trip }: { run: DriverRun; trip: DriverTrip }) {
  const { items } = useDriver();
  const { t } = useDriverText();
  // only this trip's: a record names its trip, a photo its stop or the report it belongs to
  const mine = (i: (typeof items)[number]) =>
    i.record
      ? i.record.trip_id === trip.trip_id
      : trip.stops.some((s) => s.stop_id === i.photo?.stop_id) ||
        items.some((r) => r.record?.id === i.photo?.event_id && r.record?.trip_id === trip.trip_id);
  const refused = items.filter((i) => i.outcome === "rejected" && mine(i));
  if (!refused.length) return null;
  const reasons = [...new Set(refused.map((i) => i.reason).filter(Boolean))];
  return (
    <Notice tone="problem" field title={t("run.rejected", { count: refused.length })}>
      <p>{t("run.rejectedBody", { name: calledName(run.dispatcher) })}</p>
      {reasons.map((reason) => (
        <p key={reason} lang="en" className="t-label text-asphalt-700">
          {reason}
        </p>
      ))}
    </Notice>
  );
}

/** DRV-01 / Accept load: the handover reached the phone. The same numbers as the loader's LDR-04, then Accept load,
 *  or tell the loader what does not match. */
function AcceptLoad({ run, trip }: { run: DriverRun; trip: DriverTrip }) {
  const { t, clock, weekday, caseItem } = useDriverText();
  const { save, items } = useDriver();
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const h = trip.handover;
  const loader = h.completed_by ?? trip.loader ?? "";
  const loaderName = calledName(loader);
  const difference = items.filter((i) => i.record?.kind === "load_difference" && i.record.trip_id === trip.trip_id);
  const differenceWaiting = difference.some((i) => i.queued);
  const differenceSending = difference.some((i) => i.queued && (i.inFlight || i.held));

  return (
    <PhoneScreen
      header={<DriverHeader root title={t("header.run")} />}
      bar={
        <>
          <Button
            variant="primary"
            density="field"
            full
            icon={PackageCheck}
            onClick={() => void save({ kind: "load_accepted", trip_id: trip.trip_id })}
          >
            {t("accept.accept")}
          </Button>
          <Button variant="quiet" density="field" full icon={CircleAlert} onClick={() => setMismatchOpen(true)}>
            {t("accept.mismatch")}
          </Button>
        </>
      }
    >
      <TripStrip run={run} trip={trip} next={trip.stops[0] ?? null} />
      <OfflineNotice />
      {trip.shortfalls.map((s) => (
        <Notice
          key={`${s.stop_seq}-${s.case_type}`}
          tone="attention"
          icon={PackageX}
          field
          title={t("accept.shortTitle", { n: s.stop_seq, count: s.qty, item: caseItem(s.case_type) })}
        >
          {s.decided_at
            ? s.decision === "send_short" && s.added_day
              ? t("accept.decidedAdd", {
                  name: s.decided_by ?? "",
                  time: clock(s.decided_at),
                  day: weekday(s.added_day),
                })
              : t("accept.decidedNone", { name: s.decided_by ?? "", time: clock(s.decided_at) })
            : null}
        </Notice>
      ))}
      {h.difference ? (
        <Notice tone="info" icon={Send} field title={t("accept.told", { name: loaderName })}>
          <p>{h.difference}</p>
          {differenceWaiting ? (
            <div className="mt-2">
              <SendChip local={{ waiting: true, sending: differenceSending }} />
            </div>
          ) : null}
        </Notice>
      ) : null}

      <section className="mt-2 flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="t-h2 text-asphalt-900">{t("accept.plannedLoaded")}</h2>
          <p className="t-caption text-asphalt-500">{t("accept.inStopOrder")}</p>
        </div>
        <HandoverTable trip={trip} />
      </section>
      {h.completed_at ? (
        <div className="flex items-start gap-2">
          <User size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-asphalt-700" />
          <div className="flex flex-col t-label text-asphalt-700">
            <span>{t("accept.loadedBy", { name: loader })}</span>
            <span>{t("accept.markedComplete", { time: clock(h.completed_at) })}</span>
          </div>
        </div>
      ) : null}
      <LanguageRow />
      <MismatchSheet
        open={mismatchOpen}
        onClose={() => setMismatchOpen(false)}
        loader={loaderName}
        onSend={(note) => save({ kind: "load_difference", trip_id: trip.trip_id, payload: { note } })}
      />
    </PhoneScreen>
  );
}

/** Handover table, the driver's side: planned and loaded per stop in unloading order, a short stop marked on its row. */
function HandoverTable({ trip }: { trip: DriverTrip }) {
  const { t } = useDriverText();
  const h = trip.handover;
  return (
    <div className="overflow-hidden rounded-card border border-asphalt-200 bg-white">
      <div className="grid h-10 grid-cols-[minmax(0,1fr)_72px_72px] items-center bg-asphalt-50 px-4 t-caption text-asphalt-500">
        <span>{t("accept.stop")}</span>
        <span className="text-right">{t("accept.planned")}</span>
        <span className="text-right">{t("accept.loaded")}</span>
      </div>
      {h.stops.map((s) => {
        const short = s.planned - s.loaded;
        return (
          <div
            key={s.seq}
            className={cx(
              "grid min-h-16 grid-cols-[minmax(0,1fr)_72px_72px] items-center border-t border-asphalt-200 px-4 py-2",
              short > 0 && "bg-attention-soft",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <StopMarker n={s.seq} state={short > 0 ? "short" : "pending"} />
              <span className="flex min-w-0 flex-col items-start gap-1">
                <PlaceName name={s.place} className="t-body-strong text-asphalt-900 [overflow-wrap:anywhere]" />
                {short > 0 ? (
                  <StatusChip kind="short" className="bg-white">
                    {t("chip.short", { count: short })}
                  </StatusChip>
                ) : null}
              </span>
            </span>
            <span className="num text-right t-body text-asphalt-900">{s.planned}</span>
            <span className="flex items-center justify-end gap-1">
              <span className="num t-body text-asphalt-900">{s.loaded}</span>
              <span className="inline-flex w-5 justify-center">
                {short <= 0 ? <Check size={20} strokeWidth={1.75} aria-hidden className="text-done" /> : null}
              </span>
            </span>
          </div>
        );
      })}
      <div className="flex flex-col gap-1 border-t border-asphalt-200 bg-asphalt-50 px-4 pt-3 pb-3">
        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center t-h3 text-asphalt-900">
          <span>{t("accept.total")}</span>
          <span className="num text-right">{h.planned_cases}</span>
          <span className="flex justify-end gap-1">
            <span className="num">{h.loaded_cases}</span>
            <span className="w-5" />
          </span>
        </div>
        <p className="num t-caption text-asphalt-700">
          {t("accept.weight", { loaded: weight.format(h.loaded_kg), planned: weight.format(h.planned_kg) })}
        </p>
      </div>
    </div>
  );
}

/** "Something doesn't match": a note to the loader, saved on the phone first. Accept load stays where it was. */
function MismatchSheet({
  open,
  onClose,
  loader,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  loader: string;
  onSend: (note: string) => Promise<unknown>;
}) {
  const { t } = useDriverText();
  const [note, setNote] = useState("");
  const ready = note.trim().length > 0;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("accept.mismatch")}
      closeLabel={t("header.close")}
      footer={
        <Button
          variant="primary"
          density="field"
          full
          icon={Send}
          disabled={!ready}
          reason={t("accept.writeFirst")}
          onClick={() => {
            void onSend(note.trim()).then(() => {
              setNote("");
              onClose();
            });
          }}
        >
          {t("accept.send", { name: loader })}
        </Button>
      }
    >
      <TextField label={t("accept.mismatchLabel")} value={note} onChange={setNote} multiline />
    </Sheet>
  );
}
