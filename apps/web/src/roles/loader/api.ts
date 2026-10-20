import {
  type QueryClient,
  useIsMutating,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { type ApiError, api } from "@/api/client";
import { useOnline } from "@/design/SyncPill";

export type LoadState = "not_started" | "loading" | "ready" | "left";
export type LineStatus = "to_load" | "in_progress" | "checked" | "flag_waiting" | "decided";

export type Person = { username: string; display_name: string; initials: string };

export type LoadCard = {
  trip_id: string;
  vehicle_id: string;
  vehicle_type: "truck" | "van";
  vehicle_kind: string;
  trip_no: number;
  temp: "ambient" | "chilled";
  brand: string;
  district: string;
  stops: number;
  cases: number;
  loaded: number;
  short: number;
  flags_waiting: number;
  state: LoadState;
  planned_depart: string;
  departed_at: string | null;
  completed_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  driver: string | null;
  loader: string | null;
  plan_changed_at: string | null;
  pick_before: string | null;
};

export type DockNotice = {
  id: string;
  trip_id: string;
  vehicle_id: string;
  kind: "swap" | "reorder";
  stops: number[];
  by: string | null;
  first_place: string | null;
  other_place: string | null;
  loads_first: boolean;
  done: boolean;
  title: string;
  body: string;
  at: string;
};

export type Tonight = {
  depot: "Kandy" | "Peliyagoda";
  depot_label: string;
  run_date: string;
  published_at: string | null;
  loads: number;
  loading: LoadCard[];
  ready: LoadCard[];
  to_load: LoadCard[];
  // One row per departure time, for the loads that left in the same minute for one district.
  left: { at: string; district: string; vehicles: string[] }[];
  left_count: number;
  workshop: { vehicle_id: string; vehicle_type: "truck" | "van"; vehicle_kind: string; back_on: string | null }[];
  daytime: number;
  notices: DockNotice[];
  loaders: Person[];
  dispatcher: string | null;
};

export type Shortfall = {
  id: string;
  kind: "missing" | "damaged";
  qty: number;
  flagged_at: string;
  flagged_by: string | null;
  decision: "send_short" | "no_replacement" | null;
  decided_at: string | null;
  decided_by: string | null;
  added_to_order_ref: string | null;
  added_to_day: string | null;
  store_contact: string | null;
  photo_id: string | null;
};

export type LoadLine = {
  id: string;
  case_type: string;
  qty: number;
  loaded: number;
  status: LineStatus;
  shortfall: Shortfall | null;
  // Its stop moved after it went on, so where it sits on the truck needs a look. A re-check clears it.
  changed_by_plan: boolean;
};

export type StopGroup = {
  stop_id: string;
  seq: number;
  outlet_id: string;
  place: string;
  order_ref: string;
  cases: number;
  loaded: number;
  short: number;
  moved_from: number | null;
  moved_at: string | null;
  state: "done" | "loading" | "to_load";
  lines: LoadLine[];
};

export type Handover = {
  completed_at: string | null;
  completed_by: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  accepted_on: "phone" | "tablet" | null;
  difference: string;
  stops: { seq: number; place: string; planned: number; loaded: number }[];
  planned_cases: number;
  loaded_cases: number;
  planned_kg: number;
  loaded_kg: number;
  planned_m3: number;
  loaded_m3: number;
};

export type TripLoad = {
  trip_id: string;
  vehicle_id: string;
  vehicle_kind: string;
  trip_no: number;
  temp: "ambient" | "chilled";
  brand: string;
  district: string;
  driver: string | null;
  loader: string | null;
  planned_depart: string;
  departed_at: string | null;
  state: LoadState;
  plan_changed_at: string | null;
  cases: number;
  loaded: number;
  short: number;
  lines_total: number;
  lines_done: number;
  lines_to_check: number;
  flags_waiting: number;
  groups: StopGroup[];
  handover: Handover;
  dispatcher: string | null;
  // The tablet cannot place calls, so it shows this number to dial from a phone.
  dispatcher_phone: string | null;
  plan_changed_by: string | null;
};

const role = "loader" as const;

export function useTonight() {
  return useQuery({
    queryKey: ["dock", "tonight"],
    queryFn: ({ signal }) => api.get<Tonight>("/api/dock/loads", { role, signal }),
    refetchInterval: 10_000,
  });
}

const writeKey = (tripId: string) => ["dock", "write", tripId];
const writeScope = (tripId: string) => ({ id: `dock-trip-${tripId}` });

// Bumped by every write to a trip, so a poll that crossed a tap on the wire is never shown over it.
const writes = new Map<string, number>();

function bump(tripId: string) {
  writes.set(tripId, (writes.get(tripId) ?? 0) + 1);
}

// Only the last pending write may put its answer on screen. An earlier answer predates the later taps.
function isLast(client: QueryClient, tripId: string) {
  return client.isMutating({ mutationKey: writeKey(tripId) }) === 1;
}

export function useTripLoad(tripId: string | undefined) {
  const client = useQueryClient();
  const key = ["dock", "trip", tripId];
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const id = tripId ?? "";
      const seen = writes.get(id) ?? 0;
      const load = await api.get<TripLoad>(`/api/dock/trips/${id}`, { role, signal });
      const crossed = client.isMutating({ mutationKey: writeKey(id) }) > 0 || (writes.get(id) ?? 0) !== seen;
      return crossed ? (client.getQueryData<TripLoad>(key) ?? load) : load;
    },
    enabled: Boolean(tripId),
    refetchInterval: 8_000,
  });
}

// TanStack pauses writes while offline and sends them in order later, so this is the real number to send.
export function useLinesToSend(): number {
  const online = useOnline();
  const pending = useIsMutating({ mutationKey: ["dock", "write"] });
  return online ? 0 : pending;
}

export function recount(load: TripLoad): TripLoad {
  const lines = load.groups.flatMap((g) => g.lines);
  const done = (l: LoadLine) => l.status === "checked" || l.status === "decided";
  const shortOf = (l: LoadLine) => (l.status === "decided" ? l.qty - l.loaded : 0);
  return {
    ...load,
    groups: load.groups.map((g) => ({
      ...g,
      loaded: g.lines.reduce((n, l) => n + l.loaded, 0),
      short: g.lines.reduce((n, l) => n + shortOf(l), 0),
    })),
    loaded: lines.reduce((n, l) => n + l.loaded, 0),
    short: lines.reduce((n, l) => n + shortOf(l), 0),
    lines_done: lines.filter(done).length,
    flags_waiting: lines.filter((l) => l.status === "flag_waiting").length,
  };
}

export function withLine(load: TripLoad, lineId: string, change: Pick<LoadLine, "loaded"> & Partial<LoadLine>) {
  return recount({
    ...load,
    groups: load.groups.map((g) => ({
      ...g,
      lines: g.lines.map((l) =>
        l.id === lineId
          ? {
              ...l,
              status: change.loaded >= l.qty ? "checked" : change.loaded > 0 ? "in_progress" : "to_load",
              changed_by_plan: false,
              ...change,
            }
          : l,
      ),
    })),
  });
}

function findLine(load: TripLoad | undefined, lineId: string): LoadLine | undefined {
  return load?.groups.flatMap((g) => g.lines).find((l) => l.id === lineId);
}

type LineWrite = { lineId: string; loaded: number };

// Taps reach the server one at a time, in order. A failure puts back just its own line.
export function useSetLine(tripId: string) {
  const client = useQueryClient();
  const key = ["dock", "trip", tripId];
  return useMutation<TripLoad, ApiError, LineWrite, { was?: LoadLine }>({
    mutationKey: writeKey(tripId),
    scope: writeScope(tripId),
    mutationFn: ({ lineId, loaded }) => api.post<TripLoad>(`/api/dock/lines/${lineId}`, { loaded }, { role }),
    onMutate: async ({ lineId, loaded }) => {
      bump(tripId);
      await client.cancelQueries({ queryKey: key });
      const was = findLine(client.getQueryData<TripLoad>(key), lineId);
      client.setQueryData<TripLoad>(key, (load) => load && withLine(load, lineId, { loaded }));
      return { was };
    },
    onError: (_error, { lineId, loaded }, context) => {
      const was = context?.was;
      const now = findLine(client.getQueryData<TripLoad>(key), lineId);
      // A later tap on the same line has already replaced this one.
      if (was && now?.loaded === loaded) {
        client.setQueryData<TripLoad>(key, (load) => load && withLine(load, lineId, was));
      }
      if (isLast(client, tripId)) void client.invalidateQueries({ queryKey: key });
    },
    onSuccess: (load) => {
      if (isLast(client, tripId)) client.setQueryData(key, load);
      void client.invalidateQueries({ queryKey: ["dock", "tonight"] });
    },
  });
}

function useTripMutation<I>(tripId: string, fn: (input: I) => Promise<TripLoad>) {
  const client = useQueryClient();
  const key = ["dock", "trip", tripId];
  return useMutation<TripLoad, ApiError, I>({
    mutationKey: writeKey(tripId),
    scope: writeScope(tripId),
    mutationFn: fn,
    onMutate: () => bump(tripId),
    onError: () => {
      if (isLast(client, tripId)) void client.invalidateQueries({ queryKey: key });
    },
    onSuccess: (load) => {
      if (isLast(client, tripId)) client.setQueryData(key, load);
      void client.invalidateQueries({ queryKey: ["dock", "tonight"] });
    },
  });
}

export type FlagWrite = {
  lineId: string;
  kind: "missing" | "damaged";
  qty: number;
  // On the scenario clock.
  at: string;
  by: string | null;
};

// The flagged cases come off the count, as the server will record it.
export function withFlag(load: TripLoad, { lineId, kind, qty, at, by }: FlagWrite): TripLoad {
  return recount({
    ...load,
    groups: load.groups.map((g) => ({
      ...g,
      lines: g.lines.map((l) =>
        l.id === lineId
          ? {
              ...l,
              loaded: l.qty - Math.min(qty, l.qty),
              status: "flag_waiting",
              changed_by_plan: false,
              shortfall: {
                id: `unsent-${lineId}`,
                kind,
                qty,
                flagged_at: at,
                flagged_by: by,
                decision: null,
                decided_at: null,
                decided_by: null,
                added_to_order_ref: null,
                added_to_day: null,
                store_contact: null,
                photo_id: null,
              },
            }
          : l,
      ),
    })),
  });
}

const flagKey = (tripId: string) => [...writeKey(tripId), "flag"];

// With no signal the flag waits on the tablet and keeps trying. A refusal from Relay puts the line back.
export function useFlag(tripId: string) {
  const client = useQueryClient();
  const key = ["dock", "trip", tripId];
  return useMutation<TripLoad, ApiError, FlagWrite, { was?: LoadLine }>({
    mutationKey: flagKey(tripId),
    scope: writeScope(tripId),
    mutationFn: ({ lineId, kind, qty }) =>
      api.post<TripLoad>(`/api/dock/lines/${lineId}/flag`, { kind, qty }, { role }),
    retry: (_count, error) => error.offline,
    onMutate: async (input) => {
      bump(tripId);
      await client.cancelQueries({ queryKey: key });
      const was = findLine(client.getQueryData<TripLoad>(key), input.lineId);
      client.setQueryData<TripLoad>(key, (load) => load && withFlag(load, input));
      return { was };
    },
    onError: (_error, { lineId }, context) => {
      const was = context?.was;
      if (was) client.setQueryData<TripLoad>(key, (load) => load && withLine(load, lineId, was));
      if (isLast(client, tripId)) void client.invalidateQueries({ queryKey: key });
    },
    onSuccess: (load) => {
      if (isLast(client, tripId)) client.setQueryData(key, load);
      void client.invalidateQueries({ queryKey: ["dock", "tonight"] });
    },
  });
}

// A flag that has not reached Relay a minute after it was made reads "Not sent yet".
const NOT_SENT_AFTER_MS = 60_000;

export function useUnsentFlags(tripId: string): Set<string> {
  const pending = useMutationState({
    filters: { mutationKey: flagKey(tripId), status: "pending" },
    select: (m) => ({ lineId: (m.state.variables as FlagWrite).lineId, at: m.state.submittedAt }),
  });
  const [now, setNow] = useState(() => Date.now());
  const waiting = pending.length > 0;
  useEffect(() => {
    if (!waiting) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, [waiting]);
  return new Set(pending.filter((p) => now - p.at >= NOT_SENT_AFTER_MS).map((p) => p.lineId));
}

// The photo goes after its flag in the same queue, so the flag never waits on it.
export function useFlagPhoto(tripId: string) {
  const client = useQueryClient();
  const key = ["dock", "trip", tripId];
  return useMutation<TripLoad, ApiError, { lineId: string; photo: Blob }>({
    mutationKey: ["dock", "photo", tripId],
    scope: writeScope(tripId),
    mutationFn: ({ lineId, photo }) => {
      const form = new FormData();
      form.append("file", photo, "damage.jpg");
      return api.put<TripLoad>(`/api/dock/lines/${lineId}/flag/photo`, form, { role });
    },
    retry: (_count, error) => error.offline,
    onSuccess: (load) => {
      // A tap made after the photo has the newer answer.
      if (client.isMutating({ mutationKey: writeKey(tripId) }) === 0) client.setQueryData(key, load);
    },
  });
}

export function useWithdrawFlag(tripId: string) {
  return useTripMutation(tripId, (lineId: string) => api.del<TripLoad>(`/api/dock/lines/${lineId}/flag`, { role }));
}

export function useComplete(tripId: string) {
  return useTripMutation(tripId, () => api.post<TripLoad>(`/api/dock/trips/${tripId}/complete`, {}, { role }));
}

export function useAcceptHere(tripId: string) {
  return useTripMutation(tripId, (pin: string) =>
    api.post<TripLoad>(`/api/dock/trips/${tripId}/accept`, { pin }, { role }),
  );
}

export function vehicleKindKey(kind: string): "dryTruck" | "ambientVan" | "reeferTruck" | "reeferVan" {
  if (kind.startsWith("Refrigerated")) return kind.endsWith("van") ? "reeferVan" : "reeferTruck";
  return kind.endsWith("van") ? "ambientVan" : "dryTruck";
}

export function loadKindKey(brand: string, temp: string): "dry" | "chilled" | "Style" | "Tech" {
  if (brand === "Fresh") return temp === "chilled" ? "chilled" : "dry";
  return brand === "Tech" ? "Tech" : "Style";
}
