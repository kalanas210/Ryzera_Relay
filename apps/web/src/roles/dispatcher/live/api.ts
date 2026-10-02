import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiError, api } from "@/api/client";
import type { Board } from "../plan/api";

export type ShortfallDetail = {
  id: string;
  kind: "missing" | "damaged";
  qty: number;
  planned: number;
  case_type: string;
  case_name: string;
  temp_label: string;
  vehicle_id: string;
  trip_no: number;
  stop_seq: number;
  order_ref: string;
  outlet_id: string;
  place: string;
  flagged_at: string;
  flagged_by: string | null;
  /** The run the load is for, the day a carried-over order is marked from. */
  run_date: string;
  departs: string;
  trip_stops: number;
  driver: string | null;
  stop_cases: number;
  next_order_ref: string | null;
  next_day: string | null;
  window: string;
  store_contact: string | null;
  decision: "send_short" | "no_replacement" | null;
  decided_at: string | null;
  decided_by: string | null;
  added_to_order_ref: string | null;
  store_seen_at: string | null;
  completed_at: string | null;
  loaded_cases: number;
  planned_cases: number;
  accepted_at: string | null;
  accepted_by: string | null;
  /** Spare cases of this type at the hub for the run, when Relay knows the hub's stock of it. */
  hub_spare: number | null;
  /** When the supplier's next drop of this case type reaches the hub. */
  next_delivery_at: string | null;
  /** A photo of damaged cases from the dock. */
  photo_id: string | null;
};

export type FeedKind =
  | "shortfall"
  | "delay"
  | "failed_stop"
  | "problem"
  | "dispute"
  | "silence"
  | "conflict"
  | "back_in_contact"
  | "stop_moved"
  | "receipt";

export type FeedItem = {
  id: string;
  kind: FeedKind;
  depot: string;
  title: string;
  body: string;
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
  outcome: string;
  shortfall: ShortfallDetail | null;
  /** What the item is about (trip_id, stop_id, conflict_id, backup_trip_id, and on a two-copy item the driver's own
   *  records for the stop: arrived_at, delivered_at, receiver, photo_id). */
  ref?: Record<string, string | null>;
};

export type Feed = {
  depot: "Kandy" | "Peliyagoda";
  depot_label: string;
  run_date: string;
  now: FeedItem[];
  earlier: FeedItem[];
};

export type MarkerState = "delivered" | "arrived" | "failed" | "moved" | "conflict" | "cancelled" | "next" | "pending";

/** One stop on a run's track: what the driver recorded, or Relay's estimate from the last record. */
export type RunMarker = {
  stop_id: string;
  seq: number;
  outlet_id: string;
  place: string;
  state: MarkerState;
  planned: string;
  closes: string;
  recorded: string | null;
  /** Rounded to 5 minutes; null once the stop is done. */
  estimate: string | null;
  /** The likely range, only while the driver is out of contact. */
  range: [string, string] | null;
  /** The estimate has gone by with no word. It is never pushed later. */
  passed: boolean;
  /** The estimate itself is after the store's close. */
  late_risk: boolean;
  receipt_at: string | null;
  /** The vehicle a backup copy of this stop is on. */
  moved_to: string | null;
  /** On a backup trip: the stop this one copies. */
  backup_of: string | null;
  /** While the stop has two copies: when the driver's phone says it was delivered, held until it is settled. */
  held: string | null;
};

export type RunRow = {
  trip_id: string;
  vehicle_id: string;
  trip_no: number;
  is_backup: boolean;
  vehicle_kind: string;
  driver: string | null;
  district: string;
  temp: "ambient" | "chilled";
  brand: string;
  status: string;
  planned_depart: string;
  departed_at: string | null;
  finished_at: string | null;
  /** The last time the driver's phone reached Relay, from a check-in or a record. */
  last_contact_at: string | null;
  out_of_contact: boolean;
  silent_minutes: number;
  position: string;
  caption: string;
  delivered: number;
  stops: number;
  /** 0 nothing, 1 watch, 2 needs the dispatcher. */
  attention: number;
  markers: RunMarker[];
};

export type RunsPanel = {
  depot: "Kandy" | "Peliyagoda";
  depot_label: string;
  run_date: string;
  published: boolean;
  now: string;
  running: number;
  delivered: number;
  stops: number;
  out_of_contact: number;
  standby_free: number;
  standby: string[];
  rows: RunRow[];
};

/** A vehicle that could take a stop now, with the hard rules it breaks and the checks it passes. */
export type MoveOption = {
  vehicle_id: string;
  vehicle_kind: string;
  driver: string | null;
  status: "standby" | "available" | "busy";
  departs: string;
  /** Expected, to the minute. */
  arrives: string;
  closes: string;
  fits: boolean;
  blocked: string[];
  checks: string[];
  weight_kg: number;
  volume_m3: number;
  weight_cap_kg: number;
  volume_cap_m3: number;
};

export type Depot = "Kandy" | "Peliyagoda";

const role = "dispatcher" as const;
/** Live views poll between 10 and 15 seconds, so minutes and estimates never go stale on the desk. */
const POLL = 10_000;

export function useFeed(depot: Depot) {
  return useQuery({
    queryKey: ["feed", depot],
    queryFn: ({ signal }) => api.get<Feed>(`/api/dispatch/live/feed?depot=${depot}`, { role, signal }),
    refetchInterval: POLL,
  });
}

export function useRuns(depot: Depot) {
  return useQuery({
    queryKey: ["runs", depot],
    queryFn: ({ signal }) => api.get<RunsPanel>(`/api/dispatch/live/runs?depot=${depot}`, { role, signal }),
    refetchInterval: POLL,
  });
}

/** The published plan, read for what the runs panel does not carry: drivers of standby vehicles, the workshop, and
 *  each stop's order, store name, access and window. Shares its cache with the plan board. */
export function usePlanDirectory(depot: Depot) {
  return useQuery({
    queryKey: ["plan", depot],
    queryFn: ({ signal }) => api.get<Board>(`/api/dispatch/plan?depot=${depot}`, { role, signal }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useMoveOptions(stopId: string | null) {
  return useQuery({
    queryKey: ["move-options", stopId],
    queryFn: ({ signal }) => api.get<MoveOption[]>(`/api/dispatch/live/stops/${stopId}/move-options`, { role, signal }),
    enabled: stopId !== null,
    staleTime: 0,
  });
}

export function useDecide(depot: Depot) {
  const client = useQueryClient();
  return useMutation<Feed, ApiError, { shortfallId: string; decision: "send_short" | "no_replacement" }>({
    mutationFn: ({ shortfallId, decision }) =>
      api.post<Feed>(`/api/dispatch/live/shortfalls/${shortfallId}/decide`, { decision }, { role }),
    onSuccess: (feed) => client.setQueryData(["feed", depot], feed),
  });
}

/** After a change on the desk the panel comes back with the answer; the feed and the plan follow on their own. */
function useLiveChange<T>(depot: Depot, send: (input: T) => Promise<RunsPanel | undefined>) {
  const client = useQueryClient();
  return useMutation<RunsPanel | undefined, ApiError, T>({
    mutationFn: send,
    onSuccess: (panel) => {
      if (panel) client.setQueryData(["runs", depot], panel);
      void client.invalidateQueries({ queryKey: ["feed", depot] });
      void client.invalidateQueries({ queryKey: ["runs", depot] });
      void client.invalidateQueries({ queryKey: ["plan", depot] });
    },
  });
}

export function useMove(depot: Depot) {
  return useLiveChange<{ stopId: string; vehicle_id: string; reason: string }>(depot, async (input) => {
    const out = await api.post<{ backup_trip_id: string; panel: RunsPanel }>(
      `/api/dispatch/live/stops/${input.stopId}/move`,
      { vehicle_id: input.vehicle_id, reason: input.reason },
      { role },
    );
    return out.panel;
  });
}

export function useBackupDecision(depot: Depot) {
  return useLiveChange<{ itemId: string; action: "keep" | "cancel"; note: string }>(depot, (input) =>
    api.post<RunsPanel>(
      `/api/dispatch/live/feed/${input.itemId}/backup`,
      { action: input.action, note: input.note },
      { role },
    ),
  );
}

export function useSettle(depot: Depot) {
  return useLiveChange<{ conflictId: string }>(depot, (input) =>
    api.post<RunsPanel>(`/api/dispatch/live/conflicts/${input.conflictId}/settle`, {}, { role }),
  );
}

export function useHandle(depot: Depot) {
  return useLiveChange<{ itemId: string; note?: string }>(depot, async (input) => {
    await api.post<void>(`/api/dispatch/live/feed/${input.itemId}/handle`, { note: input.note ?? "" }, { role });
    return undefined;
  });
}
