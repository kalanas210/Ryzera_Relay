import {
  type Announcements,
  type ClientRect,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useIsMutating } from "@tanstack/react-query";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Eye,
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
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { Button, IconButton } from "@/design/Button";
import { ErrorState } from "@/design/ErrorState";
import { Meter } from "@/design/Meter";
import { Notice } from "@/design/Notice";
import { Segmented } from "@/design/Segmented";
import { Sheet } from "@/design/Sheet";
import { StatusChip } from "@/design/StatusChip";
import { cx } from "@/lib/cx";
import {
  dayOf,
  formatDayLong,
  formatTime,
  formatWeekday,
  formatWindow,
  kg,
  kgValue,
  m3,
  m3Value,
  numberFormat,
  tenths,
} from "@/lib/time";
import { type Depot, DeskHeader, typingOrInDialog, useDepot } from "../DispatcherShell";
import {
  type Board,
  type DepotName,
  type Fit,
  fetchFits,
  type Lane,
  type MoveInput,
  type PlanStop,
  type PlanTrip,
  replanKey,
  useBoard,
  useMove,
  usePropose,
  useUndo,
  type Waiting,
} from "./api";
import { ChangeOrder } from "./ChangeOrder";
import { DeferralsDrawer } from "./Deferrals";
import { FleetButton, FleetDialog, statusLabel } from "./Fleet";
import { PublishCheck } from "./PublishCheck";
import { Replanning } from "./Replanning";
import { type Moving, TripPicker } from "./TripPicker";
import {
  DEPOT_LABEL,
  everyOrderPlaced,
  firstProposalText,
  fitTooltip,
  noRoom,
  planChip,
  planHelper,
  planSummary,
  tripName,
} from "./words";

type Filter = "all" | "reefer" | "ambient";

/** DSP-02 Plan board: Relay's proposal, every trip's meters and rules, and the orders that don't fit. */
export function PlanPage() {
  const [depotParam, setDepot] = useDepot("Kandy");
  const depot: DepotName = depotParam === "Peliyagoda" ? "Peliyagoda" : "Kandy";
  const board = useBoard(depot);
  const propose = usePropose(depot);
  // proposing and "Defer anyway" in the drawer both send the engine searching; the board waits for either
  const replanning = useIsMutating({ mutationKey: replanKey(depot) }) > 0;
  const data = board.data;
  const [view, setView] = useState<"board" | "check">("board");
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (depotParam === "All") setDepot("Kandy");
  }, [depotParam, setDepot]);

  const published = data?.plan.status === "published";
  const edited = Boolean(data?.plan.edited_at);
  const unreasoned = data ? data.waiting.filter((w) => w.deferral && !w.deferral.confirmed_at).length : 0;
  const publishable = Boolean(data && !published && !data.broken && !unreasoned);

  // "Propose again" asks first when the board holds moves made by hand, which a new proposal replaces
  const askPropose = () => {
    if (!data || published || replanning) return;
    if (edited) setConfirm(true);
    else propose.mutate(undefined);
  };

  // P proposes again, D opens the deferrals and Ctrl Enter goes to the publish check, as the shortcuts sheet lists
  const keys = useRef({ askPropose, publishable, waits: data?.waiting.length ?? 0, view, ready: false });
  keys.current = {
    askPropose,
    publishable,
    waits: data?.waiting.length ?? 0,
    view,
    ready: Boolean(data && data.plan.version > 0 && !published),
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const now = keys.current;
      if (!now.ready || typingOrInDialog(event) || event.altKey) return;
      const plain = !event.ctrlKey && !event.metaKey && !event.shiftKey;
      if (plain && event.code === "KeyP") {
        event.preventDefault();
        now.askPropose();
      } else if (plain && event.code === "KeyD" && now.waits) {
        event.preventDefault();
        setDrawer(true);
      } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && now.publishable && now.view === "board") {
        event.preventDefault();
        setView("check");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const boardView = Boolean(data && data.plan.version > 0 && view === "board");
  return (
    <>
      <DeskHeader title="Plan board" meta={meta} depot={depot as Depot} onDepot={(d) => setDepot(d)} allowAll={false} />
      <div className={cx("flex min-w-0 flex-col gap-4 p-4 md:px-6", boardView && "xl:min-h-0 xl:flex-1")}>
        {!data ? (
          // once a load has failed, the error stays until a board arrives: each new try would otherwise flash
          // "Loading" in its place, since a query with no data goes back to pending when it fetches again
          board.errorUpdateCount > 0 ? (
            <ErrorState
              title="Relay could not load the plan."
              onRetry={() => void board.refetch()}
              retrying={board.isFetching}
            >
              It tries again every 15 seconds.
            </ErrorState>
          ) : (
            <p className="t-dense text-asphalt-500" role="status">
              Loading the plan
            </p>
          )
        ) : data.plan.version === 0 ? (
          <FirstProposal board={data} depot={depot} propose={propose} replanning={replanning} />
        ) : (
          <>
            {board.isError ? (
              <Notice tone="waiting" compact role="status">
                Relay can't reach the plan right now, so the board may be out of date. It tries again every 15 seconds.
              </Notice>
            ) : null}
            <PlanBar
              board={data}
              depot={depot}
              view={view}
              onView={setView}
              onDrawer={() => setDrawer(true)}
              onPropose={askPropose}
              replanning={replanning}
              proposeError={propose.error}
            />
            {view === "check" ? (
              <PublishCheck board={data} depot={depot} onBack={() => setView("board")} />
            ) : (
              <Workspace board={data} depot={depot} onDrawer={() => setDrawer(true)} busy={replanning} />
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
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        variant="dialog"
        width={480}
        title="Propose again?"
        footer={
          <div className="flex justify-end gap-2">
            <Button density="desk" variant="quiet" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              density="desk"
              variant="primary"
              icon={RefreshCw}
              onClick={() => {
                setConfirm(false);
                propose.mutate(undefined);
              }}
            >
              Propose again
            </Button>
          </div>
        }
      >
        <p className="t-dense text-asphalt-700">
          Relay plans every order again from the start, so the moves you made on this board are replaced. Orders you
          chose to defer anyway stay deferred.
        </p>
      </Sheet>
    </>
  );
}

function FirstProposal({
  board,
  depot,
  propose,
  replanning,
}: {
  board: Board;
  depot: DepotName;
  propose: ReturnType<typeof usePropose>;
  replanning: boolean;
}) {
  const day = formatWeekday(dayOf(board.plan.run_date));
  return (
    <section className="flex flex-col items-start gap-3 rounded-card border border-asphalt-200 bg-white p-6">
      <h2 className="t-h2">{board.locked ? `${day}'s orders are locked` : `${day}'s orders are still coming in`}</h2>
      <p className="t-dense max-w-[640px] text-asphalt-700">
        {board.locked
          ? firstProposalText(depot, board.orders)
          : "You can ask for a plan now, but orders can still arrive until the 4:00 PM cutoff. Propose again after it."}
      </p>
      <Button
        density="desk"
        variant="primary"
        icon={replanning ? RefreshCw : ListChecks}
        disabled={replanning}
        onClick={() => propose.mutate(undefined)}
      >
        {replanning ? "Relay is planning" : "Propose plan"}
      </Button>
      <Replanning active={replanning} />
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
  onPropose,
  replanning,
  proposeError,
}: {
  board: Board;
  depot: DepotName;
  view: "board" | "check";
  onView: (v: "board" | "check") => void;
  onDrawer: () => void;
  onPropose: () => void;
  replanning: boolean;
  proposeError: Error | null;
}) {
  const published = board.plan.status === "published";
  const unreasoned = board.waiting.filter((w) => w.deferral && !w.deferral.confirmed_at).length;
  const waits = board.waiting.length;
  const fleetChanged = Boolean(board.plan.fleet_changed_at);
  const chip = planChip(board);
  const helper = planHelper(board);

  return (
    <section
      className={cx(
        "flex shrink-0 flex-col gap-2 rounded-card px-4 py-2.5",
        published ? "bg-done-soft" : "border border-asphalt-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {published ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-chip bg-white px-2 t-label text-done">
              <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
              Published {formatTime(board.plan.published_at!)}
            </span>
          ) : (
            <StatusChip kind={chip.kind} density="desk">
              {chip.text}
            </StatusChip>
          )}
          <p className="t-dense">{planSummary(board, depot)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {published ? (
            <p className="t-dense text-asphalt-700">Sent to the dock, the drivers and every store on these trips.</p>
          ) : (
            <>
              {helper ? (
                <span className={cx("t-caption", fleetChanged ? "text-attention" : "text-asphalt-500")}>{helper}</span>
              ) : null}
              {waits ? (
                <Button
                  density="desk"
                  variant="link"
                  iconAfter={ChevronRight}
                  onClick={onDrawer}
                  title="Open deferrals (D)"
                  aria-keyshortcuts="D"
                >
                  Review deferral{waits > 1 ? "s" : ""}
                </Button>
              ) : null}
              <Button
                density="desk"
                variant={fleetChanged ? "primary" : "secondary"}
                icon={RefreshCw}
                disabled={replanning}
                title="Propose again (P)"
                aria-keyshortcuts="P"
                onClick={onPropose}
              >
                {replanning ? "Planning" : "Propose again"}
              </Button>
              {view === "board" ? (
                <Button
                  density="desk"
                  variant={fleetChanged ? "secondary" : "primary"}
                  icon={Send}
                  disabled={Boolean(board.broken || unreasoned || replanning)}
                  title="Publish plan (Ctrl Enter)"
                  aria-keyshortcuts="Control+Enter"
                  onClick={() => onView("check")}
                >
                  Publish plan
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
      <Replanning active={replanning} />
      {proposeError && !replanning ? <p className="t-dense text-problem">{proposeError.message}</p> : null}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ the board
/** What a drag carries: the orders, how to name them, and the card the ghost draws. */
type DragData = Moving & { ghost: Ghost };
type Ghost = {
  outlet_id: string;
  short_name: string;
  order_ref: string;
  kind: string;
  units: number;
  weight_kg: number;
  volume_m3: number;
  window_open: string;
  window_close: string;
  chilled: boolean;
};

const NOT_PLACED = "not-placed";
const slotKey = (vehicleId: string, tripNo: number) => `${vehicleId}:${tripNo}`;

function parseSlot(id: string): { vehicle_id: string; trip_no: number } | null {
  const [vehicle_id, trip] = id.split(":");
  return vehicle_id && trip ? { vehicle_id, trip_no: Number(trip) } : null;
}

const isMoveKey = (event: ReactKeyboardEvent) =>
  event.code === "KeyM" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

/** A stop or an order card that can be picked up: by pointer, by Space or Enter with the arrow keys, or with M for
 *  the Trip picker. */
function useMovable(id: string, data: DragData, disabled: boolean, onPicker: (moving: Moving) => void) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data, disabled });
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!disabled && isMoveKey(event)) {
      event.preventDefault();
      onPicker({ refs: data.refs, label: data.label, from: data.from });
      return;
    }
    listeners?.onKeyDown?.(event);
  };
  return {
    setNodeRef,
    isDragging,
    handle: { ...attributes, ...listeners, onKeyDown, "aria-keyshortcuts": disabled ? undefined : "M" },
  };
}

const INSTRUCTIONS =
  "Press Space or Enter to pick up this order or stop. Move it over a trip with the arrow keys, then press Space " +
  "or Enter to drop it, or Esc to put it back. Press M for a list of trips instead.";

function Workspace({
  board,
  depot,
  onDrawer,
  busy,
}: {
  board: Board;
  depot: DepotName;
  onDrawer: () => void;
  busy: boolean;
}) {
  const move = useMove(depot, board.plan.id);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragData | null>(null);
  const [fits, setFits] = useState<Fit[] | null>(null);
  const [over, setOver] = useState<{ id: string; rect: ClientRect } | null>(null);
  const [picker, setPicker] = useState<Moving | null>(null);
  const [fleet, setFleet] = useState<Lane | null>(null);
  // the move on its way: the orders, where they go, and what Relay said that trip would carry
  const [pending, setPending] = useState<{ to: string; refs: string[]; fit: Fit | null } | null>(null);
  const asking = useRef<AbortController | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // a finger swipes to scroll the board, and a press and hold picks a card up
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const published = board.plan.status === "published";

  const lanes = board.lanes.filter(
    (l) => filter === "all" || (filter === "reefer" ? l.temp === "reefer" : l.temp === "ambient"),
  );
  // a vehicle sent to the workshop keeps its lane while trips are still on it, so its broken rule shows
  const running = lanes.filter((l) => l.status !== "workshop" || l.trips.length);
  const out = lanes.filter((l) => l.status === "workshop" && !l.trips.length);
  const allTrips = board.lanes.flatMap((l) => l.trips);
  const current =
    allTrips.find((t) => slotKey(t.vehicle_id, t.trip_no) === selected) ??
    allTrips.find((t) => t.broken > 0) ??
    allTrips[0] ??
    null;
  const currentKey = current ? slotKey(current.vehicle_id, current.trip_no) : null;

  const counts = useMemo(() => countLanes(board.lanes), [board.lanes]);

  // Ctrl Z undoes the last move on the board, as the shortcuts sheet lists; never while typing, and never once the
  // plan is published, when a change goes trip by trip instead.
  const { mutate: undoMove, isPending: undoing } = useUndo(depot, board.plan.id);
  const canUndo = board.can_undo && !published;
  useEffect(() => {
    if (!canUndo) return;
    const onKey = (event: KeyboardEvent) => {
      if (typingOrInDialog(event)) return;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (!undoing) undoMove(undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, undoMove, undoing]);

  const send = (input: MoveInput, fit: Fit | null, { focus = false } = {}) => {
    const to = input.vehicle_id && input.trip_no ? slotKey(input.vehicle_id, input.trip_no) : NOT_PLACED;
    if (to !== NOT_PLACED) setSelected(to);
    setPending({ to, refs: input.order_refs, fit });
    move.mutate(input, {
      onSettled: () => setPending(null),
      // a move made from the keyboard leaves focus on the trip it went to, ready for the next key
      onSuccess: () => {
        if (focus) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-slot="${to}"]`)?.focus());
      },
    });
  };

  // the Trip picker hands focus back to the stop or order it was opened from, when nothing moved
  const opener = useRef<HTMLElement | null>(null);
  const openPicker = (moving: Moving) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPicker(moving);
  };
  const closePicker = () => {
    setPicker(null);
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus();
    });
  };

  const endDrag = () => {
    asking.current?.abort();
    setDrag(null);
    setFits(null);
    setOver(null);
  };

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData;
    setDrag(data);
    setFits(null);
    asking.current?.abort();
    const ask = new AbortController();
    asking.current = ask;
    fetchFits(board.plan.id, data.refs, ask.signal).then(
      (answer) => {
        if (!ask.signal.aborted) setFits(answer);
      },
      () => undefined,
    );
  };
  const onDragOver = (event: DragOverEvent) => {
    setOver(event.over ? { id: String(event.over.id), rect: event.over.rect } : null);
  };
  const onDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as DragData;
    const target = event.over ? String(event.over.id) : null;
    const fit = target ? (fits?.find((f) => slotKey(f.vehicle_id, f.trip_no) === target) ?? null) : null;
    endDrag();
    if (!target) return;
    if (target === NOT_PLACED) {
      if (data.from) send({ order_refs: data.refs }, null);
      return;
    }
    const slot = parseSlot(target);
    if (!slot || (data.from && slotKey(data.from.vehicle_id, data.from.trip_no) === target)) return;
    send({ order_refs: data.refs, ...slot }, fit);
  };

  const fitFor = (id: string) => fits?.find((f) => slotKey(f.vehicle_id, f.trip_no) === id) ?? null;
  const overFit = over && over.id !== NOT_PLACED ? fitFor(over.id) : null;
  // a Not placed card held over Not placed needs no words; a stop held there is coming off its trip
  const tooltip =
    !drag || !over
      ? null
      : over.id === NOT_PLACED
        ? drag.from && notPlacedWords(drag.label, drag.from, board)
        : overFit && fitTooltip(overFit);

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelOf(active.data.current)}.`,
    onDragOver: ({ over: target }) => {
      if (!target) return "Over no trip.";
      const id = String(target.id);
      if (id === NOT_PLACED) return "Over Not placed.";
      const fit = fitFor(id);
      return fit ? fitTooltip(fit) : `Over ${id.replace(":", " trip ")}.`;
    },
    onDragEnd: ({ active, over: target }) =>
      target
        ? `Dropped ${labelOf(active.data.current)} on ${String(target.id) === NOT_PLACED ? "Not placed" : String(target.id).replace(":", " trip ")}. Relay checks every rule.`
        : `${labelOf(active.data.current)} stays where it was.`,
    onDragCancel: ({ active }) => `Move cancelled. ${labelOf(active.data.current)} stays where it was.`,
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
      // only the lanes (and the page, below the widest layout) scroll under a held card, never the window
      autoScroll={{ canScroll: (element) => element.hasAttribute("data-drag-scroll") }}
      accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
    >
      <div
        inert={busy}
        aria-busy={busy}
        className={cx("flex min-w-0 flex-col gap-4 xl:min-h-0 xl:flex-1", busy && "opacity-60")}
      >
        {move.error ? (
          <Notice tone="problem" compact role="alert">
            {move.error instanceof ApiError ? move.error.message : "The move did not go through."}
          </Notice>
        ) : null}
        <div className="grid min-w-0 gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[288px_minmax(0,1fr)_344px] xl:grid-rows-[minmax(0,1fr)]">
          <NotPlaced
            board={board}
            drag={drag}
            pending={pending}
            onDrawer={onDrawer}
            onPicker={openPicker}
            published={published}
          />
          <section className="flex min-w-0 flex-col overflow-hidden rounded-card border border-asphalt-200 bg-white xl:min-h-0">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-asphalt-200 px-4 py-2">
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
            <div data-drag-scroll className="max-h-[720px] overflow-y-auto xl:max-h-none xl:min-h-0 xl:flex-1">
              {running.map((lane) => (
                <LaneRow
                  key={lane.vehicle_id}
                  lane={lane}
                  selected={currentKey}
                  onSelect={setSelected}
                  fits={drag ? fits : null}
                  pending={pending}
                  published={published}
                  onFleet={setFleet}
                />
              ))}
              {out.length ? (
                <div className="flex flex-col gap-1 bg-asphalt-50 px-4 py-3">
                  {out.map((lane) => (
                    <div key={lane.vehicle_id} className="flex items-center gap-2 t-label text-asphalt-500">
                      <CircleAlert size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                      <p className="min-w-0 flex-1">
                        <span className="latin">{lane.vehicle_id}</span> · {vehicleKind(lane)} · {lane.note}
                      </p>
                      {!published ? <FleetButton lane={lane} onOpen={setFleet} /> : null}
                    </div>
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
              drag={drag}
              dropFit={drag && over?.id === currentKey ? overFit : null}
              onPicker={openPicker}
            />
          ) : (
            <section className="rounded-card border border-asphalt-200 bg-white p-4 t-dense text-asphalt-500">
              No trips on this plan yet.
            </section>
          )}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{drag ? <GhostCard ghost={drag.ghost} /> : null}</DragOverlay>
      {tooltip && over ? <DragTooltip rect={over.rect} text={tooltip} /> : null}
      <TripPicker
        planId={board.plan.id}
        moving={picker}
        lanes={board.lanes}
        onClose={closePicker}
        onPick={(input) => {
          setPicker(null);
          send(input, null, { focus: true });
        }}
      />
      <FleetDialog lane={fleet} depot={depot} runDate={board.plan.run_date} onClose={() => setFleet(null)} />
    </DndContext>
  );
}

const labelOf = (data: unknown) => (data as DragData | undefined)?.label ?? "the order";

function notPlacedWords(label: string, from: { vehicle_id: string; trip_no: number }, board: Board): string {
  const next = board.waiting[0]?.deferral?.to_date;
  return `Take ${label} off ${tripName(from)}. It waits${next ? ` for ${formatWeekday(dayOf(next))}` : ""} and needs a reason before you publish.`;
}

/** The dark tooltip right of the trip a card is held over (left of it when the window ends first). */
function DragTooltip({ rect, text }: { rect: ClientRect; text: string }) {
  const width = 280;
  const right = rect.left + rect.width + 12;
  const onRight = right + width <= window.innerWidth - 8;
  return (
    <div
      role="tooltip"
      style={{ left: onRight ? right : Math.max(8, rect.left - 12 - width), top: rect.top + rect.height / 2, width }}
      // above the drag ghost (999), which follows the pointer over the same trip
      className="pointer-events-none fixed z-[1000] -translate-y-1/2 rounded-button bg-asphalt-900 px-3 py-2 t-dense text-white shadow-float"
    >
      <span
        aria-hidden
        className={cx(
          "absolute top-1/2 size-2.5 -translate-y-1/2 rotate-45 bg-asphalt-900",
          onRight ? "-left-1" : "-right-1",
        )}
      />
      {text}
    </div>
  );
}

/** The card under the pointer while it moves: Order row / board card / dragging. */
function GhostCard({ ghost }: { ghost: Ghost }) {
  return (
    <div className="flex w-[264px] cursor-grabbing gap-1 rounded-button border-2 border-petrol-700 bg-white py-2 pr-3 pl-1 shadow-float">
      <GripVertical size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-asphalt-300" />
      <OrderLines ghost={ghost} />
    </div>
  );
}

function OrderLines({ ghost, children }: { ghost: Ghost; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <p className="t-dense-strong">
        <span className="latin">{ghost.outlet_id}</span> {ghost.short_name}
      </p>
      <p className="t-caption text-asphalt-500">
        <span className="latin num">{ghost.order_ref}</span> · {ghost.kind} · {ghost.units} cases
      </p>
      <p className="num t-caption text-asphalt-700">
        {kg(ghost.weight_kg)} · {m3(ghost.volume_m3)} · {formatWindow(ghost.window_open, ghost.window_close)}
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {ghost.chilled ? <StatusChip kind="chilled" density="desk" /> : null}
        {children}
      </div>
    </div>
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
  drag,
  pending,
  onDrawer,
  onPicker,
  published,
}: {
  board: Board;
  drag: DragData | null;
  pending: { to: string; refs: string[] } | null;
  onDrawer: () => void;
  onPicker: (moving: Moving) => void;
  published: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: NOT_PLACED, disabled: published });
  const [open, setOpen] = useState(true);
  const waiting = board.waiting;
  const chilled = waiting.filter((w) => w.temp === "chilled");
  const analysis = board.analyses.find((a) => a.temp_class === "chilled" && a.unavoidable > 0);
  const day = formatWeekday(dayOf(board.plan.run_date));
  const title = published ? "Deferred" : "Not placed";
  // a stop held over this column can come off its trip
  const takesStop = Boolean(drag?.from);

  return (
    <section
      ref={setNodeRef}
      className={cx(
        "flex flex-col gap-3 rounded-card border bg-white p-4 xl:min-h-0 xl:overflow-y-auto",
        isOver && takesStop ? "border-2 border-dashed border-petrol-700" : "border-asphalt-200",
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
            {noRoom(analysis?.limiting ?? [], waiting.length)}
          </p>
          <button
            type="button"
            onClick={onDrawer}
            className="mt-1 inline-flex min-h-8 items-center gap-1 t-label-strong text-petrol-700"
          >
            Review deferral{waiting.length > 1 ? "s" : ""}
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </Notice>
      ) : published && waiting.length ? (
        <Notice tone="info" compact>
          <p>
            {waiting.length} order{waiting.length > 1 ? "s" : ""} moved to{" "}
            {formatWeekday(dayOf(waiting[0]!.deferral?.to_date ?? board.plan.run_date))}. The store
            {waiting.length > 1 ? "s were" : " was"} told when the plan was published.
          </p>
          <button
            type="button"
            onClick={onDrawer}
            className="mt-1 inline-flex min-h-8 items-center gap-1 t-label-strong text-petrol-700"
          >
            Open the deferral record{waiting.length > 1 ? "s" : ""}
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </Notice>
      ) : !waiting.length && board.broken && !published ? (
        <Notice tone="info" compact>
          {everyOrderPlaced(board)}
        </Notice>
      ) : null}
      {waiting.map((w) => (
        <OrderCard
          key={w.order_ref}
          order={w}
          moving={Boolean(pending?.refs.includes(w.order_ref))}
          published={published}
          onPicker={onPicker}
        />
      ))}
      {isOver && takesStop && drag ? (
        <p className="flex min-h-[44px] items-center rounded-button border border-dashed border-asphalt-300 bg-asphalt-50 px-3 t-caption font-semibold text-asphalt-700">
          Drop to take {drag.label} off its trip
        </p>
      ) : null}
      <div className="h-px shrink-0 bg-asphalt-200" />
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
          Drag an order onto a trip, or press M on it. Relay checks every rule as you drop. Stores are told when you
          publish, not before.
        </p>
      ) : (
        <p className="mt-auto t-caption text-asphalt-500">Stores were told when you published {day}'s plan.</p>
      )}
    </section>
  );
}

function orderGhost(order: Waiting): Ghost {
  const chilled = order.temp === "chilled";
  return {
    outlet_id: order.outlet_id,
    short_name: order.short_name,
    order_ref: order.order_ref,
    kind: chilled ? "Fresh chilled" : order.brand === "Fresh" ? "Fresh dry" : order.brand,
    units: order.units,
    weight_kg: order.weight_kg,
    volume_m3: order.volume_m3,
    window_open: order.window_open,
    window_close: order.window_close,
    chilled,
  };
}

function OrderCard({
  order,
  moving,
  published,
  onPicker,
}: {
  order: Waiting;
  moving: boolean;
  published: boolean;
  onPicker: (moving: Moving) => void;
}) {
  const ghost = orderGhost(order);
  const data: DragData = {
    refs: [order.order_ref],
    label: `${order.outlet_id} ${order.short_name}`,
    from: null,
    ghost,
  };
  const { setNodeRef, isDragging, handle } = useMovable(`order:${order.order_ref}`, data, published, onPicker);
  if (isDragging || moving) {
    // the card's place while it moves: Not placed keeps its shape, and says what is on its way
    return (
      <div
        ref={setNodeRef}
        className="flex min-h-[92px] shrink-0 items-center justify-center rounded-button border border-dashed border-asphalt-300 bg-asphalt-50 t-caption font-semibold text-asphalt-700"
      >
        Moving <span className="latin num ml-1">{order.order_ref}</span>
      </div>
    );
  }
  return (
    <div
      ref={setNodeRef}
      {...(published ? {} : handle)}
      className={cx(
        "flex shrink-0 touch-manipulation gap-1 rounded-button border border-asphalt-200 bg-white py-2 pr-3 pl-1",
        "focus-visible:outline-2 focus-visible:outline-petrol-700",
        !published && "cursor-grab",
      )}
    >
      <GripVertical
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className={cx("mt-0.5 shrink-0 text-asphalt-300", published && "invisible")}
      />
      <OrderLines ghost={ghost}>
        {order.deferral ? (
          <StatusChip kind={published ? "deferred" : "toDefer"} density="desk">
            {published ? `Moved to ${formatWeekday(dayOf(order.deferral.to_date))}` : "To defer"}
          </StatusChip>
        ) : null}
        {published && order.deferral?.notified_at ? <SeenLine deferral={order.deferral} /> : null}
      </OrderLines>
    </div>
  );
}

/** On a deferred card once the plan is out: when the store saw the notice, as the deferral record says it. */
function SeenLine({ deferral }: { deferral: NonNullable<Waiting["deferral"]> }) {
  return deferral.acknowledged_at ? (
    <span className="inline-flex h-6 items-center gap-1 t-caption font-semibold text-done">
      <Eye size={16} strokeWidth={1.75} aria-hidden />
      Seen {formatTime(deferral.acknowledged_at)}
    </span>
  ) : (
    <span className="inline-flex h-6 items-center t-caption text-asphalt-500">Not seen yet</span>
  );
}

// ------------------------------------------------------------------------------------------------ lanes
function LaneRow({
  lane,
  selected,
  onSelect,
  fits,
  pending,
  published,
  onFleet,
}: {
  lane: Lane;
  selected: string | null;
  onSelect: (key: string) => void;
  fits: Fit[] | null;
  pending: { to: string; fit: Fit | null } | null;
  published: boolean;
  onFleet: (lane: Lane) => void;
}) {
  const reefer = lane.temp === "reefer";
  const Icon = lane.type === "van" ? Van : reefer ? Snowflake : Truck;
  // a group named for the vehicle, so a screen reader ties each trip card to the vehicle it is on
  return (
    // biome-ignore lint/a11y/useSemanticElements: a vehicle and its trip cards, not a set of form fields
    <div
      role="group"
      aria-label={`${lane.vehicle_id}, ${vehicleKind(lane)}, ${statusLabel(lane.status).toLowerCase()}`}
      className="flex flex-col gap-3 border-b border-asphalt-200 px-4 py-2 md:flex-row"
    >
      <div className="flex w-[132px] shrink-0 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-1">
          <p className="flex items-center gap-1.5 t-h3">
            <span className="latin">{lane.vehicle_id}</span>
            <Icon size={16} strokeWidth={1.75} aria-hidden className={reefer ? "text-chilled" : "text-asphalt-500"} />
          </p>
          {!published ? <FleetButton lane={lane} onOpen={onFleet} /> : null}
        </div>
        <p className="t-caption text-asphalt-700">{vehicleKind(lane)}</p>
        <p className="num t-caption text-asphalt-500">
          {numberFormat.format(lane.weight_cap_kg)} kg · {tenths(lane.volume_cap_m3)} m³
        </p>
        {lane.driver ? <p className="latin t-caption text-asphalt-500">{lane.driver}</p> : null}
        {lane.status === "workshop" ? (
          <StatusChip kind="workshop" density="desk" className="self-start">
            In the workshop
          </StatusChip>
        ) : null}
        <Meter
          size="fuel"
          measure="fuel"
          value={lane.fuel_week_l}
          limit={lane.fuel_quota_l}
          label={`${tenths(lane.fuel_week_l)} of ${numberFormat.format(lane.fuel_quota_l)} L`}
          title="Fuel this week"
          className="mt-1"
        />
      </div>
      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {[1, 2].map((n) => {
          const key = slotKey(lane.vehicle_id, n);
          const trip = lane.trips.find((t) => t.trip_no === n);
          const fit = fits?.find((f) => f.vehicle_id === lane.vehicle_id && f.trip_no === n) ?? null;
          const arriving = pending?.to === key ? pending : null;
          return trip ? (
            <TripCard
              key={n}
              trip={trip}
              lane={lane}
              selected={selected === key}
              onSelect={() => onSelect(key)}
              fit={fits ? fit : null}
              arriving={arriving}
              published={published}
            />
          ) : (
            <EmptySlot
              key={n}
              lane={lane}
              tripNo={n}
              fit={fits ? fit : null}
              arriving={Boolean(arriving)}
              published={published}
            />
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
  arriving,
  published,
}: {
  trip: PlanTrip;
  lane: Lane;
  selected: boolean;
  onSelect: () => void;
  fit: Fit | null;
  arriving: { fit: Fit | null } | null;
  published: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotKey(trip.vehicle_id, trip.trip_no), disabled: published });
  const broken = trip.broken > 0;
  const fresh = trip.brand === "Fresh";
  // the vehicle's day so far: this trip and the ones before it on the same budget
  const minutes = lane.trips
    .filter((t) => t.trip_no <= trip.trip_no && (t.brand === "Fresh") === fresh)
    .reduce((sum, t) => sum + t.std_minutes, 0);
  // while a move is on its way, the meters already show what Relay said the trip would carry
  const weight = arriving?.fit?.weight_kg ?? trip.weight_kg;
  const volume = arriving?.fit?.volume_m3 ?? trip.volume_m3;
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-slot={slotKey(trip.vehicle_id, trip.trip_no)}
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        "flex min-h-[112px] min-w-0 flex-col gap-1 rounded-card px-3 py-2 text-left",
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
          <TriangleAlert size={16} strokeWidth={1.75} aria-label="Rule broken" className="shrink-0 text-problem" />
        ) : (
          <CircleCheck size={16} strokeWidth={1.75} aria-label="All rules pass" className="shrink-0 text-done" />
        )}
      </span>
      {arriving ? (
        <Checking />
      ) : fit ? (
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
        value={weight}
        limit={lane.weight_cap_kg}
        label={`${kgValue(weight)} of ${numberFormat.format(lane.weight_cap_kg)}`}
        title="Weight, kg"
      />
      <Meter
        measure="volume"
        value={volume}
        limit={lane.volume_cap_m3}
        label={`${m3Value(volume)} of ${tenths(lane.volume_cap_m3)}`}
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

function Checking() {
  return (
    <span className="inline-flex items-center gap-1 t-caption font-semibold text-asphalt-700" role="status">
      <RefreshCw size={16} strokeWidth={1.75} aria-hidden className="animate-spin motion-reduce:animate-none" />
      Checking every rule
    </span>
  );
}

function EmptySlot({
  lane,
  tripNo,
  fit,
  arriving,
  published,
}: {
  lane: Lane;
  tripNo: number;
  fit: Fit | null;
  arriving: boolean;
  published: boolean;
}) {
  const canDrop = lane.status !== "workshop" && (tripNo === 1 || lane.trips.length >= 1);
  const { setNodeRef, isOver } = useDroppable({
    id: slotKey(lane.vehicle_id, tripNo),
    disabled: published || !canDrop,
  });
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
      {arriving ? (
        <Checking />
      ) : fit ? (
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
  if (fit.current) return <span className="t-caption font-semibold text-asphalt-500">On it now</span>;
  return fit.fits ? (
    <span className="inline-flex items-center gap-1 t-caption font-semibold text-done">
      <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
      Fits
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 t-caption font-semibold text-problem">
      <TriangleAlert size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
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

function TripDetail({
  trip,
  lane,
  depot,
  board,
  drag,
  dropFit,
  onPicker,
}: {
  trip: PlanTrip;
  lane: Lane;
  depot: DepotName;
  board: Board;
  drag: DragData | null;
  /** The trip is held under a card that comes from elsewhere: where it would stop. */
  dropFit: Fit | null;
  onPicker: (moving: Moving) => void;
}) {
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
  const incoming = dropFit && drag && !dropFit.current ? { at: dropFit.stop, label: drag.ghost.outlet_id } : null;
  const rows: ({ stop: PlanStop; n: number } | { drop: string; n: number })[] = trip.stops.map((stop, i) => ({
    stop,
    n: i + 1,
  }));
  if (incoming) {
    // the stop the held card would become, and every stop after it one place later
    const at = Math.min(Math.max(incoming.at, 1), rows.length + 1);
    rows.splice(at - 1, 0, { drop: incoming.label, n: at });
    rows.forEach((row, i) => {
      row.n = i + 1;
    });
  }
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-card border border-asphalt-200 bg-white p-4 xl:min-h-0 xl:overflow-y-auto">
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
            board.can_undo && !published ? (
              <Button
                density="desk"
                variant="primary"
                icon={Undo2}
                onClick={() => undo.mutate(undefined)}
                title="Undo move (Ctrl Z)"
                aria-keyshortcuts="Control+Z"
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
          label={`${kgValue(trip.weight_kg)} of ${numberFormat.format(lane.weight_cap_kg)} kg`}
          caption={freeKg >= 0 ? `${kg(freeKg)} free` : `${kg(-freeKg)} over`}
        />
        <Meter
          size="full"
          measure="volume"
          title="Volume"
          value={trip.volume_m3}
          limit={lane.volume_cap_m3}
          label={`${m3Value(trip.volume_m3)} of ${tenths(lane.volume_cap_m3)} m³`}
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
          label={`${tenths(lane.fuel_week_l)} of ${numberFormat.format(lane.fuel_quota_l)} L`}
          caption={`${tenths(lane.fuel_quota_l - lane.fuel_week_l)} L left this week`}
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
            {trip.load_locked
              ? "Loaded at the dock in this order, so the stop order stays."
              : "Published. Move a stop earlier and Relay shows the cost before the dock, the driver and the stores are told."}
          </p>
        ) : !published ? (
          <p className="t-caption text-asphalt-500">Drag a stop to another trip, or press M on it.</p>
        ) : null}
        <ol className="mt-1 flex flex-col">
          {rows.map((row) =>
            "drop" in row ? (
              <li
                key="drop"
                className="my-0.5 flex min-h-[44px] items-center gap-2 rounded-button border border-dashed border-asphalt-300 bg-asphalt-50 px-1"
              >
                <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-white t-label-strong text-asphalt-700">
                  {row.n}
                </span>
                <span className="t-caption font-semibold text-asphalt-700">
                  Drop to add <span className="latin">{row.drop}</span> as stop {row.n}
                </span>
              </li>
            ) : (
              <StopRow
                key={row.stop.order_ref}
                stop={row.stop}
                n={row.n}
                trip={trip}
                published={published}
                onPicker={onPicker}
                onEarlier={published && !trip.load_locked && trip.stops.length > 1 ? moveEarlier : null}
              />
            ),
          )}
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

/** One stop of the selected trip. On a draft it moves: dragging it, or M, takes every order of that store on the
 *  trip. On a published trip it can only move earlier, with the cost shown first. */
function StopRow({
  stop,
  n,
  trip,
  published,
  onPicker,
  onEarlier,
}: {
  stop: PlanStop;
  n: number;
  trip: PlanTrip;
  published: boolean;
  onPicker: (moving: Moving) => void;
  onEarlier: ((index: number) => void) | null;
}) {
  const late = stop.planned.slice(11, 16) > stop.window_close;
  const access = ACCESS[stop.dock_type] ?? ACCESS.rear_dock!;
  const AccessIcon = access.icon;
  const together = trip.stops.filter((s) => s.outlet_id === stop.outlet_id);
  const data: DragData = {
    refs: together.map((s) => s.order_ref),
    label: `${stop.outlet_id} ${stop.short_name}`,
    from: { vehicle_id: trip.vehicle_id, trip_no: trip.trip_no },
    ghost: {
      outlet_id: stop.outlet_id,
      short_name: stop.short_name,
      order_ref: together.map((s) => s.order_ref).join(", "),
      kind: trip.temp === "chilled" ? "Fresh chilled" : trip.brand === "Fresh" ? "Fresh dry" : trip.brand,
      units: together.reduce((sum, s) => sum + s.units, 0),
      weight_kg: together.reduce((sum, s) => sum + s.weight_kg, 0),
      volume_m3: together.reduce((sum, s) => sum + s.volume_m3, 0),
      window_open: stop.window_open,
      window_close: stop.window_close,
      chilled: trip.temp === "chilled",
    },
  };
  const { setNodeRef, isDragging, handle } = useMovable(
    `stop:${trip.vehicle_id}:${trip.trip_no}:${stop.order_ref}`,
    data,
    published,
    onPicker,
  );
  if (isDragging) {
    return (
      <li>
        <div
          ref={setNodeRef}
          className="my-0.5 flex min-h-[44px] items-center rounded-button border border-dashed border-asphalt-300 bg-asphalt-50 px-3 t-caption font-semibold text-asphalt-700"
        >
          Moving <span className="latin mx-1">{stop.outlet_id}</span> {stop.short_name}
        </div>
      </li>
    );
  }
  // the list item stays a list item; the row inside it is what picks up
  return (
    <li>
      <div
        ref={setNodeRef}
        {...(published ? {} : handle)}
        className={cx(
          "flex min-h-[44px] touch-manipulation items-center gap-2 rounded-button py-1.5",
          late ? "bg-problem-soft px-1" : "px-1",
          !published && "cursor-grab hover:bg-asphalt-50 focus-visible:outline-2 focus-visible:outline-petrol-700",
        )}
      >
        {!published ? (
          <GripVertical size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-300" />
        ) : null}
        <span
          className={cx(
            "num flex size-6 shrink-0 items-center justify-center rounded-full t-label-strong",
            late ? "bg-problem text-white" : "bg-asphalt-100 text-asphalt-900",
          )}
        >
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cx("t-dense-strong", late && "text-problem")}>
            <span className="latin">{stop.outlet_id}</span> {stop.short_name}
          </p>
          <p className="flex items-center gap-1 t-caption text-asphalt-500">
            <AccessIcon size={14} strokeWidth={1.75} aria-hidden />
            {access.word} · {formatWindow(stop.window_open, stop.window_close)}
          </p>
        </div>
        <span className={cx("num t-label", late && "text-problem")}>{formatTime(stop.planned)}</span>
        {onEarlier ? (
          n > 1 ? (
            <IconButton
              icon={ArrowUp}
              density="desk"
              label={`Move ${stop.short_name} earlier, to stop ${n - 1}`}
              onClick={() => onEarlier(n - 1)}
            />
          ) : (
            <span className="size-8 shrink-0" />
          )
        ) : null}
      </div>
    </li>
  );
}
