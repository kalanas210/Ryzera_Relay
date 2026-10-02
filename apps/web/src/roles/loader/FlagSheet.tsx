import {
  Camera,
  Check,
  ClipboardList,
  Info as InfoIcon,
  type LucideIcon,
  MessageSquare,
  Package,
  PackageX,
  Phone,
  Route,
  Send,
  TriangleAlert,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { Stepper } from "@/design/Stepper";
import { useLoaderText } from "@/i18n";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { PHOTO_TYPES, shrinkPhoto } from "@/lib/photo";
import { type FlagWrite, type LoadLine, loadKindKey, type StopGroup, type TripLoad, useWithdrawFlag } from "./api";
import { weekdayName } from "./days";
import { Swap } from "./parts";

export type SendFlag = (flag: Pick<FlagWrite, "lineId" | "kind" | "qty">, photo: Blob | null) => void;

type Props = {
  load: TripLoad;
  group: StopGroup | null;
  line: LoadLine | null;
  /** The line's flag is still on this tablet a minute after it was made. */
  unsent?: boolean;
  /** Saves the flag on the tablet and sends it, with the photo after it. */
  onSend: SendFlag;
  onClose: () => void;
};

/** LDR-03 Flag a shortfall: two taps for a missing line, and the dispatcher's answer in the same place. */
export function FlagSheet({ load, group: opened, line, unsent = false, onSend, onClose }: Props) {
  const { t } = useLoaderText();
  // the stop as the load reads now, not as it was when the sheet opened
  const group = opened ? (load.groups.find((g) => g.stop_id === opened.stop_id) ?? opened) : null;
  const open = Boolean(group && line);
  const item = line ? t(`cases.${line.case_type}`, { defaultValue: line.case_type }) : "";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={group && line ? t("flag.title", { item, n: group.seq }) : ""}
      meta={
        group ? (
          <span className="latin">
            {t("flag.meta", { place: group.place, outlet: group.outlet_id, order: group.order_ref })}
          </span>
        ) : undefined
      }
      closeLabel={t("who.close")}
    >
      {group && line ? (
        line.shortfall ? (
          <FlagRecord load={load} group={group} line={line} unsent={unsent} onClose={onClose} />
        ) : (
          <NewFlag load={load} group={group} line={line} onSend={onSend} onClose={onClose} />
        )
      ) : null}
    </Sheet>
  );
}

function NewFlag({
  load,
  group,
  line,
  onSend,
  onClose,
}: {
  load: TripLoad;
  group: StopGroup;
  line: LoadLine;
  onSend: SendFlag;
  onClose: () => void;
}) {
  const { t } = useLoaderText();
  const [kind, setKind] = useState<"missing" | "damaged">("missing");
  const [qty, setQty] = useState(() => (line.loaded > 0 && line.loaded < line.qty ? line.qty - line.loaded : 1));
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const shelf = line.qty - qty;
  const item = t(`casesLower.${line.case_type}`, { defaultValue: line.case_type });
  const kindLabel = t(`kinds.${load.temp === "chilled" ? "chilled" : load.brand === "Fresh" ? "dry" : load.brand}`);

  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    const blob = await shrinkPhoto(file);
    const readable = PHOTO_TYPES.includes(blob.type);
    setPhotoError(!readable);
    setPhoto(readable ? { blob, url: URL.createObjectURL(blob) } : null);
  };

  // The flag saves on the tablet first, so the sheet closes at once and loading goes on; it reaches Relay as soon
  // as it can, and the line says so if it has not after a minute.
  const send = () => {
    onSend({ lineId: line.id, kind, qty }, kind === "damaged" && photo ? photo.blob : null);
    onClose();
  };

  // The dispatcher decides about the cases still to come: the missing ones, or the damaged ones kept off the truck.
  const info = (forKind: "missing" | "damaged") => (
    <p className="flex items-start gap-3 t-body text-asphalt-700">
      <InfoIcon size={24} strokeWidth={1.75} aria-hidden className="shrink-0" />
      {forKind === "missing"
        ? t("flag.info", { name: load.dispatcher ?? "", n: qty })
        : t("flag.infoDamaged", { name: load.dispatcher ?? "", n: qty })}
    </p>
  );
  const sendButton = (forKind: "missing" | "damaged") => (
    <Button variant="primary" density="field" full icon={Send} onClick={send}>
      {forKind === "missing" ? t("flag.sendMissing", { n: qty }) : t("flag.sendDamaged", { n: qty })}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4 pb-2">
      <p className="flex items-center gap-1.5 t-label text-asphalt-700">
        <Package size={16} strokeWidth={1.75} aria-hidden />
        {t("flag.planned", { kind: kindLabel, n: line.qty })}
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 t-label text-asphalt-700">{t("flag.what")}</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {(["missing", "damaged"] as const).map((k) => {
            const Icon = k === "missing" ? PackageX : TriangleAlert;
            const selected = kind === k;
            return (
              // biome-ignore lint/a11y/useSemanticElements: a styled two-way choice, 64 high for gloves
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setKind(k)}
                className={cx(
                  "flex h-16 items-center justify-center gap-2 rounded-button t-field-button",
                  selected
                    ? "border-2 border-petrol-700 bg-petrol-50 text-petrol-700"
                    : "border border-asphalt-300 bg-white text-asphalt-900",
                )}
              >
                <Icon size={24} strokeWidth={1.75} aria-hidden />
                {k === "missing" ? t("flag.missing") : t("flag.damaged")}
              </button>
            );
          })}
        </div>
      </fieldset>
      {/* Missing and Damaged read differently below this point, and Damaged adds the photo. Every text that changes
          keeps the room of its longer reading, and the sheet is as tall as its taller form from the moment it
          opens, so tapping Damaged or Missing never moves the choice under the finger that tapped it. */}
      <div className="flex flex-col gap-2">
        <Swap
          as="div"
          shown={kind}
          options={{
            missing: <p className="t-label text-asphalt-700">{t("flag.howManyMissing")}</p>,
            damaged: <p className="t-label text-asphalt-700">{t("flag.howManyDamaged")}</p>,
          }}
        />
        <div className="flex items-center gap-3">
          <Stepper
            value={qty}
            onChange={setQty}
            min={1}
            max={line.qty}
            label={kind === "missing" ? t("flag.howManyMissing") : t("flag.howManyDamaged")}
            unit={item}
            fewerLabel={t("flag.fewer", { item })}
            moreLabel={t("flag.more", { item })}
            size="field"
          />
          <span className="num t-label text-asphalt-700">{t("load.of", { n: line.qty })}</span>
        </div>
        <Swap
          as="div"
          shown={kind}
          options={{
            missing: <p className="t-body text-asphalt-700">{t("flag.shelf", { shelf })}</p>,
            damaged: <p className="t-body text-asphalt-700">{t("flag.damagedHelp")}</p>,
          }}
        />
      </div>
      <Swap
        as="div"
        shown={kind}
        options={{
          missing: (
            <div className="flex flex-col gap-4">
              {info("missing")}
              {sendButton("missing")}
            </div>
          ),
          damaged: (
            <div className="flex flex-col gap-4">
              {/* a photo is asked for only for damage: there is nothing to photograph when a case is not there */}
              <div className="flex flex-col gap-2">
                <input
                  ref={camera}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(event) => {
                    void pickPhoto(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                {photo ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={photo.url}
                      alt={t("flag.photoAlt", { item })}
                      className="size-16 rounded-button object-cover"
                    />
                    <span className="flex items-center gap-1.5 t-body-strong text-done">
                      <Check size={16} strokeWidth={1.75} aria-hidden />
                      {t("flag.photoAdded")}
                    </span>
                  </div>
                ) : null}
                <Button density="field" full icon={Camera} onClick={() => camera.current?.click()}>
                  {photo ? t("flag.photoAgain") : t("flag.addPhoto")}
                </Button>
                {photoError ? (
                  <p role="alert" className="t-body-strong text-problem">
                    {t("flag.photoUnreadable")}
                  </p>
                ) : null}
              </div>
              {info("damaged")}
              {sendButton("damaged")}
            </div>
          ),
        }}
      />
      <span className="sr-only">{group.place}</span>
    </div>
  );
}

function FlagRecord({
  load,
  group,
  line,
  unsent,
  onClose,
}: {
  load: TripLoad;
  group: StopGroup;
  line: LoadLine;
  unsent: boolean;
  onClose: () => void;
}) {
  const { t, clock } = useLoaderText();
  const withdraw = useWithdrawFlag(load.trip_id);
  const [showNumber, setShowNumber] = useState(false);
  const s = line.shortfall;
  if (!s) return null;
  const Icon = s.kind === "missing" ? PackageX : TriangleAlert;
  const day = s.added_to_day ? weekdayName(t, s.added_to_day) : "";
  const from = weekdayName(t, load.planned_depart);
  // what the stop's lines say goes off at the door: every decided short on the stop, not only this one
  const stopCases = group.cases - group.short;
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-start gap-3 rounded-card border border-asphalt-200 bg-asphalt-50 p-4">
        <Icon
          size={24}
          strokeWidth={1.75}
          aria-hidden
          className={cx("mt-0.5 shrink-0", s.kind === "missing" ? "text-attention" : "text-problem")}
        />
        <div className="flex flex-col gap-0.5">
          <p className="t-h3">
            {s.kind === "missing" ? t("flag.yourFlagMissing", { n: s.qty }) : t("flag.yourFlagDamaged", { n: s.qty })}
          </p>
          <p className="t-label text-asphalt-700">
            {unsent
              ? t("flag.notSentBy", { name: s.flagged_by ?? "", time: clock(s.flagged_at) })
              : t("flag.sentBy", { name: s.flagged_by ?? "", time: clock(s.flagged_at) })}
          </p>
        </div>
        {s.photo_id ? (
          <img
            src={`/api/photos/${s.photo_id}?as=loader`}
            alt={t("flag.photoAlt", { item: t(`casesLower.${line.case_type}`, { defaultValue: line.case_type }) })}
            className="ml-auto size-16 shrink-0 rounded-button object-cover"
          />
        ) : null}
      </div>

      {unsent && load.dispatcher_phone ? (
        // the number is shown large enough to dial from a phone, and a phone can call it with a tap
        <div className="flex flex-col gap-2">
          <Button density="field" full icon={Phone} aria-expanded={showNumber} onClick={() => setShowNumber(true)}>
            {t("call.title", { name: calledName(load.dispatcher) })}
          </Button>
          {showNumber ? <DispatchNumber phone={load.dispatcher_phone} /> : null}
        </div>
      ) : null}

      {s.decision && s.decided_at ? (
        <section className="flex flex-col gap-2 rounded-card border border-attention bg-attention-soft p-4">
          <p className="t-caption text-asphalt-700">
            {t("flag.answeredAt", { name: s.decided_by ?? "", time: clock(s.decided_at) })}
          </p>
          <h3 className="t-h2">
            {s.decision === "send_short" ? t("flag.sendShortAdd", { day }) : t("flag.sendShortNone")}
          </h3>
          <p className="t-body">
            {s.decision === "send_short" && s.added_to_order_ref
              ? t("flag.bodyAdd", {
                  loaded: line.loaded,
                  n: s.qty,
                  place: group.place,
                  day,
                  order: s.added_to_order_ref,
                  from,
                  kind: t(`kindsLower.${loadKindKey(load.brand, load.temp)}`),
                })
              : t("flag.bodyNone", { loaded: line.loaded, n: s.qty })}
          </p>
          <hr className="border-attention/30" />
          <Consequence icon={MessageSquare}>
            {s.store_contact ? t("flag.toldStore", { name: s.store_contact }) : t("flag.toldStoreNoName")}
          </Consequence>
          {load.driver ? (
            <Consequence icon={Route}>
              {t("flag.runSheet", { driver: calledName(load.driver), cases: stopCases, n: group.seq })}
            </Consequence>
          ) : null}
          <Consequence icon={ClipboardList}>{t("flag.record")}</Consequence>
        </section>
      ) : (
        <>
          <p className="t-body text-asphalt-700">{t("flag.waiting", { name: load.dispatcher ?? "" })}</p>
          {withdraw.error ? (
            <p role="alert" className="t-body-strong text-problem">
              {t("load.notSaved", { message: withdraw.error.message })}
            </p>
          ) : null}
          <Button
            density="field"
            full
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate(line.id, { onSuccess: onClose })}
          >
            {t("flag.withdraw")}
          </Button>
        </>
      )}
      <Button variant="primary" density="field" full icon={Check} onClick={onClose}>
        {t("flag.back")}
      </Button>
    </div>
  );
}

/** The dispatch number in Display size. On a phone a tap calls it; the dock tablet cannot place calls, so the
 *  number is large enough to dial from a phone, and the note says so in words that suit either device. */
function DispatchNumber({ phone }: { phone: string }) {
  const { t } = useLoaderText();
  return (
    <div className="flex flex-col items-center gap-1 rounded-card border border-asphalt-200 bg-asphalt-50 p-4">
      <a
        href={telLink(phone)}
        className="num latin inline-flex min-h-12 items-center rounded-button px-2 t-display text-petrol-700 underline decoration-2 underline-offset-4"
      >
        {phone}
      </a>
      <p className="text-center t-label text-asphalt-700">{t("call.note")}</p>
    </div>
  );
}

/** "081 000 2145" as a dialable link: digits only, and a leading + kept for an international number. */
export function telLink(phone: string): string {
  return `tel:${phone.trim().replace(/(?!^\+)[^\d]/g, "")}`;
}

/** "Call Nuwan at dispatch" from the bar alert row, when a flag still has no answer close to departure. */
export function CallSheet({ open, onClose, load }: { open: boolean; onClose: () => void; load: TripLoad }) {
  const { t } = useLoaderText();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("call.title", { name: calledName(load.dispatcher) })}
      closeLabel={t("who.close")}
    >
      <div className="pb-4">{load.dispatcher_phone ? <DispatchNumber phone={load.dispatcher_phone} /> : null}</div>
    </Sheet>
  );
}

function Consequence({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-3 t-body">
      <Icon size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-700" />
      <span>{children}</span>
    </p>
  );
}
