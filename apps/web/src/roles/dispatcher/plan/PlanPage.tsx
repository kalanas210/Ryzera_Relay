import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDot,
  GripVertical,
  Info,
  ListChecks,
  RefreshCw,
  Send,
  Snowflake,
  Store as StoreIcon,
  TriangleAlert,
  Truck,
  Undo2,
  Van,
  Warehouse,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import { Button, IconButton } from "@/design/Button";
import { Meter } from "@/design/Meter";
import { Notice } from "@/design/Notice";
import { Segmented } from "@/design/Segmented";
import { StatusChip } from "@/design/StatusChip";
import { cx } from "@/lib/cx";
import { dayOf, formatDayLong, formatTime, formatWeekday, formatWindow, kg, m3, numberFormat } from "@/lib/time";
import { type Depot, DeskHeader, useDepot } from "../DispatcherShell";
import {
  type Board,
  type DepotName,
  type Fit,
  fetchFits,
  type Lane,
  type PlanTrip,
  useBoard,
  useMove,
  usePropose,
  useUndo,
  type Waiting,
} from "./api";
import { ChangeOrder } from "./ChangeOrder";
import { DeferralsDrawer } from "./Deferrals";
import { PublishCheck } from "./PublishCheck";

const DEPOT_LABEL: Record<DepotName, string> = { Kandy: "Kandy hub", Peliyagoda: "Peliyagoda" };
type Filter = "all" | "reefer" | "ambient";

/** DSP-02 Plan board: Relay's proposal, every trip's meters and rules, and the orders that don't fit. */
export function PlanPage() {
  const [depotParam, setDepot] = useDepot("Kandy");
  const depot: DepotName = depotParam === "Peliyagoda" ? "Peliyagoda" : "Kandy";
  const board = useBoard(depot);
  const propose = usePropose(depot);
  const data = board.data;
  const [view, setView] = useState<"board" | "check">("board");
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (depotParam === "All") setDepot("Kandy");
  }, [depotParam, setDepot]);

  const meta = data ? (
    <>
      {DEPOT_LABEL[depot]} · {formatDayLong(dayOf(data.plan.run_date))}
      {data.published_peers
        .filter((p) => p.status === "published" && p.published_at)
        .map((p) => (
          <span key={p.depot} className="inline-flex items-center gap-1">
            · <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="text-done" />
            {DEPOT_LABEL[p.depot as DepotName]} published {formatTime(p.published_at!)}
          </span>
        ))}
    </>
  ) : null;

  return (
    <>
      <DeskHeader title="Plan board" meta={meta} depot={depot as Depot} onDepot={(d) => setDepot(d)} allowAll={false} />
      <div className="flex min-w-0 flex-col gap-4 p-4 md:px-6">
        {!data ? (
          <p className="t-dense text-asphalt-500">Loading the plan</p>
        ) : data.plan.version === 0 ? (
          <FirstProposal board={data} depot={depot} propose={propose} />
        ) : (
          <>
            <PlanBar board={data} depot={depot} view={view} onView={setView} onDrawer={() => setDrawer(true)} />
            {view === "check" ? (
              <PublishCheck board={data} depot={depot} onBack={() => setView("board")} />
            ) : (
              <Workspace board={data} depot={depot} onDrawer={() => setDrawer(true)} />
            )}
          </>
        )}
      </div>
      {data && data.plan.version > 0 ? (
        <DeferralsDrawer
          open={drawer}
          onClose={() => setDrawer(false)}
          board={data}
          depot={depot}
          onReady={() => {
            setDrawer(false);
            setView("check");
          }}
        />
      ) : null}
    </>
  );
}

function FirstProposal({
  board,
  depot,
  propose,
}: {
  board: Board;
  depot: DepotName;
  propose: ReturnType<typeof usePropose>;
}) {
  const day = formatWeekday(dayOf(board.plan.run_date));
  return (
    <section className="flex flex-col items-start gap-3 rounded-card border border-asphalt-200 bg-white p-6">
      <h2 className="t-h2">{board.locked ? `${day}'s orders are locked` : `${day}'s orders are still coming in`}</h2>
      <p className="t-dense max-w-[640px] text-asphalt-700">
        {board.locked
          ? `Relay plans the ${DEPOT_LABEL[depot]}'s ${board.orders} orders on its vehicles: every order checked against the eleven rules, each vehicle kept on its usual run where it can, and any order that doesn't fit explained. It takes a few seconds.`
          : "You can ask for a plan now, but orders can still arrive until the 4:00 PM cutoff. Propose again after it."}
      </p>
      <Button
        density="desk"
        variant="primary"
        icon={propose.isPending ? RefreshCw : ListChecks}
        disabled={propose.isPending}
        onClick={() => propose.mutate(undefined)}
      >
        {propose.isPending ? "Relay is planning" : "Propose plan"}
      </Button>
      {propose.isPending ? (
        <p className="t-caption text-asphalt-500" role="status">
          Checking {board.orders} orders against eleven rules on every vehicle that can take them.
        </p>
      ) : null}
      {propose.error ? <p className="t-dense text-problem">{propose.error.message}</p> : null}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ plan bar
function PlanBar({
  board,
  depot,
  view,
  onView,
  onDrawer,
}: {
  board: Board;
  depot: DepotName;
  view: "board" | "check";
  onView: (v: "board" | "check") => void;
  onDrawer: () => void;
}) {
  const propose = usePropose(depot);
  const published = board.plan.status === "published";
  const unreasoned = board.waiting.filter((w) => w.deferral && !w.deferral.confirmed_at).length;
  const waits = board.waiting.length;
  const edited = board.plan.edited_at && (!board.plan.proposed_at || board.plan.edited_at > board.plan.proposed_at);

  let chip = (
    <StatusChip kind="proposed" density="desk">
      Proposed {formatTime(board.plan.proposed_at!)}
    </StatusChip>
  );
  if (published) {
    chip = (
      <span className="inline-flex h-6 items-center gap-1 rounded-chip bg-white px-2 t-label text-done">
        <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
        Published {formatTime(board.plan.published_at!)}
      </span>
    );
  } else if (board.broken) {
    chip = (
      <StatusChip kind="edited" density="desk">
        Edited {formatTime(board.plan.edited_at!)}
      </StatusChip>
    );
  } else if (!unreasoned) {
    chip = (
      <StatusChip kind="ready" density="desk">
        Ready
      </StatusChip>
    );
  } else if (edited) {
    chip = (
      <StatusChip kind="edited" density="desk">
        Edited {formatTime(board.plan.edited_at!)}
      </StatusChip>
    );
  }

  const summary = board.broken
    ? `${board.broken} rule${board.broken > 1 ? "s" : ""} broken. Publish stays off until they're fixed.`
    : `${DEPOT_LABEL[depot]}: ${board.orders} orders, ${board.served} on ${board.trips} trips` +
      (waits ? `, ${waits} wait${waits > 1 ? "" : "s"}${unreasoned ? "" : " with a reason"}.` : ".");

  const helper = board.broken
    ? `Fix ${board.broken} broken rule${board.broken > 1 ? "s" : ""} to publish.`
    : unreasoned
      ? `Give the deferral${unreasoned > 1 ? "s" : ""} a reason to publish.`
      : "";

  return (
    <section
      className={cx(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card px-4 py-2.5",
        published ? "bg-done-soft" : "border border-asphalt-200 bg-white",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {chip}
        <p className="t-dense">{summary}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {published ? (
          <p className="t-dense text-asphalt-700">Sent to the dock, the drivers and every store on these trips.</p>
        ) : (
          <>
            {helper ? <span className="t-caption text-asphalt-500">{helper}</span> : null}
            {waits ? (
              <Button density="desk" variant="link" iconAfter={ChevronRight} onClick={onDrawer}>
                Review deferral{waits > 1 ? "s" : ""}
              </Button>
            ) : null}
            <Button
              density="desk"
              icon={RefreshCw}
              disabled={propose.isPending}
              title="Propose again (P)"
              onClick={() => {
                if (!edited || window.confirm("Propose again? Relay re-plans every order, your moves included.")) {
                  propose.mutate(undefined);
                }
              }}
            >
              {propose.isPending ? "Planning" : "Propose again"}
            </Button>
            <Button
              density="desk"
              variant="primary"
              icon={Send}
              disabled={Boolean(board.broken || unreasoned)}
              title="Publish plan (Ctrl Enter)"
              onClick={() => onView(view === "check" ? "board" : "check")}
            >
              {view === "check" ? "Back to the board" : "Publish plan"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ the board
function Workspace({ board, depot, onDrawer }: { board: Board; depot: DepotName; onDrawer: () => void }) {
  const move = useMove(depot, board.plan.id);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [fits, setFits] = useState<Fit[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const published = board.plan.status === "published";

  const lanes = board.lanes.filter(
    (l) => filter === "all" || (filter === "reefer" ? l.temp === "reefer" : l.temp === "ambient"),
  );
  const running = lanes.filter((l) => l.status !== "workshop");
  const out = lanes.filter((l) => l.status === "workshop");
  const allTrips = board.lanes.flatMap((l) => l.trips);
  const current =
    allTrips.find((t) => `${t.vehicle_id}:${t.trip_no}` === selected) ??
    allTrips.find((t) => t.broken > 0) ??
    allTrips[0] ??
    null;

  const counts = useMemo(() => countLanes(board.lanes), [board.lanes]);

  const onDragStart = (event: DragStartEvent) => {
    const ref = String(event.active.id);
    setDragging(ref);
    setFits([]);
    fetchFits(board.plan.id, ref).then(setFits, () => setFits([]));
  };
  const onDragEnd = (event: DragEndEvent) => {
    const ref = String(event.active.id);
    setDragging(null);
    setFits([]);
    const over = event.over?.id ? String(event.over.id) : null;
    if (!over) return;
    if (over === "not-placed") {
      move.mutate({ order_ref: ref });
      return;
    }
    const [vehicle_id, trip] = over.split(":");
    if (vehicle_id && trip) {
      setSelected(`${vehicle_id}:${trip}`);
      move.mutate({ order_ref: ref, vehicle_id, trip_no: Number(trip) });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      {move.error ? (
        <Notice tone="problem" compact>
          {move.error instanceof ApiError ? move.error.message : "The move did not go through."}
        </Notice>
      ) : null}
      <div className="grid min-w-0 gap-4 xl:grid-cols-[288px_minmax(0,1fr)_344px]">
        <NotPlaced board={board} dragging={dragging} onDrawer={onDrawer} published={published} />
        <section className="min-w-0 overflow-hidden rounded-card border border-asphalt-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-asphalt-200 px-4 py-2">
            <div className="flex items-baseline gap-2">
              <h2 className="t-h3">Vehicles</h2>
              <span className="t-caption text-asphalt-500">{counts[filter]}</span>
            </div>
            <Segmented<Filter>
              size="desk"
              label="Vehicle type"
              value={filter}
              onChange={setFilter}
              segments={[
                { value: "all", label: `All ${board.lanes.length}` },
                { value: "reefer", label: `Refrigerated ${board.lanes.filter((l) => l.temp === "reefer").length}` },
                { value: "ambient", label: `Ambient ${board.lanes.filter((l) => l.temp === "ambient").length}` },
              ]}
            />
          </div>
          <div className="max-h-[720px] overflow-y-auto">
            {running.map((lane) => (
              <LaneRow
                key={lane.vehicle_id}
                lane={lane}
                selected={current ? `${current.vehicle_id}:${current.trip_no}` : null}
                onSelect={setSelected}
                fits={dragging ? fits : null}
                published={published}
              />
            ))}
            {out.length ? (
              <div className="flex flex-col gap-1 bg-asphalt-50 px-4 py-3">
                {out.map((lane) => (
                  <p key={lane.vehicle_id} className="flex items-center gap-2 t-label text-asphalt-500">
                    <CircleAlert size={16} strokeWidth={1.75} aria-hidden />
                    <span className="latin">{lane.vehicle_id}</span> · {vehicleKind(lane)} · {lane.note}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </section>
        {current ? (
          <TripDetail
            trip={current}
            lane={board.lanes.find((l) => l.vehicle_id === current.vehicle_id)!}
            depot={depot}
            board={board}
          />
        ) : (
          <section className="rounded-card border border-asphalt-200 bg-white p-4 t-dense text-asphalt-500">
            No trips on this plan yet.
          </section>
        )}
      </div>
    </DndContext>
  );
}

function countLanes(lanes: Lane[]): Record<Filter, string> {
  const describe = (list: Lane[]) => {
    const running = list.filter((l) => l.trips.length).length;
    const workshop = list.filter((l) => l.status === "workshop").length;
    const standby = list.filter((l) => l.status === "standby").length;
    const idle = list.filter((l) => l.status === "available" && !l.trips.length).length;
    return [
      `${running} running`,
      standby ? `${standby} standby` : "",
      workshop ? `${workshop} in the workshop` : "",
      idle ? `${idle} not needed` : "",
    ]
      .filter(Boolean)
      .join(", ");
  };
  return {
    all: `All: ${describe(lanes)}`,
    reefer: `Refrigerated: ${describe(lanes.filter((l) => l.temp === "reefer"))}`,
    ambient: `Ambient: ${describe(lanes.filter((l) => l.temp === "ambient"))}`,
  };
}

function vehicleKind(lane: Lane): string {
  return `${lane.temp === "reefer" ? "Refrigerated" : "Dry-box"} ${lane.type}`;
}

// ------------------------------------------------------------------------------------------------ not placed
function NotPlaced({
  board,
  dragging,
  onDrawer,
  published,
}: {
  board: Board;
  dragging: string | null;
  onDrawer: () => void;
  published: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "not-placed", disabled: published });
  const [open, setOpen] = useState(true);
  const waiting = board.waiting;
  const chilled = waiting.filter((w) => w.temp === "chilled");
  const analysis = board.analyses.find((a) => a.temp_class === "chilled" && a.unavoidable > 0);
  const day = formatWeekday(dayOf(board.plan.run_date));
  const title = published ? "Deferred" : "Not placed";

  return (
    <section
      ref={setNodeRef}
      className={cx(
        "flex flex-col gap-3 rounded-card border bg-white p-4",
        isOver ? "border-2 border-dashed border-petrol-700" : "border-asphalt-200",
      )}
    >
      <div className="flex items-center gap-2">
        <h2 className="t-h3">{title}</h2>
        <span
          className={cx(
            "num inline-flex h-5 items-center rounded-chip px-1.5 t-label-strong",
            waiting.length && !published ? "bg-attention-soft text-attention" : "bg-asphalt-100 text-asphalt-900",
          )}
        >
          {waiting.length}
        </span>
      </div>
      {waiting.length && !published ? (
        <Notice
          tone="attention"
          compact
          icon={CircleAlert}
          title={
            chilled.length
              ? `${chilled.length} chilled order${chilled.length > 1 ? "s" : ""} ${chilled.length > 1 ? "don't" : "doesn't"} fit`
              : `${waiting.length} order${waiting.length > 1 ? "s" : ""} wait`
          }
        >
          <p>
            {waiting.length === 1 ? `${kg(waiting[0]!.weight_kg)} and ${m3(waiting[0]!.volume_m3)}. ` : ""}
            {analysis?.limiting.length
              ? `${analysis.limiting.join(" and ")} ${analysis.limiting.length > 1 ? "are" : "is"} in the workshop, and no refrigerated trip left has room for it in time.`
              : "No trip left has room for it in time."}
          </p>
          <button
            type="button"
            onClick={onDrawer}
            className="mt-1 inline-flex items-center gap-1 t-label-strong text-petrol-700"
          >
            Review deferral
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </Notice>
      ) : published && waiting.length ? (
        <Notice tone="info" compact>
          {waiting.length} order{waiting.length > 1 ? "s" : ""} moved to{" "}
          {formatWeekday(dayOf(waiting[0]!.deferral?.to_date ?? board.plan.run_date))}. The store
          {waiting.length > 1 ? "s were" : " was"} told when the plan was published.
        </Notice>
      ) : !waiting.length && board.broken ? (
        <Notice tone="info" compact>
          Every order is placed, but {board.broken} rule{board.broken > 1 ? "s are" : " is"} broken. Undo the move and
          Relay's deferral comes back.
        </Notice>
      ) : null}
      {waiting.map((w) => (
        <OrderCard key={w.order_ref} order={w} dragging={dragging === w.order_ref} published={published} />
      ))}
      <div className="h-px bg-asphalt-200" />
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between t-label-strong"
      >
        <span>Placed {board.served}</span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={cx(!open && "-rotate-90")} />
      </button>
      {open ? (
        <dl className="flex flex-col t-dense">
          {["Fresh dry", "Fresh chilled", "Style", "Tech"].map((k) => (
            <div key={k} className="flex h-[26px] items-center justify-between">
              <dt className="text-asphalt-700">{k}</dt>
              <dd className="num">{board.placed_by_type[k] ?? 0}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {!published ? (
        <p className="mt-auto t-caption text-asphalt-500">
          Drag an order onto a trip. Relay checks every rule as you drop. Stores are told when you publish, not before.
        </p>
      ) : (
        <p className="mt-auto t-caption text-asphalt-500">Stores were told when you published {day}'s plan.</p>
      )}
    </section>
  );
}

function OrderCard({ order, dragging, published }: { order: Waiting; dragging: boolean; published: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: order.order_ref, disabled: published });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const chilled = order.temp === "chilled";
  const kind = chilled ? "Fresh chilled" : order.brand === "Fresh" ? "Fresh dry" : order.brand;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cx(
        "flex gap-1 rounded-button border bg-white py-2 pr-3 pl-1",
        dragging ? "relative z-50 border-2 border-petrol-700 shadow-float" : "border-asphalt-200",
        !published && "cursor-grab",
      )}
    >
      <GripVertical size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-asphalt-300" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="t-dense-strong">
          <span className="latin">{order.outlet_id}</span> {order.short_name}
        </p>
        <p className="t-caption text-asphalt-500">
          <span className="latin num">{order.order_ref}</span> · {kind} · {order.units} cases
        </p>
        <p className="num t-caption text-asphalt-700">
          {kg(order.weight_kg)} · {m3(order.volume_m3)} · {formatWindow(order.window_open, order.window_close)}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {chilled ? <StatusChip kind="chilled" density="desk" /> : null}
          {order.deferral ? (
            <StatusChip kind={published ? "deferred" : "toDefer"} density="desk">
              {published ? `Moved to ${formatWeekday(dayOf(order.deferral.to_date))}` : "To defer"}
            </StatusChip>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ lanes
function LaneRow({
  lane,
  selected,
  onSelect,
  fits,
  published,
}: {
  lane: Lane;
  selected: string | null;
  onSelect: (key: string) => void;
  fits: Fit[] | null;
  published: boolean;
}) {
  const reefer = lane.temp === "reefer";
  const Icon = lane.type === "van" ? Van : reefer ? Snowflake : Truck;
  return (
    <div className="flex flex-col gap-3 border-b border-asphalt-200 px-4 py-2 md:flex-row">
      <div className="flex w-[132px] shrink-0 flex-col gap-0.5">
        <p className="flex items-center gap-1.5 t-h3">
          <span className="latin">{lane.vehicle_id}</span>
          <Icon size={16} strokeWidth={1.75} aria-hidden className={reefer ? "text-chilled" : "text-asphalt-500"} />
        </p>
        <p className="t-caption text-asphalt-700">{vehicleKind(lane)}</p>
        <p className="num t-caption text-asphalt-500">
          {numberFormat.format(lane.weight_cap_kg)} kg · {lane.volume_cap_m3} m³
        </p>
        {lane.driver ? <p className="latin t-caption text-asphalt-500">{lane.driver}</p> : null}
        <Meter
          measure="fuel"
          value={lane.fuel_week_l}
          limit={lane.fuel_quota_l}
          label={`${lane.fuel_week_l.toFixed(1)} of ${lane.fuel_quota_l} L`}
          title="Fuel this week"
          className="mt-1"
        />
      </div>
      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {[1, 2].map((n) => {
          const trip = lane.trips.find((t) => t.trip_no === n);
          const fit = fits?.find((f) => f.vehicle_id === lane.vehicle_id && f.trip_no === n) ?? null;
          return trip ? (
            <TripCard
              key={n}
              trip={trip}
              lane={lane}
              selected={selected === `${lane.vehicle_id}:${n}`}
              onSelect={() => onSelect(`${lane.vehicle_id}:${n}`)}
              fit={fits ? fit : null}
              published={published}
            />
          ) : (
            <EmptySlot key={n} lane={lane} tripNo={n} fit={fits ? fit : null} published={published} />
          );
        })}
      </div>
    </div>
  );
}

function TripCard({
  trip,
  lane,
  selected,
  onSelect,
  fit,
  published,
}: {
  trip: PlanTrip;
  lane: Lane;
  selected: boolean;
  onSelect: () => void;
  fit: Fit | null;
  published: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${trip.vehicle_id}:${trip.trip_no}`, disabled: published });
  const broken = trip.broken > 0;
  const fresh = trip.brand === "Fresh";
  // the vehicle's day so far: this trip and the ones before it on the same budget
  const minutes = lane.trips
    .filter((t) => t.trip_no <= trip.trip_no && (t.brand === "Fresh") === fresh)
    .reduce((sum, t) => sum + t.std_minutes, 0);
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        "flex min-h-[112px] flex-col gap-1 rounded-card px-3 py-2 text-left",
        broken
          ? "border-2 border-problem bg-white"
          : selected
            ? "border-2 border-petrol-700 bg-petrol-50"
            : "border border-asphalt-200 bg-white hover:border-asphalt-300",
        isOver && (fit?.fits ? "outline-2 outline-dashed outline-done" : "outline-2 outline-dashed outline-problem"),
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="t-label-strong">
          Trip {trip.trip_no} · {trip.district}
          {trip.brand !== "Fresh" ? ` · ${trip.brand}` : ""}
        </span>
        {broken ? (
          <TriangleAlert size={16} strokeWidth={1.75} aria-label="Rule broken" className="text-problem" />
        ) : (
          <CircleCheck size={16} strokeWidth={1.75} aria-label="All rules pass" className="text-done" />
        )}
      </span>
      {fit ? (
        <FitHint fit={fit} />
      ) : broken ? (
        <span className="inline-flex items-center gap-1 t-caption font-semibold text-problem">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
          {trip.broken} rule{trip.broken > 1 ? "s" : ""} broken
        </span>
      ) : (
        <span className="t-caption text-asphalt-500">
          {trip.stops.length} stop{trip.stops.length > 1 ? "s" : ""} · leaves {formatTime(trip.depart)}
        </span>
      )}
      <Meter
        measure="weight"
        value={trip.weight_kg}
        limit={lane.weight_cap_kg}
        label={`${numberFormat.format(trip.weight_kg)} of ${numberFormat.format(lane.weight_cap_kg)}`}
        title="Weight, kg"
      />
      <Meter
        measure="volume"
        value={trip.volume_m3}
        limit={lane.volume_cap_m3}
        label={`${trip.volume_m3.toFixed(3)} of ${lane.volume_cap_m3}`}
        title="Volume, m³"
      />
      <Meter
        measure="time"
        value={minutes}
        limit={fresh ? 270 : 480}
        label={`${minutes} of ${fresh ? 270 : 480}`}
        title={fresh ? "Fresh minutes today" : "Daytime minutes today"}
      />
    </button>
  );
}

function EmptySlot({
  lane,
  tripNo,
  fit,
  published,
}: {
  lane: Lane;
  tripNo: number;
  fit: Fit | null;
  published: boolean;
}) {
  const canDrop = lane.status !== "workshop" && (tripNo === 1 || lane.trips.length >= 1);
  const { setNodeRef, isOver } = useDroppable({ id: `${lane.vehicle_id}:${tripNo}`, disabled: published || !canDrop });
  const first = lane.trips.find((t) => t.trip_no === 1);
  return (
    <div
      ref={setNodeRef}
      className={cx(
        "flex min-h-[112px] flex-col items-center justify-center gap-0.5 rounded-card border border-dashed border-asphalt-300 bg-asphalt-50 px-3 text-center",
        isOver && "border-2 border-petrol-700",
      )}
    >
      <p className="t-caption font-semibold text-asphalt-700">
        {lane.status === "standby" ? "Standby" : `No trip ${tripNo}`}
      </p>
      {fit ? (
        <FitHint fit={fit} />
      ) : (
        <p className="t-caption text-asphalt-500">
          {lane.status === "standby"
            ? lane.note
            : tripNo === 2 && first
              ? `Back at the hub ${formatTime(first.back)}`
              : "Free all day"}
        </p>
      )}
    </div>
  );
}

function FitHint({ fit }: { fit: Fit }) {
  return fit.fits ? (
    <span className="inline-flex items-center gap-1 t-caption font-semibold text-done">
      <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
      Fits
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 t-caption font-semibold text-problem">
      <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
      {fit.hint}
    </span>
  );
}

// ------------------------------------------------------------------------------------------------ trip detail
const ACCESS: Record<string, { word: string; icon: typeof Warehouse }> = {
  rear_dock: { word: "Rear dock", icon: Warehouse },
  street: { word: "Curb", icon: StoreIcon },
  mall_bay: { word: "Mall bay", icon: Warehouse },
};

function TripDetail({ trip, lane, depot, board }: { trip: PlanTrip; lane: Lane; depot: DepotName; board: Board }) {
  const undo = useUndo(depot, board.plan.id);
  const [open, setOpen] = useState(false);
  const [proposed, setProposed] = useState<string[] | null>(null);
  const published = board.plan.status === "published";
  const moveEarlier = (index: number) => {
    const refs = trip.stops.map((s) => s.order_ref);
    [refs[index - 1], refs[index]] = [refs[index] as string, refs[index - 1] as string];
    setProposed(refs);
  };
  const broken = trip.rules.filter((r) => !r.passed);
  const fresh = trip.brand === "Fresh";
  const kind = trip.temp === "chilled" ? "Fresh chilled" : fresh ? "Fresh dry" : trip.brand;
  const minutes = fresh ? lane.fresh_minutes : lane.daytime_minutes;
  const budget = fresh ? 270 : 480;
  const freeKg = lane.weight_cap_kg - trip.weight_kg;
  const freeM3 = lane.volume_cap_m3 - trip.volume_m3;
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-card border border-asphalt-200 bg-white p-4">
      <header>
        <h2 className="t-h2">
          <span className="latin">{trip.vehicle_id}</span> · Trip {trip.trip_no}
        </h2>
        <p className="t-dense text-asphalt-700">
          {kind} · {trip.district} district{lane.driver ? ` · ${lane.driver}` : ""}
        </p>
        <p className="t-caption text-asphalt-500">
          {vehicleKind(lane)} · leaves {formatTime(trip.depart)} · back {formatTime(trip.back)}
        </p>
      </header>
      {broken.length ? (
        <Notice
          tone="problem"
          compact
          title={`${broken.length} rule${broken.length > 1 ? "s" : ""} broken`}
          action={
            board.can_undo ? (
              <Button
                density="desk"
                variant="primary"
                icon={Undo2}
                onClick={() => undo.mutate(undefined)}
                title="Undo move (Ctrl Z)"
              >
                Undo move
              </Button>
            ) : null
          }
        >
          {broken.map((r) => r.message).join(". ")}.
        </Notice>
      ) : null}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Meter
          size="full"
          measure="weight"
          title="Weight"
          value={trip.weight_kg}
          limit={lane.weight_cap_kg}
          label={`${numberFormat.format(trip.weight_kg)} of ${numberFormat.format(lane.weight_cap_kg)} kg`}
          caption={freeKg >= 0 ? `${kg(freeKg)} free` : `${kg(-freeKg)} over`}
        />
        <Meter
          size="full"
          measure="volume"
          title="Volume"
          value={trip.volume_m3}
          limit={lane.volume_cap_m3}
          label={`${trip.volume_m3.toFixed(3)} of ${lane.volume_cap_m3} m³`}
          caption={freeM3 >= 0 ? `${m3(freeM3)} free` : `${m3(-freeM3)} over`}
        />
        <Meter
          size="full"
          measure="time"
          title={fresh ? "Fresh time" : "Daytime"}
          value={minutes}
          limit={budget}
          label={`${minutes} of ${budget} min`}
          caption={`${trip.std_minutes} on this trip`}
        />
        <Meter
          size="full"
          measure="fuel"
          title="Fuel this week"
          value={lane.fuel_week_l}
          limit={lane.fuel_quota_l}
          label={`${lane.fuel_week_l.toFixed(1)} of ${lane.fuel_quota_l} L`}
          caption={`${(lane.fuel_quota_l - lane.fuel_week_l).toFixed(1)} L left this week`}
        />
      </div>
      <div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cx(
            "flex h-8 w-full items-center gap-2 rounded-button px-3 t-label",
            broken.length ? "bg-problem-soft" : "bg-done-soft",
          )}
        >
          {broken.length ? (
            <TriangleAlert size={16} strokeWidth={1.75} aria-hidden className="text-problem" />
          ) : (
            <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="text-done" />
          )}
          <span className="flex-1 text-left">
            {broken.length
              ? `${trip.rules.length - broken.length} of ${trip.rules.length} rules pass`
              : `All ${trip.rules.length} rules pass`}
          </span>
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={cx(open && "rotate-180")} />
        </button>
        {open ? (
          <ol className="mt-2 flex flex-col gap-1">
            {[...broken, ...trip.rules.filter((r) => r.passed)].map((r) => (
              <li
                key={r.rule}
                className={cx(
                  "flex items-start gap-2 t-caption",
                  r.passed ? "text-asphalt-700" : "rounded-button bg-problem-soft px-2 py-1 font-semibold text-problem",
                )}
              >
                <span className="num w-4 shrink-0 text-asphalt-500">{r.rule}</span>
                {r.passed ? (
                  <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-done" />
                ) : (
                  <TriangleAlert size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                )}
                {r.message}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <p className="t-label-strong text-asphalt-700">Stops, in delivery order</p>
          <span className="t-caption text-asphalt-500">Planned</span>
        </div>
        {published && trip.stops.length > 1 ? (
          <p className="t-caption text-asphalt-500">
            Published. Move a stop earlier and Relay shows the cost before the dock, the driver and the stores are told.
          </p>
        ) : null}
        <ol className="mt-1 flex flex-col">
          {trip.stops.map((s, i) => {
            const late = s.planned.slice(11, 16) > s.window_close;
            const access = ACCESS[s.dock_type] ?? ACCESS.rear_dock!;
            const AccessIcon = access.icon;
            return (
              <li
                key={s.order_ref}
                className={cx("flex items-center gap-2 py-1.5", late && "rounded-button bg-problem-soft px-1")}
              >
                <span
                  className={cx(
                    "num flex size-6 shrink-0 items-center justify-center rounded-full t-label-strong",
                    late ? "bg-problem text-white" : "bg-asphalt-100 text-asphalt-900",
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx("t-dense-strong", late && "text-problem")}>
                    <span className="latin">{s.outlet_id}</span> {s.short_name}
                  </p>
                  <p className="flex items-center gap-1 t-caption text-asphalt-500">
                    <AccessIcon size={14} strokeWidth={1.75} aria-hidden />
                    {access.word} · {formatWindow(s.window_open, s.window_close)}
                  </p>
                </div>
                <span className={cx("num t-label", late && "text-problem")}>{formatTime(s.planned)}</span>
                {published && trip.stops.length > 1 ? (
                  i > 0 ? (
                    <IconButton
                      icon={ArrowUp}
                      density="desk"
                      label={`Move ${s.short_name} earlier, to stop ${i}`}
                      onClick={() => moveEarlier(i)}
                    />
                  ) : (
                    <span className="size-8 shrink-0" />
                  )
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      {trip.note ? (
        <p className="flex items-start gap-2 t-caption text-asphalt-700">
          <Info size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {trip.note}
        </p>
      ) : null}
      {trip.usual ? (
        <p className="flex items-center gap-2 t-caption text-asphalt-500">
          <CircleDot size={14} strokeWidth={1.75} aria-hidden />
          {trip.vehicle_id}'s usual run on a {formatWeekday(dayOf(board.plan.run_date))}.
        </p>
      ) : null}
      {published ? (
        <ChangeOrder
          planId={board.plan.id}
          depot={depot}
          trip={trip}
          order={proposed}
          onClose={() => setProposed(null)}
        />
      ) : null}
    </section>
  );
}
