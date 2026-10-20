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
  // The run the load is for. A carried-over order is marked from this day.
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
  // Null when Relay does not know the hub's stock of this case type.
  hub_spare: number | null;
  next_delivery_at: string | null;
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
  reviewed_at: string | null;
  reviewed_by: string | null;
  shortfall: ShortfallDetail | null;
  // Ids of what the item is about (trip_id, stop_id, conflict_id, backup_trip_id). A two-copy item
  // also has the driver's own records for the stop (arrived_at, delivered_at, receiver, photo_id).
  // Once settled, resolution says whose copy stands, "driver", "dispatcher" or "backup".
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

export type RunMarker = {
  stop_id: string;
  seq: number;
  outlet_id: string;
  place: string;
  state: MarkerState;
  planned: string;
  closes: string;
  recorded: string | null;
  // To the minute while the phone is in contact. While silent, the time the store reads, to 5 minutes.
  estimate: string | null;
  range: [string, string] | null;
  // The estimate has gone by with no word. It is never pushed later.
  passed: boolean;
  late_risk: boolean;
  receipt_at: string | null;
  moved_to: string | null;
  backup_of: string | null;
  // While the stop has two copies, when the driver's phone says it was delivered. Held until settled.
  held: string | null;
  // The driver answered no, so the delivery the phone holds was not made.
  denied: boolean;
  store_contact: string | null;
  // A moved stop that is the backup's alone, after the two-copy question was settled for the backup.
  handed_over: boolean;
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
  // When the driver tapped Finish trip, often at the last store's dock. Never read as back at the hub.
  finished_at: string | null;
  expected_back: string | null;
  last_contact_at: string | null;
  out_of_contact: boolean;
  silent_minutes: number;
  position: string;
  caption: string;
  risk: string;
  delivered: number;
  stops: number;
  // 0 nothing, 1 watch, 2 needs the dispatcher.
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

export type MoveOption = {
  vehicle_id: string;
  vehicle_kind: string;
  driver: string | null;
  status: "standby" | "available" | "busy";
  departs: string;
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

// "driver" keeps the driver's delivery and cancels the backup's copy. "backup" keeps the backup's copy.
export function useSettle(depot: Depot) {
  return useLiveChange<{ conflictId: string; keep: "driver" | "backup" }>(depot, (input) =>
    api.post<RunsPanel>(`/api/dispatch/live/conflicts/${input.conflictId}/settle`, { keep: input.keep }, { role }),
  );
}

export function useReview(depot: Depot) {
  return useLiveChange<{ itemId: string }>(depot, async (input) => {
    await api.post<void>(`/api/dispatch/live/feed/${input.itemId}/review`, {}, { role });
    return undefined;
  });
}

export function useHandle(depot: Depot) {
  return useLiveChange<{ itemId: string; note?: string }>(depot, async (input) => {
    await api.post<void>(`/api/dispatch/live/feed/${input.itemId}/handle`, { note: input.note ?? "" }, { role });
    return undefined;
  });
}
