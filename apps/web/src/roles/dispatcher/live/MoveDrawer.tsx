import { Check, Info, TriangleAlert } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { Button } from "@/design/Button";
import { Meter } from "@/design/Meter";
import { Notice } from "@/design/Notice";
import { Sheet } from "@/design/Sheet";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { formatTime, formatWindow, kg, m3, numberFormat, roundTo5 } from "@/lib/time";
import { type Depot, type MoveOption, type RunMarker, type RunRow, useMove, useMoveOptions } from "./api";
import { accessWords, type Directory, driverName } from "./model";
import { EstimateMark } from "./Runs";

export type MoveTarget = { row: RunRow; marker: RunMarker };

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** DEG-03 move drawer: send one stop of a running trip with another vehicle. Relay checks every vehicle against the
 *  plan's rules and says what the move costs before anything is sent; the reason is kept on the record. The drawer
 *  has no scrim, so the silent run stays readable behind it. */
export function MoveDrawer({
  target,
  depot,
  depotLabel,
  dir,
  onClose,
  onMoved,
}: {
  target: MoveTarget | null;
  depot: Depot;
  depotLabel: string;
  dir: Directory;
  onClose: () => void;
  onMoved: (message: string) => void;
}) {
  const stopId = target?.marker.stop_id ?? null;
  const options = useMoveOptions(stopId);
  const move = useMove(depot);
  const [choice, setChoice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [everyVehicle, setEveryVehicle] = useState(false);
  const reasonId = useId();
  const reset = move.reset;

  // A new stop starts a new move.
  useEffect(() => {
    if (stopId === null) return;
    setChoice(null);
    setReason("");
    setEveryVehicle(false);
    reset();
  }, [stopId, reset]);

  // A drawer without a scrim is not modal, so Esc is caught here.
  useEffect(() => {
    if (!target) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  const list = options.data ?? [];
  const fitting = list.filter((o) => o.fits);
  const blocked = list.filter((o) => !o.fits);
  const chosen = list.find((o) => o.vehicle_id === (choice ?? fitting[0]?.vehicle_id));
  const row = target?.row;
  const marker = target?.marker;
  const first = row ? driverName(row) : "";
  const stop = row && marker ? dir.stop(row, marker.outlet_id) : undefined;
  const silent = !!row?.out_of_contact;
  const ready = !!chosen?.fits && reason.trim().length >= 3 && !move.isPending;

  const submit = () => {
    if (!row || !marker || !chosen || !ready) return;
    move.mutate(
      { stopId: marker.stop_id, vehicle_id: chosen.vehicle_id, reason: reason.trim() },
      {
        onSuccess: () => {
          const driver = calledName(chosen.driver);
          onMoved(
            `Stop ${marker.seq} moved to ${chosen.vehicle_id}. ${driver ? `${driver}, the` : "The"} ${depotLabel} dock and the store have been told.`,
          );
          onClose();
        },
      },
    );
  };

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      variant="drawer"
      modal={false}
      width={480}
      title={marker ? `Move stop ${marker.seq} to another vehicle` : "Move a stop"}
      meta={
        row ? (
          <span className="latin">
            {row.vehicle_id}
            {row.driver ? ` · ${row.driver}` : ""} ·{" "}
            {silent && row.last_contact_at
              ? `no contact since ${formatTime(row.last_contact_at)}`
              : row.last_contact_at
                ? `synced ${formatTime(row.last_contact_at)}`
                : "on the road"}
          </span>
        ) : null
      }
      footer={
        row && marker ? (
          <div className="flex flex-col gap-3">
            {chosen?.fits ? (
              <p className="t-label text-asphalt-700">
                {calledName(chosen.driver) || chosen.vehicle_id}, the {depotLabel} dock and {stop?.name ?? marker.place}{" "}
                are told now. {first} {silent ? "sees the change when the phone reconnects." : "is told now too."}
              </p>
            ) : null}
            {move.error ? <p className="t-dense text-problem">{move.error.message}</p> : null}
            <div className="flex justify-end gap-2">
              <Button density="desk" variant="quiet" onClick={onClose}>
                Cancel
              </Button>
              <Button density="desk" variant="primary" disabled={!ready} onClick={submit}>
                {move.isPending
                  ? "Moving the stop"
                  : chosen
                    ? `Move stop ${marker.seq} to ${chosen.vehicle_id}`
                    : `Move stop ${marker.seq}`}
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      {row && marker ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5 rounded-button bg-asphalt-50 p-3">
            <p className="t-dense-strong">
              Stop {marker.seq} · {stop?.name ?? marker.place} (<span className="latin">{marker.outlet_id}</span>)
            </p>
            <p className="latin num t-dense">
              {[
                stop?.order_ref,
                row.temp === "chilled" ? "Chilled" : "Dry",
                loadCases(list, stop?.units),
                list[0] ? kg(list[0].weight_kg) : stop ? kg(stop.weight_kg) : null,
                list[0] ? m3(list[0].volume_m3) : stop ? m3(stop.volume_m3) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="t-label text-asphalt-700">
              {[
                accessWords(stop?.dock_type),
                stop
                  ? `Window ${formatWindow(stop.window_open, stop.window_close)}`
                  : `Closes ${formatTime(marker.closes)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 t-label text-asphalt-500">Move to</legend>
            <div className="flex min-h-12 items-center gap-3 rounded-button border border-asphalt-200 px-3 py-2">
              <EstimateMark size={20} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="latin t-dense-strong">
                  {row.vehicle_id}
                  {row.driver ? ` · ${row.driver}` : ""}
                </span>
                <span className="t-caption text-asphalt-700">
                  {dir.vehicle(row.vehicle_id, row.vehicle_kind)} ·{" "}
                  {silent && row.last_contact_at
                    ? `no contact since ${formatTime(row.last_contact_at)} · estimate`
                    : "has this stop now"}
                </span>
              </span>
              {marker.estimate ? (
                <span className="num shrink-0 t-label text-asphalt-700">Around {formatTime(marker.estimate)}</span>
              ) : null}
            </div>
            {options.isPending ? (
              <p className="t-dense text-asphalt-500" role="status">
                Checking every {depotLabel} vehicle against the plan's rules
              </p>
            ) : null}
            {options.error ? <p className="t-dense text-problem">{options.error.message}</p> : null}
            {(everyVehicle ? fitting : fitting.slice(0, 4)).map((o) => (
              <label
                key={o.vehicle_id}
                className={cx(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-button px-3 py-2",
                  o === chosen
                    ? "border-[1.5px] border-petrol-700 bg-petrol-50"
                    : "border border-asphalt-200 hover:bg-asphalt-50",
                )}
              >
                <input
                  type="radio"
                  name="move-to"
                  value={o.vehicle_id}
                  checked={o === chosen}
                  onChange={() => setChoice(o.vehicle_id)}
                  className="size-4 shrink-0"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="latin t-dense-strong">
                    {o.vehicle_id}
                    {o.driver ? ` · ${o.driver}` : ""}
                  </span>
                  <span className="t-caption text-asphalt-700">
                    {dir.vehicle(o.vehicle_id, o.vehicle_kind)} · {statusWords(o, dir)}
                  </span>
                </span>
                <span className="num shrink-0 t-label text-asphalt-700">
                  Arrives around {formatTime(roundTo5(o.arrives))}
                </span>
              </label>
            ))}
            {(everyVehicle ? blocked : blocked.slice(0, 2)).map((o) => (
              <div
                key={o.vehicle_id}
                className="flex min-h-12 items-center gap-3 rounded-button bg-asphalt-50 px-3 py-2"
              >
                <TriangleAlert size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-problem" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="latin t-dense-strong">
                    {o.vehicle_id}
                    {o.driver ? ` · ${o.driver}` : ""}
                  </span>
                  <span className="t-caption text-asphalt-700">
                    {dir.vehicle(o.vehicle_id, o.vehicle_kind)}. {o.blocked.join(" ")}
                  </span>
                </span>
                <span className="shrink-0 t-label text-asphalt-500">Not suitable</span>
              </div>
            ))}
            {list.length > Math.min(fitting.length, 4) + Math.min(blocked.length, 2) ? (
              <Button
                density="desk"
                variant="link"
                className="self-start px-2"
                onClick={() => setEveryVehicle((v) => !v)}
              >
                {everyVehicle ? "Show fewer vehicles" : `Show all ${list.length} vehicles`}
              </Button>
            ) : null}
            {!options.isPending && list.length && !fitting.length ? (
              <Notice tone="problem" compact>
                No {depotLabel} vehicle can take this stop now.
              </Notice>
            ) : null}
          </fieldset>

          {chosen?.fits ? <Checks option={chosen} row={row} marker={marker} dir={dir} depotLabel={depotLabel} /> : null}

          {silent && chosen ? (
            <Notice tone="attention" title={`${first} won't see this until the phone reconnects.`}>
              If {first} delivers stop {marker.seq} first, Relay asks {first} to confirm and cancels {chosen.vehicle_id}
              's copy.
            </Notice>
          ) : null}

          <div className="flex flex-col gap-1">
            <label htmlFor={reasonId} className="t-label-strong">
              Reason (required)
            </label>
            <textarea
              id={reasonId}
              aria-describedby={`${reasonId}-note`}
              required
              value={reason}
              rows={3}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                silent
                  ? `For example: No contact from ${first} for ${row.silent_minutes} minutes.`
                  : "Why the stop moves, for the record"
              }
              className="rounded-button border border-asphalt-300 bg-white px-3 py-2 t-dense text-asphalt-900"
            />
            <span id={`${reasonId}-note`} className="t-caption text-asphalt-500">
              Kept on the record with the move.
            </span>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

/** "86 cases": what is on the truck for the stop, as the dock loaded it. */
function loadCases(options: MoveOption[], planned: number | undefined): string | null {
  const loaded = Number(options[0]?.checks.find((c) => /^\d+ cases?,/.test(c))?.match(/^(\d+)/)?.[1]);
  const cases = loaded || planned;
  return cases ? `${cases} ${cases === 1 ? "case" : "cases"}` : null;
}

/** What the vehicle is doing today, in the dispatcher's words: "standby, free until 8:00 AM on Wednesday". */
function statusWords(option: MoveOption, dir: Directory): string {
  const lane = dir.lane(option.vehicle_id);
  // "standby, free until 8:00 AM": the day is today's, so the picker row keeps to one line
  if (option.status === "standby")
    return lane?.note ? lowerFirst(lane.note).replace(/ on [A-Z][a-z]+day$/, "") : "standby";
  if (lane && !lane.trips.length) return "free, not on today's plan";
  return "free now";
}

function Rule({ tone, children }: { tone: "pass" | "info" | "problem"; children: ReactNode }) {
  if (tone === "pass") {
    return (
      <p className="flex items-start gap-2 t-dense">
        <Check size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-done" />
        <span>{children}</span>
      </p>
    );
  }
  const Icon = tone === "problem" ? TriangleAlert : Info;
  return (
    <p
      className={cx(
        "flex items-start gap-2 rounded-button px-3 py-2 t-dense",
        tone === "problem" ? "bg-problem-soft" : "bg-asphalt-50",
      )}
    >
      <Icon
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className={cx("mt-0.5 shrink-0", tone === "problem" ? "text-problem" : "text-asphalt-700")}
      />
      <span>{children}</span>
    </p>
  );
}

/** Checks for the chosen vehicle: the window first, then the hard rules it passes, its room, and the new pick. */
function Checks({
  option,
  row,
  marker,
  dir,
  depotLabel,
}: {
  option: MoveOption;
  row: RunRow;
  marker: RunMarker;
  dir: Directory;
  depotLabel: string;
}) {
  const first = driverName(row);
  const stop = dir.stop(row, marker.outlet_id);
  const arrives = roundTo5(option.arrives);
  const late = Date.parse(option.arrives) > Date.parse(option.closes);
  const behind = marker.estimate ? Math.round((arrives.getTime() - Date.parse(marker.estimate)) / 60_000) : 0;
  const before = Math.round((Date.parse(option.closes) - Date.parse(option.arrives)) / 60_000);
  const lane = dir.lane(option.vehicle_id);
  const trip = (lane?.trips.length ?? 0) + 1;
  const vehicle = dir.vehicle(option.vehicle_id, option.vehicle_kind);
  const access = accessWords(stop?.dock_type);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="t-label text-asphalt-500">
        Checks for <span className="latin">{option.vehicle_id}</span>, trip {trip}
      </h3>
      {late ? (
        <>
          <Rule tone="problem">
            Arrives around {formatTime(arrives)}, after {marker.place}'s {formatTime(option.closes)} close
            {behind > 0 ? ` and about ${behind} minutes after ${first}'s estimate` : ""}.
          </Rule>
          <Rule tone="info">
            Still worth sending as a backup: if {first} is stuck, a late delivery still stocks {marker.place}'s shelves
            this morning.
          </Rule>
        </>
      ) : (
        <Rule tone="pass">
          Arrives around {formatTime(arrives)}, {before} min before {marker.place}'s {formatTime(option.closes)} close.
        </Rule>
      )}
      <Rule tone="pass">
        {row.temp === "chilled" ? "Chilled" : "Dry"} order, {lowerFirst(vehicle)}
      </Rule>
      <Rule tone="pass">{depotLabel} vehicle and outlet</Rule>
      {access ? (
        <Rule tone="pass">
          {access} at {marker.place}, and {option.vehicle_id} can unload there
        </Rule>
      ) : null}
      {option.status === "standby" ? (
        <Rule tone="pass">The hub's standby, kept free for problems like this</Rule>
      ) : null}
      <div className="grid grid-cols-2 gap-3 py-1">
        <Meter
          size="full"
          measure="weight"
          title="Weight"
          value={option.weight_kg}
          limit={option.weight_cap_kg}
          label={`${kg(option.weight_kg).replace(" kg", "")} of ${numberFormat.format(option.weight_cap_kg)} kg`}
        />
        <Meter
          size="full"
          measure="volume"
          title="Volume"
          value={option.volume_m3}
          limit={option.volume_cap_m3}
          label={`${m3(option.volume_m3).replace(" m³", "")} of ${option.volume_cap_m3.toFixed(1)} m³`}
        />
      </div>
      <Rule tone="info">
        The goods are on {row.vehicle_id}, so {option.vehicle_id} takes a new pick
        {stop ? ` of ${stop.order_ref}` : ""} at the {depotLabel} dock and leaves around{" "}
        {formatTime(roundTo5(option.departs))}. The dock flags any shortfall before it leaves.
      </Rule>
    </section>
  );
}
