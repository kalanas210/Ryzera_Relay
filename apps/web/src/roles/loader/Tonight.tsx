import {
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  Clock,
  Info,
  PackageX,
  RefreshCw,
  Snowflake,
  Truck,
  Van,
  X,
} from "lucide-react";
import { Fragment, useState } from "react";
import { useNavigate } from "react-router";
import { IconButton } from "@/design/Button";
import { StatusChip } from "@/design/StatusChip";
import { useLoaderText } from "@/i18n";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { type DockNotice, type LoadCard, loadKindKey, type Tonight, useTonight, vehicleKindKey } from "./api";
import { weekdayName } from "./days";
import { DockHeader, LoaderBar, useDepotDay } from "./LoaderShell";
import { LoadProgress } from "./parts";

const DISMISSED_KEY = "relay.dock.dismissed";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** LDR-01 Tonight's loads: what has to leave this dock tonight, and when. */
export function TonightPage() {
  const { t } = useLoaderText();
  const tonight = useTonight();
  const data = tonight.data;
  const { depot, day } = useDepotDay(data?.depot, data?.run_date);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-50)));
    } catch {
      // the banner comes back next time; nothing is lost
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col">
      <div className="sticky top-0 z-20">
        <DockHeader title={depot} meta={day} />
        <LoaderBar />
      </div>
      <main className="flex flex-col gap-3 px-4 pt-3 pb-8">
        {!data ? null : !data.published_at ? (
          // why there is nothing to load yet, and what brings the loads: the dispatcher publishing the day's plan
          <section className="flex flex-col gap-1 rounded-card border border-asphalt-200 bg-white px-4 py-4">
            <h2 className="t-h2">{t("tonight.notPublishedTitle")}</h2>
            <p className="t-body text-asphalt-700">
              {data.dispatcher
                ? t("tonight.notPublished", {
                    depot,
                    day: weekdayName(t, data.run_date),
                    name: calledName(data.dispatcher),
                  })
                : t("tonight.notPublishedNoName", { depot, day: weekdayName(t, data.run_date) })}
            </p>
          </section>
        ) : (
          <TonightBody data={data} dismissed={dismissed} onDismiss={dismiss} />
        )}
      </main>
    </div>
  );
}

function TonightBody({
  data,
  dismissed,
  onDismiss,
}: {
  data: Tonight;
  dismissed: string[];
  onDismiss: (id: string) => void;
}) {
  const { t, clock } = useLoaderText();
  const notices = data.notices.filter((n) => !dismissed.includes(n.id));
  const counts = [
    data.loading.length ? t("tonight.loadingN", { count: data.loading.length }) : null,
    data.ready.length ? t("tonight.readyN", { count: data.ready.length }) : null,
    data.to_load.length ? t("tonight.toLoadN", { count: data.to_load.length }) : null,
    data.left_count ? t("tonight.leftN", { count: data.left_count }) : null,
  ].filter(Boolean);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="t-h1">{t("tonight.title")}</h1>
        <p className="t-label text-asphalt-500">
          {t("tonight.loads", { count: data.loads })}: {counts.join(", ")}
        </p>
      </div>

      {notices.map((notice) => (
        <PlanChangeNotice key={notice.id} notice={notice} onDismiss={() => onDismiss(notice.id)} />
      ))}

      <Group label={t("tonight.groups.loading")} cards={data.loading} changed={notices} />
      <Group label={t("tonight.groups.ready")} cards={data.ready} changed={notices} />
      <Group label={t("tonight.groups.toLoad")} cards={data.to_load} changed={notices} />

      {data.left.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="t-label text-asphalt-500">{t("tonight.groups.left")}</h2>
          {/* One grid, so every row's place starts after the widest time: a 10:05 never pushes its district a digit
              further than a 2:00. The time column is 64 wide at the least. */}
          <div className="grid grid-cols-[minmax(4rem,max-content)_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-card border border-asphalt-200 bg-white p-4">
            {data.left.map((row) => (
              <Fragment key={`${row.district}-${row.at}`}>
                <span className="num t-body-strong whitespace-nowrap text-asphalt-900">{clock(row.at)}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="latin t-body-strong text-asphalt-900">{row.district}</span>
                  <span className="latin t-label text-asphalt-700">{row.vehicles.join(", ")}</span>
                </span>
              </Fragment>
            ))}
          </div>
        </section>
      ) : null}

      {data.workshop.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="t-label text-asphalt-500">{t("tonight.groups.workshop")}</h2>
          {data.workshop.map((w) => {
            const VehicleIcon = w.vehicle_type === "van" ? Van : Truck;
            return (
              <div
                key={w.vehicle_id}
                className="flex flex-col gap-2 rounded-card border border-asphalt-200 bg-asphalt-100 p-4 text-asphalt-500"
              >
                <div className="flex items-center gap-2">
                  <VehicleIcon size={24} strokeWidth={1.75} aria-hidden />
                  <span className="latin t-h2">{w.vehicle_id}</span>
                  <span className="ml-auto t-body-strong">{t("tonight.noLoad")}</span>
                </div>
                <p className="t-body">
                  {t(`vehicles.${vehicleKindKey(w.vehicle_kind)}`)}
                  {w.back_on ? ` · ${t("tonight.backOn", { day: weekdayName(t, w.back_on) })}` : ""}
                </p>
                <div>
                  <StatusChip icon={Info} tone="waiting">
                    {t("chips.workshop")}
                  </StatusChip>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {data.daytime ? (
        <p className="t-caption text-asphalt-500">{t("tonight.daytime", { count: data.daytime })}</p>
      ) : null}
    </>
  );
}

function PlanChangeNotice({ notice, onDismiss }: { notice: DockNotice; onDismiss: () => void }) {
  const { t, clock } = useLoaderText();
  const title =
    notice.kind === "swap"
      ? t("notice.swapTitle", { vehicle: notice.vehicle_id, a: notice.stops[0], b: notice.stops[1] })
      : t("notice.reorderTitle", { vehicle: notice.vehicle_id });
  const head = t("notice.changedBy", { time: clock(notice.at), name: notice.by ?? "" });
  const what =
    notice.kind === "swap" && notice.first_place
      ? `${
          notice.loads_first
            ? t("notice.loadsFirst", { place: notice.first_place })
            : t("notice.loadsBefore", { place: notice.first_place, other: notice.other_place })
        }${notice.done ? ` ${t("notice.done")}` : ""}.`
      : t("notice.reorderBody");
  return (
    <section
      role="status"
      className="relative flex items-start gap-3 rounded-card bg-attention-soft py-4 pr-12 pl-4 text-asphalt-900"
    >
      <RefreshCw size={24} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-attention" />
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="t-h3">{title}</h2>
        <p className="t-body">
          {head} {what} {t("notice.printed")}
        </p>
      </div>
      <IconButton
        icon={X}
        label={t("tonight.dismiss")}
        density="field"
        onClick={onDismiss}
        className="absolute top-1 right-1"
      />
    </section>
  );
}

function Group({ label, cards, changed }: { label: string; cards: LoadCard[]; changed: DockNotice[] }) {
  if (!cards.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="t-label text-asphalt-500">{label}</h2>
      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <VehicleLoadCard
            key={card.trip_id}
            card={card}
            highlighted={changed.some((n) => n.trip_id === card.trip_id)}
          />
        ))}
      </div>
    </section>
  );
}

function VehicleLoadCard({ card, highlighted }: { card: LoadCard; highlighted: boolean }) {
  const { t, clock } = useLoaderText();
  const navigate = useNavigate();
  const VehicleIcon = card.vehicle_type === "van" ? Van : Truck;
  const kind = t(`kinds.${loadKindKey(card.brand, card.temp)}`);
  const tripLine = [
    card.trip_no > 1 ? t("tonight.trip", { n: card.trip_no }) : null,
    kind,
    card.district,
    t("tonight.stops", { count: card.stops }),
    t("tonight.cases", { count: card.cases }),
  ]
    .filter(Boolean)
    .join(" · ");
  const people = [
    card.driver ? t("tonight.driver", { name: card.driver }) : null,
    card.loader && card.state !== "not_started" ? t("tonight.loader", { name: card.loader }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // The Plan changed modifier is the border and the chip together; both go once the load is complete.
  const planChanged = highlighted || (Boolean(card.plan_changed_at) && card.state !== "ready");

  return (
    <button
      type="button"
      onClick={() => navigate(`/loader/trips/${card.trip_id}`)}
      className={cx(
        "flex w-full flex-col gap-2 rounded-card bg-white p-4 text-left",
        planChanged ? "border-2 border-attention" : "border border-asphalt-200",
      )}
    >
      <div className="flex w-full items-center gap-2">
        <VehicleIcon size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-900" />
        {/* the Chilled chip drops under the vehicle before the departure time would be pushed off the card */}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="latin t-h2 text-asphalt-900">{card.vehicle_id}</span>
          {card.temp === "chilled" ? (
            <StatusChip icon={Snowflake} tone="chilled">
              {t("chips.chilled")}
            </StatusChip>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="t-caption text-asphalt-500">{t("tonight.leaves")}</span>
          <span className="num t-h2 whitespace-nowrap text-asphalt-900">{clock(card.planned_depart)}</span>
        </span>
        <ChevronRight size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-500" />
      </div>
      <p className="t-body text-asphalt-700">{tripLine}</p>
      {people ? <p className="t-label text-asphalt-500">{people}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <StateChip card={card} />
        {card.state === "ready" && card.accepted_at && card.accepted_by ? (
          <span className="t-caption text-asphalt-700">
            {t("tonight.acceptedBy", { name: card.accepted_by, time: clock(card.accepted_at) })}
          </span>
        ) : card.state === "ready" && card.completed_at ? (
          <span className="t-caption text-asphalt-700">
            {t("tonight.completeAt", { time: clock(card.completed_at) })}
          </span>
        ) : null}
        {planChanged && card.plan_changed_at ? (
          <StatusChip icon={RefreshCw} tone="attention">
            {t("chips.planChanged", { time: clock(card.plan_changed_at) })}
          </StatusChip>
        ) : null}
        {card.flags_waiting ? (
          <StatusChip icon={Clock} tone="attention">
            {t("chips.flagsWaiting", { count: card.flags_waiting })}
          </StatusChip>
        ) : null}
        {card.short ? (
          <StatusChip icon={PackageX} tone="attention">
            {t("chips.short", { count: card.short })}
          </StatusChip>
        ) : null}
      </div>
      {card.state === "loading" ? (
        <div className="flex w-full flex-col gap-1">
          <LoadProgress loaded={card.loaded} total={card.cases} short={card.short} height={6} />
          <p className="num t-caption text-asphalt-700">
            {t("tonight.casesLoaded", { loaded: card.loaded, total: card.cases })}
          </p>
        </div>
      ) : card.state === "not_started" && card.pick_before ? (
        <p className="t-caption text-asphalt-700">
          {t("tonight.pickBefore", { vehicle: card.vehicle_id, time: clock(card.pick_before) })}
        </p>
      ) : null}
    </button>
  );
}

function StateChip({ card }: { card: LoadCard }) {
  const { t } = useLoaderText();
  if (card.state === "ready") {
    return (
      <StatusChip icon={CircleCheck} tone="done">
        {t("chips.ready")}
      </StatusChip>
    );
  }
  if (card.state === "loading") {
    return (
      <StatusChip icon={CircleDot} tone="petrol">
        {t("chips.loading")}
      </StatusChip>
    );
  }
  return (
    <StatusChip icon={Circle} tone="waiting">
      {t("chips.notStarted")}
    </StatusChip>
  );
}
