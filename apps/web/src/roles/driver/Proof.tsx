import { Box, Camera, Check, ChevronRight, CloudOff, Info, PenLine } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Button } from "@/design/Button";
import { PhoneScreen } from "@/design/Phone";
import { StatusChip } from "@/design/StatusChip";
import { StopMarker } from "@/design/StopMarker";
import { cx } from "@/lib/cx";
import { PHOTO_TYPES, shrinkPhoto } from "@/lib/photo";
import { newRecordId } from "@/offline/outbox";
import { phone } from "@/offline/phone";
import { photoSize } from "./device";
import { minuteIso, nextStop, stopLocal } from "./local";
import {
  ChoiceChip,
  ConfirmPanel,
  DriverHeader,
  FieldStepper,
  Helper,
  PhotoTile,
  PlaceName,
  SectionTitle,
  SendChip,
  TextField,
  TwoSegments,
} from "./parts";
import { type Signature, SignatureSheet, SignatureView, svgOf } from "./Signature";
import { findStop } from "./Stop";
import { useDriver } from "./sync";
import type { DriverStop, LineReason } from "./types";
import { useDriverText } from "./words";

type DraftPhoto = { id: string; blob: Blob; taken_at: string; width: number; height: number };

/** Everything typed and taken on DRV-03 so far, kept on the phone on every change: if Android unloads the page
 *  while the camera is open, the form comes back filled in. Cleared once the delivery is in the outbox. */
export type Draft = {
  stop_id: string;
  mode: "all" | "change";
  counts: Record<string, number>;
  reasons: Record<string, LineReason>;
  receiver: string;
  signature: Signature | null;
  photo: DraftPhoto | null;
};

const REASONS: { value: LineReason; key: string }[] = [
  { value: "damaged", key: "proof.damaged" },
  { value: "refused", key: "proof.refused" },
  { value: "not_on_truck", key: "proof.notOnTruck" },
];

function freshDraft(stop: DriverStop): Draft {
  return {
    stop_id: stop.stop_id,
    mode: "all",
    counts: Object.fromEntries(stop.lines.map((l) => [l.case_type, l.loaded])),
    reasons: {},
    receiver: "",
    signature: null,
    photo: null,
  };
}

function useDraft(stop: DriverStop | undefined) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const touched = useRef(false);
  // a draft is read once per stop, not again for each fresh copy of the run
  const latest = useRef(stop);
  latest.current = stop;
  const stopId = stop?.stop_id;
  useEffect(() => {
    const current = latest.current;
    if (!current || !stopId) return;
    let live = true;
    touched.current = false;
    void phone.get<Draft>(`draft:${stopId}`).then((kept) => {
      if (live) setDraft(kept?.value ?? freshDraft(current));
    });
    return () => {
      live = false;
    };
  }, [stopId]);
  useEffect(() => {
    if (draft && touched.current) void phone.put(`draft:${draft.stop_id}`, draft);
  }, [draft]);
  const update = (change: (d: Draft) => Draft) => {
    touched.current = true;
    setDraft((cur) => (cur ? change(cur) : cur));
  };
  return [draft, update] as const;
}

/** DRV-03 Proof of delivery: what came off the truck, who took it, and a photo or a signature. Complete stop writes
 *  one delivery record and then its photo, and goes on to the next stop, or to the trip summary after the last. */
export function ProofPage() {
  const { stopId = "" } = useParams();
  const { run, loaded, now, items, save, savePhoto, offline } = useDriver();
  const { t, clock, cases, caseLine, caseShort, caseItem, place } = useDriverText();
  const navigate = useNavigate();
  const found = findStop(run, stopId);
  const [draft, update] = useDraft(found?.stop);
  const [signing, setSigning] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [busy, setBusy] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const cameOffId = useId();

  if (!loaded || !now || !run) return <PhoneScreen header={<DriverHeader back="/driver" />}>{null}</PhoneScreen>;
  if (!found) return <Navigate to="/driver" replace />;
  const { trip, stop } = found;
  const back = `/driver/stops/${stop.stop_id}`;
  const header = (
    <DriverHeader
      back={back}
      backLabel={t("header.backToStop", { n: stop.seq })}
      title={t("stop.title", { n: stop.seq, total: trip.stops.length })}
    />
  );
  if (stop.status === "delivered" && !busy) return <Navigate to={back} replace />;
  if (!draft) return <PhoneScreen header={header}>{null}</PhoneScreen>;

  const change = draft.mode === "change";
  const count = (code: string, loadedQty: number) => (change ? (draft.counts[code] ?? loadedQty) : loadedQty);
  const total = stop.lines.reduce((n, l) => n + count(l.case_type, l.loaded), 0);
  const name = draft.receiver.trim();
  const shown = Boolean(draft.photo || draft.signature);
  const reasonMissing =
    change && stop.lines.some((l) => count(l.case_type, l.loaded) < l.loaded && !draft.reasons[l.case_type]);
  const reason =
    !name && !shown
      ? t("proof.needNamePhoto")
      : !shown
        ? t("proof.needPhoto")
        : !name
          ? t("proof.needName")
          : reasonMissing
            ? t("proof.needReason")
            : null;

  const takePhoto = async (file: File) => {
    setUnreadable(false);
    const blob = await shrinkPhoto(file);
    if (!PHOTO_TYPES.includes(blob.type)) {
      setUnreadable(true);
      return;
    }
    const size = await photoSize(blob);
    const taken = minuteIso(now);
    update((d) => ({ ...d, photo: { id: newRecordId(), blob, taken_at: taken, ...size } }));
  };

  const complete = async () => {
    if (reason || busy) return;
    setBusy(true);
    const lines = stop.lines.map((l) => {
      const qty = count(l.case_type, l.loaded);
      const why = qty < l.loaded ? draft.reasons[l.case_type] : undefined;
      return why ? { case_type: l.case_type, qty, reason: why } : { case_type: l.case_type, qty };
    });
    const record = await save(
      {
        kind: "delivered",
        trip_id: trip.trip_id,
        stop_id: stop.stop_id,
        base_version: stop.version,
        payload: {
          receiver: name,
          all_delivered: lines.every((l, i) => l.qty === stop.lines[i]?.loaded),
          lines,
          signature_svg: draft.signature ? svgOf(draft.signature) : null,
          photo_id: draft.photo?.id ?? null,
        },
      },
      { locate: true },
    );
    // the photo always goes after its stop record, so the stop reaches the office first on a weak signal
    if (draft.photo) {
      await savePhoto({ ...draft.photo, stop_id: stop.stop_id, event_id: record.id });
    }
    await phone.remove(`draft:${stop.stop_id}`);
    const after = nextStop({ ...trip, stops: trip.stops.filter((s) => s.stop_id !== stop.stop_id) }, items);
    navigate(after ? `/driver/stops/${stop.stop_id}/saved` : "/driver/summary", { replace: true });
  };

  return (
    <PhoneScreen
      header={header}
      bar={
        <>
          {offline ? (
            <Helper icon={CloudOff}>{t("proof.helperOffline")}</Helper>
          ) : (
            <Helper icon={Info}>{t("proof.helper")}</Helper>
          )}
          <Button
            variant="primary"
            density="field"
            full
            icon={Check}
            disabled={Boolean(reason) || busy}
            reason={reason ?? undefined}
            onClick={() => void complete()}
          >
            {t("proof.complete")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <h2 className="t-h1 text-asphalt-900">{t("proof.title")}</h2>
        <p className="t-body text-asphalt-700">
          {t("proof.place", { place: place(stop.place).text, outlet: stop.outlet_id })}
        </p>
        {stop.arrived_at ? (
          <p className="num t-label text-asphalt-500">
            {t("proof.arrived", { time: clock(stop.arrived_at), order: stop.order_ref })}
          </p>
        ) : null}
      </div>

      <section className="mt-2 flex flex-col gap-3">
        <h2 id={cameOffId} className="t-h2 text-asphalt-900">
          {t("proof.cameOff")}
        </h2>
        <TwoSegments
          label={t("proof.cameOff")}
          labelledBy={cameOffId}
          value={draft.mode}
          options={[
            { value: "all", label: t("proof.all") },
            { value: "change", label: t("proof.change") },
          ]}
          onChange={(mode) =>
            update((d) =>
              mode === "all"
                ? { ...freshDraft(stop), receiver: d.receiver, signature: d.signature, photo: d.photo }
                : { ...d, mode },
            )
          }
        />
        {change ? <p className="t-label text-asphalt-700">{t("proof.changeHelp")}</p> : null}
        <div className="overflow-hidden rounded-card border border-asphalt-200 bg-white">
          {stop.lines.map((line, i) => {
            const value = count(line.case_type, line.loaded);
            const item = caseItem(line.case_type);
            return (
              <div
                key={line.case_type}
                className={cx("flex flex-col px-4", i > 0 && "border-t border-asphalt-200", change && "gap-2 py-2")}
              >
                {change ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                        <span className="t-field text-asphalt-900">{caseShort(line.case_type, line.name)}</span>
                        {line.short > 0 ? (
                          <StatusChip kind="short">{t("chip.short", { count: line.short })}</StatusChip>
                        ) : null}
                      </div>
                      <FieldStepper
                        value={value}
                        max={line.loaded}
                        fewer={t("proof.fewer", { item })}
                        more={t("proof.more", { item })}
                        onChange={(next) => update((d) => ({ ...d, counts: { ...d.counts, [line.case_type]: next } }))}
                      />
                    </div>
                    {value < line.loaded ? (
                      <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0 pb-1">
                        <legend className="sr-only">{t("proof.reasonFor", { item })}</legend>
                        {REASONS.map((r) => (
                          <ChoiceChip
                            key={r.value}
                            selected={draft.reasons[line.case_type] === r.value}
                            onClick={() =>
                              update((d) => ({ ...d, reasons: { ...d.reasons, [line.case_type]: r.value } }))
                            }
                          >
                            {t(r.key)}
                          </ChoiceChip>
                        ))}
                      </fieldset>
                    ) : null}
                  </>
                ) : (
                  <div className="flex min-h-14 items-center gap-3">
                    <Box size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-700" />
                    <span className="min-w-0 flex-1 t-field text-asphalt-900">
                      {caseLine(line.case_type, line.name)}
                    </span>
                    {line.short > 0 ? (
                      <StatusChip kind="short">{t("chip.short", { count: line.short })}</StatusChip>
                    ) : null}
                    <span className="num t-h1 text-asphalt-900">{line.loaded}</span>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex min-h-12 items-center justify-between border-t border-asphalt-200 bg-asphalt-50 px-4">
            <span className="t-body text-asphalt-700">{t("proof.total")}</span>
            <span className="num t-h3 text-asphalt-900">{cases(total)}</span>
          </div>
        </div>
      </section>

      <section className="mt-2 flex flex-col gap-2">
        <h2 className="t-h2 text-asphalt-900">{t("proof.receivedBy")}</h2>
        <TextField
          label={t("proof.receiver")}
          value={draft.receiver}
          placeholder={t("proof.receiverHint")}
          latin
          onChange={(receiver) => update((d) => ({ ...d, receiver }))}
        />
      </section>

      <section className="mt-2 flex flex-col gap-2">
        <SectionTitle
          right={
            draft.photo ? (
              <Button variant="quiet" density="field" compact icon={Camera} onClick={() => camera.current?.click()}>
                {t("proof.retake")}
              </Button>
            ) : null
          }
        >
          <span className="flex min-h-12 items-center">{t("proof.photo")}</span>
        </SectionTitle>
        <PhotoTile
          blob={draft.photo?.blob ?? null}
          time={draft.photo ? clock(draft.photo.taken_at) : null}
          alt={t("proof.photoAlt", {
            cases: cases(total),
            place: place(stop.place).text,
            time: draft.photo ? clock(draft.photo.taken_at) : "",
          })}
          take={t("proof.take")}
          help={t("proof.takeHelp")}
          onFile={(file) => void takePhoto(file)}
          inputRef={camera}
        />
        {unreadable ? (
          <p role="alert" className="t-body-strong text-problem">
            {t("proof.photoUnreadable")}
          </p>
        ) : null}
        {draft.signature ? (
          <div className="flex flex-col gap-2 rounded-card border border-asphalt-200 bg-white p-3">
            <p className="flex items-center gap-1.5 t-label text-asphalt-700">
              <PenLine size={16} strokeWidth={1.75} aria-hidden />
              {name ? t("proof.signedBy", { name }) : t("proof.signed")}
            </p>
            <SignatureView
              signature={draft.signature}
              label={name ? t("proof.signedBy", { name }) : t("proof.signed")}
            />
          </div>
        ) : null}
        <Button
          variant="quiet"
          density="field"
          full
          icon={PenLine}
          className="justify-start"
          onClick={() => setSigning(true)}
        >
          {draft.signature ? t("proof.signAgain") : t("proof.useSignature")}
        </Button>
      </section>

      <SignatureSheet
        open={signing}
        onClose={() => setSigning(false)}
        receiver={draft.receiver}
        onUse={(signature) => update((d) => ({ ...d, signature }))}
      />
    </PhoneScreen>
  );
}

/** DRV-03 / Saved: the stop is on the phone (and on its way, or already with Relay). Then the next stop. */
export function SavedPage() {
  const { stopId = "" } = useParams();
  const { run, loaded, now, items, offline } = useDriver();
  const { t, clock, caseItem, lang } = useDriverText();
  const navigate = useNavigate();
  const found = findStop(run, stopId);
  if (!loaded || !now || !run) return <PhoneScreen header={<DriverHeader />}>{null}</PhoneScreen>;
  if (!found) return <Navigate to="/driver" replace />;
  const { trip, stop } = found;
  const local = stopLocal(items, stop.stop_id);
  const record = local.delivery?.record;
  const next = nextStop(trip, items);
  const sentLines = Array.isArray(record?.payload.lines)
    ? (record?.payload.lines as { case_type: string; qty: number; reason?: string }[])
    : [];
  const delivered = sentLines.length ? sentLines.reduce((n, l) => n + (Number(l.qty) || 0), 0) : stop.cases;

  let title = t("saved.sentTitle", { n: stop.seq });
  let body = t("saved.sentBody");
  if (local.waiting && offline) {
    title = t("saved.offlineTitle", { n: stop.seq });
    body = local.photo ? t("saved.offlineBodyPhoto") : t("saved.offlineBody");
  } else if (local.waiting) {
    title = t("saved.sendingTitle", { n: stop.seq });
    body = t("saved.sendingBody");
  }
  const stamp = record
    ? local.delivery?.held
      ? t("saved.stampFinding", { time: clock(record.occurred_at) })
      : record.lat != null
        ? t("saved.stamp", { time: clock(record.occurred_at) })
        : t("saved.stampNoLocation", { time: clock(record.occurred_at) })
    : null;

  return (
    <PhoneScreen
      header={<DriverHeader title={t("stop.title", { n: stop.seq, total: trip.stops.length })} />}
      bar={
        <>
          {next ? (
            <Button
              variant="primary"
              density="field"
              full
              iconAfter={ChevronRight}
              onClick={() => navigate(`/driver/stops/${next.stop_id}`)}
            >
              {t("saved.openNext", { n: next.seq })}
            </Button>
          ) : (
            <Button variant="primary" density="field" full onClick={() => navigate("/driver/summary")}>
              {t("run.openSummary")}
            </Button>
          )}
          <Button variant="quiet" density="field" full onClick={() => navigate("/driver")}>
            {t("saved.back")}
          </Button>
        </>
      }
    >
      <ConfirmPanel title={title}>{body}</ConfirmPanel>
      <section className="flex flex-col gap-2 rounded-card border border-asphalt-200 bg-white p-4">
        <h2 className="t-h3 text-asphalt-900">
          <PlaceName name={stop.place} /> · <span className="latin">{stop.outlet_id}</span>
        </h2>
        <p className="t-body text-asphalt-900">
          {t("saved.delivered", { count: delivered })}
          {stop.lines
            .filter((l) => l.short > 0)
            .map((l) => ` ${t("saved.short", { count: l.short, item: caseItem(l.case_type) })}`)
            .join("")}
        </p>
        {sentLines
          .filter((l) => l.reason)
          .map((l) => {
            const loadedQty = stop.lines.find((x) => x.case_type === l.case_type)?.loaded ?? l.qty;
            const word = t(REASONS.find((r) => r.value === l.reason)?.key ?? "proof.damaged");
            const why = lang === "en" ? word.toLowerCase() : word;
            return (
              <p key={l.case_type} className="t-body text-asphalt-900">
                {t("saved.changed", {
                  count: loadedQty - l.qty,
                  item: caseItem(l.case_type),
                  reason: why,
                })}
              </p>
            );
          })}
        {typeof record?.payload.receiver === "string" && record.payload.receiver ? (
          <p className="t-body text-asphalt-900">{t("saved.receivedBy", { name: record.payload.receiver })}</p>
        ) : null}
        {stamp ? <p className="num t-body text-asphalt-900">{stamp}</p> : null}
        {local.waiting ? (
          <div>
            <SendChip local={local} />
          </div>
        ) : null}
      </section>
      {next ? (
        <section className="mt-2 flex flex-col gap-2">
          <h2 className="t-h2 text-asphalt-900">{t("saved.nextStop")}</h2>
          <NextCompact stop={next} runDate={run.run_date} />
        </section>
      ) : null}
    </PhoneScreen>
  );
}

/** Next stop card / compact: the marker, the place, its window and access, and both named times. */
function NextCompact({ stop, runDate }: { stop: DriverStop; runDate: string }) {
  const { t, clock, around, windowOf, access } = useDriverText();
  return (
    <div className="flex items-start gap-3 rounded-card border border-asphalt-300 bg-white p-4">
      <StopMarker n={stop.seq} state="next" size={40} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="t-h2 text-asphalt-900">
          <PlaceName name={stop.place} />
        </h3>
        <p className="t-body text-asphalt-700">
          {windowOf(runDate, stop.window_open, stop.window_close)} · {access(stop)}
        </p>
        <p className="t-label text-asphalt-500">
          {t("stop.times", {
            planned: clock(stop.planned),
            expected: stop.expected ? around(stop.expected) : clock(stop.planned),
          })}
        </p>
      </div>
    </div>
  );
}
