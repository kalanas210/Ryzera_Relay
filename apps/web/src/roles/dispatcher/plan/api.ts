import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export type Rule = { rule: number; name: string; passed: boolean; message: string };
export type PlanStop = {
  order_ref: string;
  outlet_id: string;
  short_name: string;
  name: string;
  dock_type: string;
  window_open: string;
  window_close: string;
  planned: string;
  expected: string;
  units: number;
  weight_kg: number;
  volume_m3: number;
};
export type PlanTrip = {
  vehicle_id: string;
  trip_no: number;
  brand: string;
  temp: "ambient" | "chilled";
  district: string;
  depart: string;
  back: string;
  expected_back: string;
  weight_kg: number;
  volume_m3: number;
  units: number;
  std_minutes: number;
  litres: number;
  usual: boolean;
  rules: Rule[];
  broken: number;
  stops: PlanStop[];
  note: string;
};
export type Lane = {
  vehicle_id: string;
  type: "truck" | "van";
  temp: "reefer" | "ambient";
  weight_cap_kg: number;
  volume_cap_m3: number;
  driver: string | null;
  status: "available" | "workshop" | "standby";
  note: string;
  fuel_week_l: number;
  fuel_quota_l: number;
  fresh_minutes: number;
  daytime_minutes: number;
  trips: PlanTrip[];
};
export type Waiting = {
  order_ref: string;
  outlet_id: string;
  short_name: string;
  brand: string;
  temp: "ambient" | "chilled";
  units: number;
  weight_kg: number;
  volume_m3: number;
  window_open: string;
  window_close: string;
  deferral: {
    kind: "capacity" | "cutoff" | "manual";
    unavoidable: boolean;
    rule: number | null;
    reason: string;
    reason_code: string | null;
    suggested_reason: string | null;
    to_date: string;
    confirmed_at: string | null;
    store_notice: string;
  } | null;
};
export type Board = {
  plan: {
    id: string;
    depot: "Kandy" | "Peliyagoda";
    run_date: string;
    status: "draft" | "published";
    version: number;
    proposed_at: string | null;
    published_at: string | null;
    edited_at: string | null;
  };
  orders: number;
  served: number;
  trips: number;
  lanes: Lane[];
  waiting: Waiting[];
  placed_by_type: Record<string, number>;
  analyses: {
    temp_class: string;
    orders: number;
    max_served: number;
    unavoidable: number;
    pool: string[];
    pool_keeping_usual_runs: string[];
    protected: string[];
    limiting: string[];
  }[];
  can_undo: boolean;
  broken: number;
  locked: boolean;
  published_peers: { depot: string; status: string; published_at: string | null }[];
};
export type Fit = { vehicle_id: string; trip_no: number; fits: boolean; hint: string };
export type Check = {
  fresh_stops: number;
  planned_late: number;
  broken: { vehicle_id: string; trip_no: number; message: string }[];
  waiting_without_reason: string[];
  expected_late: {
    vehicle_id: string;
    trip_no: number;
    order_ref: string;
    outlet_id: string;
    closes: string;
    planned: string;
    expected: string;
    why: string;
  }[];
  can_publish: boolean;
};

const role = "dispatcher" as const;
export type DepotName = "Kandy" | "Peliyagoda";

export function useBoard(depot: DepotName) {
  return useQuery({
    queryKey: ["plan", depot],
    queryFn: ({ signal }) => api.get<Board>(`/api/dispatch/plan?depot=${depot}`, { role, signal }),
    refetchInterval: 15_000,
  });
}

function useBoardMutation<I>(depot: DepotName, fn: (input: I) => Promise<Board>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (board) => {
      client.setQueryData(["plan", depot], board);
      void client.invalidateQueries({ queryKey: ["plan-check"] });
      void client.invalidateQueries({ queryKey: ["plan-drawer"] });
    },
  });
}

export function usePropose(depot: DepotName) {
  return useBoardMutation(depot, () => api.post<Board>("/api/dispatch/plan/propose", { depot }, { role }));
}

export function useMove(depot: DepotName, planId: string | undefined) {
  return useBoardMutation(depot, (input: { order_ref: string; vehicle_id?: string; trip_no?: number }) =>
    api.post<Board>(`/api/dispatch/plan/${planId}/move`, input, { role }),
  );
}

export function useUndo(depot: DepotName, planId: string | undefined) {
  return useBoardMutation(depot, () => api.post<Board>(`/api/dispatch/plan/${planId}/undo`, {}, { role }));
}

export function usePublish(depot: DepotName, planId: string | undefined) {
  return useBoardMutation(depot, () => api.post<Board>(`/api/dispatch/plan/${planId}/publish`, {}, { role }));
}

export function useOverride(depot: DepotName, planId: string | undefined) {
  return useBoardMutation(depot, (input: { order_ref: string; note: string }) =>
    api.post<Board>(`/api/dispatch/plan/${planId}/override`, input, { role }),
  );
}

export function useVehicleStatus(depot: DepotName, runDate: string | undefined) {
  return useBoardMutation(depot, (input: { vehicle_id: string; status: Lane["status"]; note?: string }) =>
    api.patch<Board>(
      `/api/dispatch/plan/vehicles/${input.vehicle_id}?depot=${depot}`,
      { run_date: runDate, status: input.status, note: input.note ?? "" },
      { role },
    ),
  );
}

export function fetchFits(planId: string, orderRef: string) {
  return api.get<Fit[]>(`/api/dispatch/plan/${planId}/fit?order_ref=${encodeURIComponent(orderRef)}`, { role });
}

export function useCheck(planId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["plan-check", planId],
    queryFn: ({ signal }) => api.get<Check>(`/api/dispatch/plan/${planId}/check`, { role, signal }),
    enabled: Boolean(planId) && enabled,
  });
}

// ---------------------------------------------------------------------------------------------- the drawer
export type DrawerGroup = {
  temp_class: string;
  orders: number;
  max_served: number;
  unavoidable: number;
  running: number;
  limiting: string[];
  total_kg: number;
  total_m3: number;
  planned: number;
  planned_kg: number;
  planned_m3: number;
  waits: number;
  waits_kg: number;
  waits_m3: number;
  pool: { count: number; by_district: Record<string, string[]>; keeping: string[] };
  rules: { n: number; title: string; reason: string }[];
  picked_by_rule: number | null;
  result: string;
};
export type DrawerWaiting = {
  order_ref: string;
  outlet_id: string;
  short_name: string;
  name: string;
  temp: string;
  brand: string;
  units: number;
  weight_kg: number;
  volume_m3: number;
  window_open: string;
  window_close: string;
  kind: string;
  rule: number | null;
  unavoidable: boolean;
  last_delivered: string | null;
  sibling: { order_ref: string; temp: string; vehicle_id: string; expected: string } | null;
  moves_to: string;
  reasons: { code: string; label: string; suggested: boolean }[];
  reason_code: string | null;
  reason: string;
  note: string;
  confirmed_at: string | null;
  next_run: {
    fits: boolean;
    day: string;
    vehicle_id?: string;
    vehicle_kind?: string;
    trip_no?: number;
    planned?: string;
    depart?: string;
    back?: string;
    stops?: number;
    weight_kg?: number;
    weight_cap?: number;
    volume_m3?: number;
    volume_cap?: number;
    orders_with_it?: string[];
  } | null;
  costs: string[];
  store_notice: string;
  lines: { name: string; qty: number }[];
  placed_at: string;
};
export type Drawer = {
  depot: DepotName;
  depot_label: string;
  run_date: string;
  proposed_at: string | null;
  status: string;
  groups: DrawerGroup[];
  waiting: DrawerWaiting[];
  protected: {
    order_ref: string;
    outlet_id: string;
    short_name: string;
    temp: string;
    units: number;
    weight_kg: number;
    volume_m3: number;
    waited_on: string;
    vehicle_id: string;
    trip_no: number;
    planned: string;
    expected: string;
    late_by: number;
    closes: string;
  }[];
};

export function useDrawer(planId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["plan-drawer", planId],
    queryFn: ({ signal }) => api.get<Drawer>(`/api/dispatch/plan/${planId}/deferrals`, { role, signal }),
    enabled: Boolean(planId) && enabled,
  });
}

export function useConfirm(planId: string | undefined, depot: DepotName) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { order_ref: string; reason: string; note?: string }) =>
      api.post<Drawer>(
        `/api/dispatch/plan/${planId}/deferrals/${input.order_ref}/confirm`,
        { reason: input.reason, note: input.note ?? "" },
        { role },
      ),
    onSuccess: (drawer) => {
      client.setQueryData(["plan-drawer", planId], drawer);
      void client.invalidateQueries({ queryKey: ["plan", depot] });
      void client.invalidateQueries({ queryKey: ["plan-check"] });
    },
  });
}
