import {
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  Info,
  PackageCheck,
  PackageX,
  PenLine,
  Truck,
  User,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMe } from "@/app/session";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { PinPad } from "@/design/PinPad";
import { Sheet } from "@/design/Sheet";
import { StatusChip } from "@/design/StatusChip";
import { StopMarker } from "@/design/StopMarker";
import { useLoaderText } from "@/i18n";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { type LoadLine, type StopGroup, type TripLoad, useAcceptHere, useComplete, useTripLoad } from "./api";
import { weekdayName } from "./days";
import { DockHeader, PersonButton, pinError, useDemoPin } from "./LoaderShell";
import { StopTitle } from "./parts";

const PHONE_SILENT_MS = 60_000;

// The unit is written once, after the planned figure: "Weight 2,470.8 of 2,530.8 kg planned".
const weight = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const volume = new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** LDR-04 Handover: one record of what is short and why, and planned against loaded, confirmed by the loader and
 *  accepted by the driver before the truck leaves. */
export function HandoverPage() {
  const { tripId = "" } = useParams();
  const trip = useTripLoad(tripId);
  const { t } = useLoaderText();
  const load = trip.data;
  // Once the driver has accepted there is nothing left to load, so Back goes to tonight's loads.
  const accepted = Boolean(load?.handover.accepted_at);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col">
      <div className="sticky top-0 z-20">
        <DockHeader
          title={load ? t("load.title", { vehicle: load.vehicle_id, n: load.trip_no }) : ""}
          back={accepted ? "/loader" : `/loader/trips/${tripId}`}
          backLabel={accepted ? t("bar.back") : t("bar.backToList")}
        />
      </div>
      {load ? <Handover load={load} /> : null}
    </div>
  );
}

function Handover({ load }: { load: TripLoad }) {
  const { t, clock } = useLoaderText();
  const navigate = useNavigate();
  const me = useMe("loader");
  const now = useSimNow(5_000);
  const complete = useComplete(load.trip_id);
  const [pinOpen, setPinOpen] = useState(false);
  const h = load.handover;
  const driver = load.driver ?? "";
  const first = calledName(driver);
  const done = Boolean(h.completed_at);
  const accepted = Boolean(h.accepted_at);
  const allLinesDone = load.lines_done === load.lines_total;
  const silent =
    done && !accepted && now && h.completed_at && now.getTime() - Date.parse(h.completed_at) >= PHONE_SILENT_MS;
  const flagged = load.groups.flatMap((g) => g.lines.filter((l) => l.shortfall).map((l) => ({ group: g, line: l })));

  let notice: ReactNode;
  if (accepted && h.accepted_at) {
    notice = (
      <Banner tone="done" icon={CircleCheck} title={t("handover.acceptedTitle", { driver: first })}>
        {h.accepted_on === "tablet"
          ? t("handover.acceptedTablet", { time: clock(h.accepted_at), done: clock(h.completed_at ?? h.accepted_at) })
          : t("handover.acceptedPhone", { time: clock(h.accepted_at), done: clock(h.completed_at ?? h.accepted_at) })}
      </Banner>
    );
  } else if (done && h.completed_at) {
    notice = silent ? (
      <Banner tone="attention" icon={CircleAlert} title={t("handover.silentTitle", { driver: first })}>
        {t("handover.silentBody", { driver: first })}
      </Banner>
    ) : (
      <Banner
        tone="waiting"
        icon={Clock}
        title={t("handover.waitingTitle", { driver: first })}
        action={
          <Button density="field" full icon={PenLine} onClick={() => setPinOpen(true)}>
            {t("handover.acceptHere", { driver: first })}
          </Button>
        }
      >
        {t("handover.waitingBody", { driver: first, time: clock(h.completed_at) })}
      </Banner>
    );
  } else {
    notice = (
      <Banner tone="info" icon={Info} title={t("handover.readyTitle")}>
        {t("handover.readyBody", { driver: first })}
      </Banner>
    );
  }

  return (
    <>
      <main className="flex flex-col gap-4 px-4 pt-4 pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="t-h1">{t("handover.title")}</h1>
          <p className="t-body text-asphalt-700">{t("handover.meta", { driver, time: clock(load.planned_depart) })}</p>
        </div>
        {notice}
        {h.difference ? (
          <Banner tone="problem" icon={CircleAlert} title={t("handover.difference", { driver: first })}>
            {h.difference}
          </Banner>
        ) : null}

        {flagged.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="t-h2">{t("handover.shortfall")}</h2>
            {flagged.map(({ group, line }) => (
              <ShortfallRecord key={line.id} group={group} line={line} />
            ))}
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-h2">{t("handover.plannedLoaded")}</h2>
            <p className="t-caption text-asphalt-500">{t("handover.inStopOrder", { driver: first })}</p>
          </div>
          {/* One grid for the whole table, each row a subgrid, so every row shares the columns. Stop is as wide
              as its longest place and never wider than the room left, Planned is 45, and Loaded takes the rest: 12
              of space after Planned, a 40 wide number, then the check or the Short chip, which drops under the
              number before a place name would have to give way. The first line of every cell is 32 high, the
              marker's height, and cells sit at the top of the row, so a stop, its Planned and its Loaded figures
              always share a line, and the row's lines are centered in its 64. */}
          <div className="grid grid-cols-[minmax(0,max-content)_45px_minmax(min-content,1fr)] overflow-hidden rounded-card border border-asphalt-200 bg-white">
            <div className="col-span-full grid h-10 grid-cols-subgrid items-center px-3 t-caption text-asphalt-500">
              <span>{t("handover.stop")}</span>
              <span className="text-right">{t("handover.planned")}</span>
              <span className="pl-3">{t("handover.loadedCol")}</span>
            </div>
            {h.stops.map((s) => {
              const short = s.planned - s.loaded;
              return (
                <div
                  key={s.seq}
                  className={cx(
                    "col-span-full grid min-h-16 grid-cols-subgrid content-center items-start border-t border-asphalt-200 px-3 py-2",
                    short > 0 && "bg-attention-soft",
                  )}
                >
                  <span className="flex min-h-8 min-w-0 items-center gap-2">
                    <StopMarker n={s.seq} state={short > 0 ? "short" : done || allLinesDone ? "done" : "pending"} />
                    <span className="latin min-w-0 t-body-strong [overflow-wrap:anywhere]">{s.place}</span>
                  </span>
                  <span className="num flex h-8 items-center justify-end t-body">{s.planned}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-3">
                    <span className="num flex h-8 w-10 shrink-0 items-center justify-end t-body">{s.loaded}</span>
                    {short > 0 ? (
                      <StatusChip icon={PackageX} tone="attention" className="bg-white whitespace-nowrap">
                        {t("chips.short", { count: short })}
                      </StatusChip>
                    ) : s.loaded === s.planned ? (
                      <Check size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-done" />
                    ) : null}
                  </span>
                </div>
              );
            })}
            <div className="col-span-full grid grid-cols-subgrid items-center gap-y-1 border-t border-asphalt-200 bg-asphalt-50 px-3 py-3">
              <span className="t-h3">{t("handover.total")}</span>
              <span className="num text-right t-h3">{h.planned_cases}</span>
              <span className="pl-3">
                <span className="num block w-10 text-right t-h3">{h.loaded_cases}</span>
              </span>
              <span className="num col-span-full t-caption text-asphalt-700">
                {t("handover.weight", {
                  loaded: weight.format(h.loaded_kg),
                  planned: weight.format(h.planned_kg),
                })}
              </span>
              <span className="num col-span-full t-caption text-asphalt-700">
                {t("handover.volume", {
                  loaded: volume.format(h.loaded_m3),
                  planned: volume.format(h.planned_m3),
                })}
              </span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="t-h2">{t("handover.signOff")}</h2>
          <div className="flex flex-col rounded-card border border-asphalt-200 bg-white px-4">
            <SignOff
              icon={User}
              text={t("handover.loadedBy", { name: h.completed_by ?? me.data?.display_name ?? "" })}
              status={done && h.completed_at ? clock(h.completed_at) : t("handover.notSent")}
              done={done}
            />
            <SignOff
              icon={Truck}
              text={
                accepted
                  ? h.accepted_on === "tablet"
                    ? t("handover.acceptedByTablet", { driver })
                    : t("handover.acceptedBy", { driver })
                  : t("handover.acceptsOnPhone", { driver: first })
              }
              status={
                accepted && h.accepted_at ? clock(h.accepted_at) : done ? t("handover.waiting") : t("handover.notYet")
              }
              done={accepted}
              waiting={done && !accepted}
            />
          </div>
        </section>
      </main>

      <div className="sticky bottom-0 z-20 mt-auto flex flex-col gap-2 border-t border-asphalt-200 bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {!done ? (
          <>
            <p className="t-caption text-asphalt-700">{t("handover.sends", { driver: first })}</p>
            {complete.error ? (
              <p role="alert" className="t-body-strong text-problem">
                {t("load.notSaved", { message: complete.error.message })}
              </p>
            ) : null}
            <Button
              variant="primary"
              density="field"
              full
              icon={PackageCheck}
              disabled={!allLinesDone || complete.isPending}
              onClick={() => complete.mutate(undefined)}
            >
              {t("handover.complete")}
            </Button>
          </>
        ) : silent && !accepted ? (
          <Button variant="primary" density="field" full icon={PenLine} onClick={() => setPinOpen(true)}>
            {t("handover.acceptHere", { driver: first })}
          </Button>
        ) : (
          <Button variant={accepted ? "primary" : "secondary"} density="field" full onClick={() => navigate("/loader")}>
            {t("handover.backToLoads")}
          </Button>
        )}
      </div>

      <DriverPinSheet
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        load={load}
        loader={me.data?.display_name ?? ""}
      />
    </>
  );
}

function ShortfallRecord({ group, line }: { group: StopGroup; line: LoadLine }) {
  const { t, clock } = useLoaderText();
  const s = line.shortfall;
  if (!s) return null;
  const item = t(`casesLower.${line.case_type}`, { defaultValue: line.case_type });
  return (
    <div className="flex flex-col gap-2 rounded-card border border-attention bg-white p-4">
      <div className="flex items-center gap-2">
        <PackageX size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-attention" />
        <h3 className="min-w-0 flex-1 t-h3">
          <StopTitle seq={group.seq} place={group.place} />
        </h3>
        {s.decision ? (
          <StatusChip icon={PackageX} tone="attention">
            {t("chips.sendShort")}
          </StatusChip>
        ) : (
          <StatusChip icon={Clock} tone="attention">
            {t("chips.flagsWaiting", { count: 1 })}
          </StatusChip>
        )}
      </div>
      <p className="t-body">
        {s.kind === "missing"
          ? t("handover.shortWhat", { count: s.qty, item, order: group.order_ref })
          : t("handover.damagedWhat", { count: s.qty, item, order: group.order_ref })}
      </p>
      <p className="t-label text-asphalt-700">
        {t("handover.flaggedBy", { name: s.flagged_by ?? "", time: clock(s.flagged_at) })}
      </p>
      {s.decision && s.decided_at ? (
        <>
          <p className="t-label text-asphalt-700">
            {s.decision === "send_short" && s.added_to_order_ref
              ? t("handover.decidedAdd", {
                  name: s.decided_by ?? "",
                  time: clock(s.decided_at),
                  day: s.added_to_day ? weekdayName(t, s.added_to_day) : "",
                  order: s.added_to_order_ref,
                })
              : t("handover.decidedNone", { name: s.decided_by ?? "", time: clock(s.decided_at) })}
          </p>
          {s.store_contact ? (
            <p className="t-label text-asphalt-700">
              {t("handover.storeTold", { name: s.store_contact, time: clock(s.decided_at) })}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SignOff({
  icon: Icon,
  text,
  status,
  done,
  waiting,
}: {
  icon: typeof User;
  text: string;
  status: string;
  done: boolean;
  waiting?: boolean;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 border-b border-asphalt-200 last:border-b-0">
      <Icon size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-700" />
      <span className="min-w-0 flex-1 t-body">{text}</span>
      <span
        className={cx(
          "inline-flex shrink-0 items-center gap-1",
          done ? "num t-label-strong text-asphalt-900" : "t-label text-asphalt-500",
        )}
      >
        {done ? <Check size={16} strokeWidth={1.75} aria-hidden className="text-done" /> : null}
        {waiting ? <Clock size={16} strokeWidth={1.75} aria-hidden /> : null}
        {status}
      </span>
    </div>
  );
}

function Banner({
  tone,
  icon: Icon,
  title,
  children,
  action,
}: {
  tone: "info" | "done" | "attention" | "waiting" | "problem";
  icon: typeof Info;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      role="status"
      className={cx(
        "flex items-start gap-3 rounded-card p-4",
        tone === "info" && "border border-asphalt-200 bg-white",
        tone === "done" && "bg-done-soft",
        tone === "attention" && "bg-attention-soft",
        tone === "problem" && "bg-problem-soft",
        tone === "waiting" && "border border-asphalt-300 bg-waiting-soft",
      )}
    >
      <Icon
        size={24}
        strokeWidth={1.75}
        aria-hidden
        className={cx(
          "mt-0.5 shrink-0",
          tone === "done"
            ? "text-done"
            : tone === "attention"
              ? "text-attention"
              : tone === "problem"
                ? "text-problem"
                : "text-asphalt-700",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="t-h3">{title}</h2>
        <p className="t-body">{children}</p>
        {action}
      </div>
    </section>
  );
}

/** The driver accepts on the dock tablet with their own PIN: the PIN sheet from LDR-01, with the driver as the only
 *  person. In a walkthrough the demo account's PIN is shown, as on the sign-in screen. */
function DriverPinSheet({
  open,
  onClose,
  load,
  loader,
}: {
  open: boolean;
  onClose: () => void;
  load: TripLoad;
  loader: string;
}) {
  const { t } = useLoaderText();
  const accept = useAcceptHere(load.trip_id);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<{ text: string; wrongPin: boolean } | null>(null);
  const driver = load.driver ?? "";
  const first = calledName(driver);
  const initials = driver
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const demo = useDemoPin((a) => a.role === "driver" && a.display_name === driver);
  return (
    <Sheet
      open={open}
      onClose={() => {
        setPin("");
        setError(null);
        onClose();
      }}
      title={t("handover.pinTitle", { name: first })}
      meta={t("handover.pinNote", { loader })}
      closeLabel={t("who.close")}
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="grid grid-cols-3 gap-2">
          <PersonButton person={{ username: demo.username ?? driver, display_name: driver, initials }} selected />
        </div>
        <div className="flex flex-col items-center gap-3">
          {demo.pin ? (
            <p className="t-caption text-center text-asphalt-500">{t("who.demoPin", { pin: demo.pin })}</p>
          ) : null}
          <PinPad
            value={pin}
            error={Boolean(error?.wrongPin)}
            disabled={accept.isPending}
            deleteLabel={t("who.deleteDigit")}
            progressLabel={(entered, total) => t("who.pinProgress", { entered, total })}
            onChange={(next) => {
              setError(null);
              setPin(next);
              if (next.length === 4) {
                accept.mutate(next, {
                  onSuccess: () => {
                    setPin("");
                    onClose();
                  },
                  onError: (failure) => {
                    setPin("");
                    setError(pinError(t, failure, (message) => t("handover.notAccepted", { message })));
                  },
                });
              }
            }}
          />
          {error ? (
            <p role="alert" className="t-body-strong text-center text-problem">
              {error.text}
            </p>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
