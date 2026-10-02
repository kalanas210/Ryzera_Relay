import { CircleCheck, Clock, CloudOff, RefreshCw, Truck, X } from "lucide-react";
import { Navigate } from "react-router";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { PhoneScreen } from "@/design/Phone";
import { StatusChip } from "@/design/StatusChip";
import { StopMarker } from "@/design/StopMarker";
import { awaitingAnswer, countOf, onRunDate, ownStops, sentAt, stopLocal } from "./local";
import { DriverHeader, Helper, markerState, PlaceName, SendChip } from "./parts";
import { QuestionCards, RunChanges, useOpenQuestion } from "./Question";
import { useDriver } from "./sync";
import type { DriverRun, DriverStop } from "./types";
import { useDriverText } from "./words";

/** DRV-05 Trip summary: every stop of the trip, what is still on the phone, and Finish trip, which works with no
 *  signal too (it joins the queue after the stops). DEG-02 happens here: when the signal comes back the stops send,
 *  and a stop that clashed with an office change asks its one question at the top. */
export function SummaryPage() {
  const { run, loaded, now, items, save, batch, reconnect } = useDriver();
  const { t, clock, around, hub, tripLine, list, cases, caseItem } = useDriverText();
  const questionOpen = useOpenQuestion(run);
  if (!loaded || !now || !run) return <PhoneScreen header={<DriverHeader back="/driver" />}>{null}</PhoneScreen>;
  const trip = run.trip;
  if (!trip) return <Navigate to="/driver" replace />;

  const h = hub(trip);
  const delivered = trip.stops.filter((s) => s.status === "delivered");
  const failed = trip.stops.filter((s) => s.status === "failed");
  const done = delivered.length + failed.length;
  // a stop the office gave to another vehicle is not this truck's to count
  const total = ownStops(trip).length;
  const last = delivered
    .map((s) => s.completed_at)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1);
  const seqOf = (ids: string[]) =>
    trip.stops
      .filter((s) => ids.includes(s.stop_id))
      .map((s) => s.seq)
      .sort((a, b) => a - b);
  const mine = items.filter((i) => (i.record?.trip_id ?? trip.trip_id) === trip.trip_id);
  const waiting = countOf(mine.filter((i) => i.queued));
  const finishedLocally = mine.some((i) => i.record?.kind === "trip_finished" && i.queued);

  // what is on the phone, what is going now, or what has gone
  const finished = trip.finished_at;
  let sync = null;
  const what = (seqs: number[], mid = false) =>
    t(mid ? "summary.stopsListMid" : "summary.stopsList", { count: seqs.length, list: list(seqs) });
  // the photo count two ways: "2 photos" in a list, and with its joining word where a language writes one on
  const photos = (n: number) => ({
    photos: t("summary.photos", { count: n }),
    photosWith: t("summary.photosWith", { count: n }),
  });
  // what reached the office after the phone had no signal: this phone's own reconnect, together with what Relay
  // says came in late for stops a demo jump recorded for the driver
  const late = trip.stops.filter((s) => s.sent_at);
  const back = reconnect && reconnect.trip_id === trip.trip_id ? reconnect : null;
  const sent =
    back || late.length
      ? {
          at: [back?.at, ...late.map((s) => s.sent_at)].filter((x): x is string => !!x).sort()[0] ?? "",
          stopIds: [...new Set([...(back?.stopIds ?? []), ...late.map((s) => s.stop_id)])],
          photos: Math.max(back?.photos ?? 0, late.filter((s) => s.has_photo).length),
        }
      : null;
  if (batch && batch.stops + batch.photos > 0) {
    const seqs = seqOf(batch.stopIds);
    sync = (
      <Notice tone="info" icon={RefreshCw} field title={t("summary.signalBack")}>
        {seqs.length
          ? batch.photos
            ? t("summary.sendingPhotos", { what: what(seqs, true), ...photos(batch.photos) })
            : t("summary.sending", { what: what(seqs, true) })
          : t("summary.sending", { what: photos(batch.photos).photos })}
      </Notice>
    );
  } else if (waiting.stops > 0) {
    const seqs = seqOf(waiting.stopIds);
    sync = (
      <Notice tone="waiting" field title={t("summary.onPhone", { count: waiting.stops })}>
        {waiting.photos
          ? t("summary.onPhoneBodyPhotos", { what: what(seqs), ...photos(waiting.photos) })
          : t("summary.onPhoneBody", { what: what(seqs), count: seqs.length })}
      </Notice>
    );
  } else if (sent && !waiting.photos && !finished) {
    const seqs = seqOf(sent.stopIds);
    sync = seqs.length ? (
      <Notice tone="done" field title={t("summary.everythingSent")}>
        {sent.photos
          ? t("summary.reachedPhotos", { what: what(seqs), time: clock(sent.at), ...photos(sent.photos) })
          : t("summary.reached", { what: what(seqs), time: clock(sent.at) })}
      </Notice>
    ) : null;
  }

  // every delivery against its window
  const inside = delivered.filter(
    (s) => s.completed_at && Date.parse(s.completed_at) <= onRunDate(run.run_date, s.window_close).getTime(),
  ).length;

  let bar = null;
  if (finished) {
    bar = (
      <Notice tone="done" field title={t("summary.finishedAt", { time: clock(finished) })}>
        {finishedLocally
          ? t("summary.finishedOffline")
          : trip.expected_back && Date.parse(trip.expected_back) > Date.parse(finished)
            ? t("summary.expectBack", { ...h, around: around(trip.expected_back) })
            : null}
      </Notice>
    );
  } else if (!questionOpen) {
    const helper =
      waiting.stops > 0 ? (
        <Helper icon={CloudOff}>{t("summary.stillToSend", { count: waiting.stops })}</Helper>
      ) : (
        <Helper icon={Truck}>
          {run.later.length
            ? t("summary.nextTrip", { ...h, n: run.later[0]?.trip_no })
            : t("summary.noSecondTrip", { ...h })}
        </Helper>
      );
    bar = (
      <>
        {helper}
        <Button
          variant="primary"
          density="field"
          full
          icon={CircleCheck}
          onClick={() => void save({ kind: "trip_finished", trip_id: trip.trip_id })}
        >
          {t("summary.finish")}
        </Button>
      </>
    );
  }

  return (
    <PhoneScreen
      header={
        <DriverHeader
          back="/driver"
          title={finished ? t("summary.finishedTitle", { n: trip.trip_no }) : t("summary.title")}
        />
      }
      bar={bar ?? undefined}
    >
      <QuestionCards run={run} trip={trip} />
      <div className="flex flex-col gap-1">
        <h2 className="t-h1 text-asphalt-900">
          {done >= total ? t("summary.all", { count: done }) : t("summary.some", { done, total })}
        </h2>
        <p className="t-body text-asphalt-700">{tripLine(trip)}</p>
        {last ? (
          <p className="t-label text-asphalt-500">
            {trip.departed_at
              ? t("summary.times", { ...h, left: clock(trip.departed_at), last: clock(last) })
              : t("summary.timesNoLeave", { last: clock(last) })}
          </p>
        ) : null}
        {failed.length ? (
          <p className="mt-1 flex items-center gap-1.5 t-body-strong text-problem">
            <X size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            {t("summary.notDelivered", { count: failed.length })}
          </p>
        ) : null}
      </div>
      {sync}
      <RunChanges run={run} trip={trip} />
      {delivered.length ? (
        <p className="flex items-start gap-2 t-body text-asphalt-900">
          {inside === delivered.length ? (
            <CircleCheck size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-done" />
          ) : (
            <Clock size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-attention" />
          )}
          {inside === delivered.length
            ? t("summary.windowsAll", { count: delivered.length })
            : t("summary.windowsSome", { inside, count: delivered.length })}
        </p>
      ) : null}
      <section className="mt-2 flex flex-col gap-2">
        <h2 className="t-h2 text-asphalt-900">{t("summary.stops")}</h2>
        <div className="overflow-hidden rounded-card border border-asphalt-200 bg-white">
          {trip.stops.map((stop, i) => (
            <div key={stop.stop_id}>
              {i > 0 ? <div aria-hidden className="ml-[60px] h-px bg-asphalt-200" /> : null}
              <SummaryRow run={run} stop={stop} casesOf={cases} itemOf={caseItem} />
            </div>
          ))}
        </div>
      </section>
    </PhoneScreen>
  );
}

/** Stop row / field / summary: no way in, just what happened and whether it has reached the office. */
function SummaryRow({
  run,
  stop,
  casesOf,
  itemOf,
}: {
  run: DriverRun;
  stop: DriverStop;
  casesOf: (n: number) => string;
  itemOf: (code: string) => string;
}) {
  const { t, clock } = useDriverText();
  const { items } = useDriver();
  const local = stopLocal(items, stop.stop_id);
  const question = awaitingAnswer(run, items, stop.stop_id);
  const extra: string[] = [];
  const short = stop.lines.filter((l) => l.short > 0);
  // what came off the truck, as the proof says when a line was changed at the store
  const proofLines = local.delivery?.record.payload.lines;
  const handed = Array.isArray(proofLines)
    ? (proofLines as { qty?: number }[]).reduce((n, l) => n + (Number(l.qty) || 0), 0)
    : stop.cases;
  if (stop.status === "delivered" && (short.length || handed < stop.cases)) {
    const notes = short.map((l) => t("saved.short", { count: l.short, item: itemOf(l.case_type) }));
    if (handed < stop.cases) notes.push(t("summary.notAllHanded", { count: stop.cases - handed }));
    extra.push(`${casesOf(handed)}. ${notes.join(" ")}`);
  }
  const went = sentAt(stop, local);
  if (went && !local.waiting) extra.push(t("summary.savedOffline", { time: clock(went) }));
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
      <StopMarker n={stop.seq} state={markerState(stop, null)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <PlaceName name={stop.place} className="t-field text-asphalt-900" />
        {stop.status === "delivered" && stop.completed_at ? (
          <span className="t-body-strong text-done">{t("row.delivered", { time: clock(stop.completed_at) })}</span>
        ) : stop.status === "failed" ? (
          <span className="t-body-strong text-problem">{t("row.failed")}</span>
        ) : stop.status === "moved" && stop.moved_to ? (
          <span className="t-body text-asphalt-700">{t("chip.movedTo", { vehicle: stop.moved_to })}</span>
        ) : stop.status === "cancelled" ? (
          <span className="t-body text-asphalt-700">{t("row.cancelled")}</span>
        ) : null}
        {extra.map((line) => (
          <span key={line} className="t-label text-asphalt-500">
            {line}
          </span>
        ))}
        {question || local.waiting ? (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {question ? <StatusChip kind="needsAnswer">{t("chip.needsAnswer")}</StatusChip> : null}
            <SendChip local={local} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
