/** DEG-02's one question, and what the run says about stops the office moved.
 *
 *  Relay asks only when a record from this phone clashed with a change the office made while the phone was silent:
 *  the stop was moved to a backup vehicle. The card sits at the top of the screen the driver is on, makes no sound
 *  and opens nothing; the answer is saved on the phone first, like any record. Once it is settled the card becomes a
 *  note saying how. */
import { Camera, Check, Clock, Info, PenLine, TriangleAlert, X } from "lucide-react";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { calledName } from "@/lib/names";
import { localAnswers, onRunDate, questionFor, stopLocal } from "./local";
import { PlaceName, SendChip } from "./parts";
import { useDriver } from "./sync";
import type { DriverNotice, DriverRun, DriverStop, DriverTrip, Question } from "./types";
import { useDriverText } from "./words";

/** The office's message about a stop it moved: "Stop 4 moved to VEH060 at 6:15 AM". */
export function movedNotice(run: DriverRun, stop: DriverStop): { vehicle: string; at: string } | null {
  const notice = (run.notices as DriverNotice[]).find(
    (n) => n.kind === "stop_moved" && n.data?.stop_id === stop.stop_id,
  );
  if (!notice) return null;
  const vehicle = typeof notice.data.vehicle_id === "string" ? notice.data.vehicle_id : stop.moved_to;
  return vehicle ? { vehicle, at: notice.created_at } : null;
}

/** Who moved the stop, to which vehicle and when: from the question when Relay asked one, else from the message. */
function moveOf(run: DriverRun, stop: DriverStop, question: Question | undefined) {
  const notice = movedNotice(run, stop);
  return {
    vehicle: question?.backup_vehicle ?? stop.moved_to ?? notice?.vehicle ?? "",
    driver: calledName(question?.backup_driver ?? null),
    at: question?.moved_at ?? notice?.at ?? null,
    by: calledName(question?.moved_by ?? null) || calledName(run.dispatcher) || "",
  };
}

/** Every open question, at the top of the run list or the trip summary. */
export function QuestionCards({ run, trip }: { run: DriverRun; trip: DriverTrip }) {
  const open = run.questions.filter((q) => q.status !== "resolved");
  if (!open.length) return null;
  return (
    <>
      {open.map((q) => {
        const stop = trip.stops.find((s) => s.stop_id === q.stop_id);
        return stop ? <QuestionCard key={q.id} run={run} trip={trip} stop={stop} question={q} /> : null;
      })}
    </>
  );
}

function QuestionCard({
  run,
  trip,
  stop,
  question,
}: {
  run: DriverRun;
  trip: DriverTrip;
  stop: DriverStop;
  question: Question;
}) {
  const { t, clock, cases, place } = useDriverText();
  const { items, save, now } = useDriver();
  const local = stopLocal(items, stop.stop_id);
  const answer = localAnswers(items).get(question.id);
  const said = answer?.answer ?? (question.answer === "no" ? "no" : null);
  const move = moveOf(run, stop, question);
  const vehicle = move.vehicle;
  // "Stop 4 was also given to Nimal": the backup's driver by name when Relay knows who, else the vehicle
  const who = move.driver || vehicle;
  const name = move.by;
  const where = place(stop.place).text;

  // the phone's own record of the stop, or Relay's copy of it when a demo jump recorded it for this driver
  const delivery = local.delivery?.record;
  const arrivedAt = local.arrival?.record.occurred_at ?? question.arrived_at;
  const deliveredAt = delivery?.occurred_at ?? question.delivered_at;
  const lines = Array.isArray(delivery?.payload.lines) ? (delivery?.payload.lines as { qty?: number }[]) : null;
  const count = lines ? lines.reduce((n, l) => n + (Number(l.qty) || 0), 0) : question.cases;
  const receiver = delivery
    ? typeof delivery.payload.receiver === "string"
      ? delivery.payload.receiver
      : null
    : question.receiver;
  const photo = local.photo ?? (!delivery && question.has_photo ? { queued: false } : null);
  const signed = delivery ? Boolean(delivery.payload.signature_svg) : question.signed;

  const closes = onRunDate(run.run_date, stop.window_close);
  const reply = (value: "yes" | "no") =>
    save({
      kind: "conflict_answer",
      trip_id: trip.trip_id,
      stop_id: stop.stop_id,
      payload: { conflict_id: question.id, answer: value },
    });

  return (
    <section
      aria-label={t("question.label", { n: stop.seq })}
      className="flex flex-col gap-3 rounded-card border-2 border-attention bg-white p-4"
    >
      <div className="flex items-start gap-2">
        <Clock size={24} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-attention" />
        <h2 className="t-h2 text-asphalt-900">
          {t(move.driver ? "question.titleDriver" : "question.title", { n: stop.seq, who })}
        </h2>
      </div>
      <p className="t-body text-asphalt-900">
        {move.at
          ? t(move.driver ? "question.bodyDriver" : "question.body", {
              name,
              n: stop.seq,
              vehicle,
              who,
              time: clock(move.at),
              place: where,
            })
          : t("question.bodyNoTime", { name, n: stop.seq, vehicle, place: where })}
      </p>
      <div className="flex flex-col gap-1 rounded-button bg-asphalt-50 p-3">
        <p className="t-label text-asphalt-500">{t("question.yours")}</p>
        <p className="t-h3 text-asphalt-900">
          <PlaceName name={stop.place} /> · <span className="latin">{stop.outlet_id}</span>
        </p>
        {deliveredAt ? (
          <p className="t-body text-asphalt-900">
            {arrivedAt
              ? t("question.times", { arrived: clock(arrivedAt), delivered: clock(deliveredAt) })
              : t("question.delivered", { time: clock(deliveredAt) })}
          </p>
        ) : null}
        {receiver ? (
          <p className="t-body text-asphalt-900">{t("question.goods", { cases: cases(count), name: receiver })}</p>
        ) : null}
        {photo || signed ? (
          <p className="flex items-center gap-1.5 t-label text-asphalt-700">
            {photo ? (
              <Camera size={16} strokeWidth={1.75} aria-hidden />
            ) : (
              <PenLine size={16} strokeWidth={1.75} aria-hidden />
            )}
            {photo
              ? photo.queued
                ? t("question.photoSending")
                : t("question.photoSaved")
              : t("question.signatureSaved")}
          </p>
        ) : null}
      </div>
      {said === "no" ? (
        <p className="flex items-start gap-2 t-body text-asphalt-900">
          <TriangleAlert size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-attention" />
          <span>
            {now && now < closes
              ? t("question.noReply", { name, place: where, time: clock(closes) })
              : t("question.noReplyClosed", { name })}
          </span>
        </p>
      ) : said === "yes" ? (
        <div className="flex flex-col items-start gap-2">
          <p className="t-body text-asphalt-900">{t("question.waiting")}</p>
          <SendChip local={{ waiting: Boolean(answer?.queued), sending: false }} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h3 className="t-h3 text-asphalt-900">{t("question.ask")}</h3>
            <p className="t-body text-asphalt-700">
              {t(move.driver ? "question.helperDriver" : "question.helper", { who })}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="primary" density="field" full icon={Check} onClick={() => void reply("yes")}>
              {t("question.yes")}
            </Button>
            <Button variant="secondary" density="field" full icon={X} onClick={() => void reply("no")}>
              {t("question.no")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

/** True while a question waits for this driver: the screen's action bar steps aside for it. */
export function useOpenQuestion(run: DriverRun | null): boolean {
  const { items } = useDriver();
  if (!run) return false;
  const answers = localAnswers(items);
  return run.questions.some((q) => q.status !== "resolved" && !answers.has(q.id) && q.answer !== "no");
}

/** Office changes to the run, said once each: a stop moved to a backup vehicle while the phone had signal, and a
 *  two-copy stop that is now settled. */
export function RunChanges({ run, trip }: { run: DriverRun; trip: DriverTrip }) {
  const { t, clock, place } = useDriverText();
  const { server, items } = useDriver();
  const answers = items.filter((i) => i.record?.kind === "conflict_answer" && i.outcome === "applied");
  const out = [];
  for (const stop of trip.stops) {
    const local = stopLocal(items, stop.stop_id);
    const settled = run.questions.find((q) => q.stop_id === stop.stop_id && q.status === "resolved");
    const move = moveOf(run, stop, settled);
    const name = move.by;
    const relay = server?.trip?.stops.find((s) => s.stop_id === stop.stop_id);
    if (settled || local.conflict) {
      // the stop had two copies; once nothing is open and Relay has it delivered, it is settled
      if (questionFor(run, stop.stop_id) || relay?.status !== "delivered") continue;
      const yes = answers.find((i) => i.record?.stop_id === stop.stop_id && i.record.payload.answer === "yes");
      const vehicle = move.vehicle;
      // the driver's yes cancelled the backup's visit; the office cancelling it first leaves no such time
      const at = settled ? (settled.resolution === "driver" ? settled.resolved_at : null) : (yes?.at ?? null);
      const body =
        !move.at || !vehicle
          ? t("summary.settledPlain", { place: place(stop.place).text })
          : at
            ? t("summary.settledYes", { name, n: stop.seq, vehicle, moved: clock(move.at), at: clock(at) })
            : t("summary.settledOffice", { name, n: stop.seq, vehicle, moved: clock(move.at) });
      out.push(
        <Notice key={stop.stop_id} tone="info" icon={Info} field title={t("summary.settledTitle", { n: stop.seq })}>
          {body}
        </Notice>,
      );
    } else if (stop.status === "moved" && stop.moved_to && !questionFor(run, stop.stop_id)) {
      out.push(
        <Notice
          key={stop.stop_id}
          tone="attention"
          field
          title={
            move.at
              ? t("run.movedTitle", { n: stop.seq, vehicle: stop.moved_to, time: clock(move.at) })
              : t("chip.movedTo", { vehicle: stop.moved_to })
          }
        >
          {t("run.movedBody", { name, place: place(stop.place).text, vehicle: stop.moved_to })}
        </Notice>,
      );
    }
  }
  return out.length ? out : null;
}
