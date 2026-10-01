import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiError, api } from "@/api/client";

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
  left: { at: string; until: string | null; district: string; vehicles: string[] }[];
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
};

export type LoadLine = {
  id: string;
  case_type: string;
  qty: number;
  loaded: number;
  status: LineStatus;
  shortfall: Shortfall | null;
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
  flags_waiting: number;
  groups: StopGroup[];
  handover: Handover;
  dispatcher: string | null;
};

const role = "loader" as const;

export function useTonight() {
  return useQuery({
    queryKey: ["dock", "tonight"],
    queryFn: ({ signal }) => api.get<Tonight>("/api/dock/loads", { role, signal }),
    refetchInterval: 10_000,
  });
}

export function useTripLoad(tripId: string | undefined) {
  return useQuery({
    queryKey: ["dock", "trip", tripId],
    queryFn: ({ signal }) => api.get<TripLoad>(`/api/dock/trips/${tripId}`, { role, signal }),
    enabled: Boolean(tripId),
    refetchInterval: 8_000,
  });
}

/** Counts a trip shows everywhere, recomputed after an optimistic change to its lines. */
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

/** A gloved tap checks a line at once; the server's answer replaces the guess, and a failure puts it back. */
export function useSetLine(tripId: string) {
  const client = useQueryClient();
  const key = ["dock", "trip", tripId];
  return useMutation<TripLoad, ApiError, { lineId: string; loaded: number }, { before?: TripLoad }>({
    mutationFn: ({ lineId, loaded }) => api.post<TripLoad>(`/api/dock/lines/${lineId}`, { loaded }, { role }),
    onMutate: async ({ lineId, loaded }) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<TripLoad>(key);
      if (before) {
        const next: TripLoad = {
          ...before,
          groups: before.groups.map((g) => ({
            ...g,
            lines: g.lines.map((l) =>
              l.id === lineId
                ? {
                    ...l,
                    loaded,
                    status: loaded >= l.qty ? "checked" : loaded > 0 ? "in_progress" : "to_load",
                  }
                : l,
            ),
          })),
        };
        client.setQueryData(key, recount(next));
      }
      return { before };
    },
    onError: (_error, _input, context) => {
      if (context?.before) client.setQueryData(key, context.before);
    },
    onSuccess: (load) => {
      client.setQueryData(key, load);
      void client.invalidateQueries({ queryKey: ["dock", "tonight"] });
    },
  });
}

function useTripMutation<I>(tripId: string, fn: (input: I) => Promise<TripLoad>) {
  const client = useQueryClient();
  return useMutation<TripLoad, ApiError, I>({
    mutationFn: fn,
    onSuccess: (load) => {
      client.setQueryData(["dock", "trip", tripId], load);
      void client.invalidateQueries({ queryKey: ["dock", "tonight"] });
    },
  });
}

export function useFlag(tripId: string) {
  return useTripMutation(tripId, (input: { lineId: string; kind: "missing" | "damaged"; qty: number }) =>
    api.post<TripLoad>(`/api/dock/lines/${input.lineId}/flag`, { kind: input.kind, qty: input.qty }, { role }),
  );
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
