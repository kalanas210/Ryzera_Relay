import {
  ChevronRight,
  Clock,
  Info,
  Lock,
  type LucideIcon,
  PackageX,
  Phone,
  Route,
  Send,
  Store,
  Truck,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { PhoneScreen } from "@/design/Phone";
import { calledName } from "@/lib/names";
import { PHOTO_TYPES, shrinkPhoto } from "@/lib/photo";
import { newRecordId } from "@/offline/outbox";
import { photoSize } from "./device";
import { minuteIso } from "./local";
import {
  ChoiceChip,
  ConfirmPanel,
  DriverHeader,
  FieldStepper,
  Helper,
  PhotoTile,
  SectionTitle,
  TextField,
} from "./parts";
import { findStop } from "./Stop";
import { useDriver } from "./sync";
import type { DriverRun, DriverStop, DriverTrip, ProblemReason } from "./types";
import { useDriverText } from "./words";

const REASONS: { value: ProblemReason; icon: LucideIcon; title: string; help: string }[] = [
  { value: "delayed", icon: Clock, title: "report.delayed", help: "report.delayedHelp" },
  { value: "outlet_closed", icon: Lock, title: "report.closed", help: "report.closedHelp" },
  { value: "access_blocked", icon: Route, title: "report.blocked", help: "report.blockedHelp" },
  { value: "goods_refused", icon: Store, title: "report.refused", help: "report.refusedHelp" },
  { value: "damaged_in_transit", icon: PackageX, title: "report.damaged", help: "report.damagedHelp" },
  { value: "vehicle_problem", icon: Truck, title: "report.vehicle", help: "report.vehicleHelp" },
];

const DELAYS = [10, 20, 30] as const;

type Photo = { id: string; blob: Blob; taken_at: string; width: number; height: number };

/** DRV-04 Report a problem: six reasons, then what the dispatcher needs for the one picked. Every report is stamped
 *  with the time and a location reading and saved on the phone first, like the stops. */
export function ReportPage() {
  const { reason } = useParams();
  const [params] = useSearchParams();
  const { run, loaded, now } = useDriver();
  const navigate = useNavigate();
  const stopId = params.get("stop");
  if (!loaded || !now || !run)
    return <PhoneScreen header={<DriverHeader close={() => navigate("/driver")} />}>{null}</PhoneScreen>;
  const found = stopId ? findStop(run, stopId) : null;
  const trip = found?.trip ?? run.trip;
  if (!trip) return <Navigate to="/driver" replace />;
  const stop = found?.stop ?? null;
  const picked = REASONS.find((r) => r.value === reason);
  return picked ? (
    <ReasonForm key={picked.value} run={run} trip={trip} stop={stop} reason={picked} now={now} />
  ) : (
    <ReasonList run={run} trip={trip} stop={stop} />
  );
}

function useAbout(trip: DriverTrip, stop: DriverStop | null) {
  const { t, place } = useDriverText();
  return {
    full: stop
      ? t("report.about", { n: stop.seq, place: place(stop.place).text, vehicle: trip.vehicle_id })
      : t("report.aboutTrip", { vehicle: trip.vehicle_id }),
    short: stop
      ? t("report.aboutShort", { n: stop.seq, place: place(stop.place).text })
      : t("report.aboutTrip", { vehicle: trip.vehicle_id }),
  };
}

function ReasonList({ run, trip, stop }: { run: DriverRun; trip: DriverTrip; stop: DriverStop | null }) {
  const { t } = useDriverText();
  const navigate = useNavigate();
  const about = useAbout(trip, stop);
  const name = calledName(run.dispatcher);
  const query = stop ? `?stop=${stop.stop_id}` : "";
  // back to the screen it came from; a report opened on its own goes back to the run
  const close = () => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate("/driver"));
  return (
    <PhoneScreen header={<DriverHeader close={close} />}>
      <div className="flex flex-col gap-1">
        <p className="t-label text-asphalt-500">{about.full}</p>
        <h2 className="t-h1 text-asphalt-900">{t("report.question")}</h2>
      </div>
      <nav className="flex flex-col gap-2">
        {REASONS.map((r) => (
          <Link
            key={r.value}
            to={`/driver/report/${r.value}${query}`}
            className="flex min-h-[68px] items-center gap-3 rounded-card border border-asphalt-200 bg-white px-4 py-3 active:bg-asphalt-100"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-button bg-asphalt-100">
              <r.icon size={24} strokeWidth={1.75} aria-hidden className="text-asphalt-900" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="t-field text-asphalt-900">{t(r.title)}</span>
              <span className="t-label text-asphalt-700">{t(r.help, { name })}</span>
            </span>
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-500" />
          </Link>
        ))}
      </nav>
      {name ? (
        <div className="mt-4 flex flex-col gap-1 border-t border-asphalt-200 pt-4">
          <p className="flex items-start gap-2 t-body text-asphalt-700">
            <Phone size={16} strokeWidth={1.75} aria-hidden className="mt-1 shrink-0" />
            {t("report.emergency", { name })}
          </p>
          <p className="t-label text-asphalt-500">{t("report.emergencyHelp")}</p>
        </div>
      ) : null}
    </PhoneScreen>
  );
}

function ReasonForm({
  run,
  trip,
  stop,
  reason,
  now,
}: {
  run: DriverRun;
  trip: DriverTrip;
  stop: DriverStop | null;
  reason: (typeof REASONS)[number];
  now: Date;
}) {
  const { t, caseShort, caseItem } = useDriverText();
  const { save, savePhoto } = useDriver();
  const about = useAbout(trip, stop);
  const name = calledName(run.dispatcher);
  const [delay, setDelay] = useState<number | "more" | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [canMove, setCanMove] = useState<"yes" | "no" | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [note, setNote] = useState("");
  const [sentId, setSentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const camera = useRef<HTMLInputElement>(null);

  if (sentId) return <ReportSent id={sentId} />;

  const r = reason.value;
  const withLines = (r === "goods_refused" || r === "damaged_in_transit") && stop;
  const withPhoto =
    r === "outlet_closed" || r === "access_blocked" || r === "goods_refused" || r === "damaged_in_transit";
  const photoNeeded = r === "damaged_in_transit";
  const picked = Object.values(counts).some((n) => n > 0);
  const missing =
    r === "delayed" && delay === null
      ? t("report.pickHowMuch")
      : withLines && !picked
        ? t("report.pickCases")
        : photoNeeded && !photo
          ? t("report.needPhoto")
          : r === "vehicle_problem" && !canMove
            ? t("report.pickOne")
            : null;

  const takePhoto = async (file: File) => {
    setUnreadable(false);
    const blob = await shrinkPhoto(file);
    if (!PHOTO_TYPES.includes(blob.type)) {
      setUnreadable(true);
      return;
    }
    setPhoto({ id: newRecordId(), blob, taken_at: minuteIso(now), ...(await photoSize(blob)) });
  };

  const send = async () => {
    if (missing || busy) return;
    setBusy(true);
    const payload: Record<string, unknown> = { reason: r, note: note.trim() };
    if (r === "delayed") {
      // "More than 30 min" has no number: it goes as more than 30, and the note says the rest
      payload.delay_min = delay === "more" ? null : delay;
      if (delay === "more") payload.more_than_min = 30;
    }
    if (withLines && stop) {
      payload.lines = stop.lines
        .filter((l) => (counts[l.case_type] ?? 0) > 0)
        .map((l) => ({ case_type: l.case_type, qty: counts[l.case_type] }));
    }
    if (r === "vehicle_problem") payload.urgent = canMove === "no";
    if (photo) payload.photo_id = photo.id;
    const record = await save(
      {
        kind: "problem",
        trip_id: trip.trip_id,
        stop_id: stop?.stop_id ?? null,
        base_version: stop?.version ?? null,
        payload,
      },
      { locate: true },
    );
    // a report's photo is for the dispatcher: it names the report, not the stop's proof
    if (photo) await savePhoto({ ...photo, stop_id: null, event_id: record.id });
    setSentId(record.id);
  };

  const back = `/driver/report${stop ? `?stop=${stop.stop_id}` : ""}`;
  return (
    <PhoneScreen
      header={<DriverHeader back={back} />}
      bar={
        <>
          <Helper icon={Info}>{t("report.helper")}</Helper>
          <Button
            variant="primary"
            density="field"
            full
            icon={Send}
            disabled={Boolean(missing) || busy}
            reason={missing ?? undefined}
            onClick={() => void send()}
          >
            {t("report.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 t-h1 text-asphalt-900">
          <reason.icon size={24} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {t(reason.title)}
        </h2>
        <p className="t-body text-asphalt-700">{about.short}</p>
      </div>

      {r === "delayed" ? (
        <section className="mt-2 flex flex-col gap-3">
          <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
            <legend className="mb-3 t-h2 text-asphalt-900">{t("report.howMuch")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {DELAYS.map((m) => (
                <ChoiceChip key={m} tall selected={delay === m} onClick={() => setDelay(m)}>
                  {t("report.minutes", { count: m })}
                </ChoiceChip>
              ))}
              <ChoiceChip tall selected={delay === "more"} onClick={() => setDelay("more")}>
                {t("report.moreThan")}
              </ChoiceChip>
            </div>
          </fieldset>
          <Notice tone="info">{t("report.delayInfo", { name })}</Notice>
        </section>
      ) : null}

      {withLines && stop ? (
        <section className="mt-2 flex flex-col gap-2">
          <h3 className="t-h2 text-asphalt-900">{t("report.whichCases")}</h3>
          <p className="t-label text-asphalt-700">
            {r === "goods_refused" ? t("report.refusedCount") : t("report.damagedCount")}
          </p>
          <div className="overflow-hidden rounded-card border border-asphalt-200 bg-white">
            {stop.lines.map((line, i) => (
              <div
                key={line.case_type}
                className={`flex min-h-16 items-center gap-3 px-4 py-2${i > 0 ? " border-t border-asphalt-200" : ""}`}
              >
                <span className="min-w-0 flex-1 t-field text-asphalt-900">{caseShort(line.case_type, line.name)}</span>
                <FieldStepper
                  value={counts[line.case_type] ?? 0}
                  max={line.loaded}
                  fewer={t("proof.fewer", { item: caseItem(line.case_type) })}
                  more={t("proof.more", { item: caseItem(line.case_type) })}
                  onChange={(n) => setCounts((c) => ({ ...c, [line.case_type]: n }))}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {r === "vehicle_problem" ? (
        <section className="mt-2 flex flex-col gap-2">
          <ChoiceChip tall selected={canMove === "yes"} onClick={() => setCanMove("yes")}>
            {t("report.canDrive")}
          </ChoiceChip>
          <ChoiceChip tall selected={canMove === "no"} onClick={() => setCanMove("no")}>
            {t("report.cantMove")}
          </ChoiceChip>
          {canMove === "no" ? (
            <Notice tone="attention" field>
              {t("report.cantMoveInfo", { name })}
            </Notice>
          ) : null}
        </section>
      ) : null}

      {withPhoto ? (
        <section className="mt-2 flex flex-col gap-2">
          <SectionTitle>{photoNeeded ? t("report.photoRequired") : t("report.photoOptional")}</SectionTitle>
          <PhotoTile
            blob={photo?.blob ?? null}
            time={null}
            alt={t(reason.title)}
            take={t("report.addPhoto")}
            help={t("report.addPhotoHelp")}
            onFile={(file) => void takePhoto(file)}
            inputRef={camera}
          />
          {photo ? (
            <Button variant="quiet" density="field" full onClick={() => camera.current?.click()}>
              {t("proof.retake")}
            </Button>
          ) : null}
          {unreadable ? (
            <p role="alert" className="t-body-strong text-problem">
              {t("proof.photoUnreadable")}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-2">
        <TextField
          label={t("report.note", { name })}
          value={note}
          onChange={setNote}
          placeholder={r === "delayed" ? t("report.noteDelay") : t("report.noteOther", { name })}
          multiline
        />
      </section>
    </PhoneScreen>
  );
}

/** DRV-04 / report sent: sent with the time and location, or saved on the phone until there is signal. */
function ReportSent({ id }: { id: string }) {
  const { t } = useDriverText();
  const { items, offline, run } = useDriver();
  const navigate = useNavigate();
  const item = items.find((i) => i.id === id);
  const name = calledName(run?.dispatcher);
  const waiting = !item || item.queued;
  const title = waiting ? t("report.savedTitle") : t("report.sentTitle");
  const body = waiting
    ? offline
      ? t("report.savedBody")
      : t("report.sendingBody")
    : item.record?.lat != null
      ? t("report.sentBody", { name })
      : t("report.sentBodyNoLocation", { name });
  return (
    <PhoneScreen
      header={<DriverHeader close={() => navigate("/driver")} />}
      bar={
        <Button variant="primary" density="field" full onClick={() => navigate("/driver")}>
          {t("report.back")}
        </Button>
      }
    >
      <ConfirmPanel title={title}>{body}</ConfirmPanel>
    </PhoneScreen>
  );
}
