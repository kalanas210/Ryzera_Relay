import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export type CaseType = { code: string; name: string; temp: "ambient" | "chilled"; kg: number; m3: number };

export type StoreOrder = {
  id: string;
  order_ref: string;
  temp: "ambient" | "chilled";
  brand: string;
  requested_date: string;
  run_date: string;
  units: number;
  weight_kg: number;
  volume_m3: number;
  status: string;
  placed_at: string;
  locked: boolean;
  lines: { case_type: string; name: string; qty: number; carried_qty: number; carried_from: string | null }[];
  deferral: {
    id: string;
    kind: "capacity" | "cutoff" | "manual";
    from_date: string;
    to_date: string;
    store_notice: string;
    notified_at: string | null;
    acknowledged_at: string | null;
  } | null;
};

export type StoreHome = {
  outlet: {
    outlet_id: string;
    name: string;
    short_name: string;
    brand: string;
    district: string;
    depot: string;
    dock_type: string;
    parking_constraint: string;
    window_open: string;
    window_close: string;
  };
  now: string;
  ordering_for: string;
  cutoff: string;
  next_run: string;
  orders: StoreOrder[];
  case_types: CaseType[];
  unread_notices: number;
};

const role = "store_manager" as const;

export function useStoreHome() {
  return useQuery({
    queryKey: ["store", "home"],
    queryFn: ({ signal }) => api.get<StoreHome>("/api/store/home", { role, signal }),
    refetchInterval: 20_000,
  });
}

export function usePlaceOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      temp: "ambient" | "chilled";
      lines: { case_type: string; qty: number }[];
      client_ref: string;
    }) => api.post<StoreOrder>("/api/store/orders", input, { role }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["store"] }),
  });
}

export type Notice = {
  id: string;
  kind:
    | "order_received"
    | "order_after_cutoff"
    | "order_scheduled"
    | "order_deferred"
    | "order_moved"
    | "short_delivery"
    | "new_time"
    | "delivered"
    | "backup_sent"
    | (string & {});
  title: string;
  body: string;
  data: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
};

export type IssueKind = "missing" | "damaged" | "not_cold";

export type Issue = { case_type: string; kind: IssueKind; qty: number; note: string };

/** STM-04 and STM-05: where the delivery is, from the driver's own records, and what the store confirmed. */
export type Tracker = {
  order_ref: string;
  kind: string;
  status: "scheduled" | "on_the_way" | "arrived" | "delivered" | "confirmed" | "disputed";
  vehicle_id: string | null;
  vehicle_kind: string | null;
  driver: string | null;
  /** None until the order is on a published run. */
  stop_seq: number | null;
  stops_before: number;
  /** Rounded to 5 minutes once the truck is on the road; the plan's time before that. */
  expected: string | null;
  /** The likely range, only while the driver's phone is out of contact. */
  range: [string, string] | null;
  /** The estimate has gone by with no word; it is never pushed later. */
  passed: boolean;
  out_of_contact: boolean;
  /** The last time Relay heard from the driver's phone, not the last stop event. */
  last_heard: string | null;
  /** "Probably on the road to you." */
  position: string;
  window: string;
  can_confirm: boolean;
  on_board: {
    case_type: string;
    name: string;
    ordered: number;
    on_board: number;
    short: number;
    comes_on: string | null;
  }[];
  /** The store's own stop and the stops before it, never the ones after. */
  stops: { seq: number; place: string; state: "delivered" | "arrived" | "pending" | "yours"; at: string | null }[];
  proof: {
    /** The phone's own record time. */
    delivered_at: string;
    receiver: string;
    lines: { case_type: string; qty: number }[];
    all_delivered: boolean;
    photo_id: string | null;
    photo_coming: boolean;
    signed: boolean;
    /** When the record reached Relay. */
    sent_at: string | null;
    in_window: boolean;
  } | null;
  receipt: {
    status: "confirmed" | "with_issues";
    confirmed_at: string;
    before_driver_proof: boolean;
    issues: Issue[];
    /** When the store last reported a problem after confirming. */
    reported_at: string | null;
  } | null;
  /** The stop's planned time: "Planned 5:19 AM". */
  planned: string | null;
  /** When the truck left the hub. */
  departed_at: string | null;
  /** When the driver recorded arriving at the store. */
  arrived_at: string | null;
  /** Until when the store can still report a problem with this delivery. */
  issues_until: string | null;
};

export function useStoreNotices() {
  return useQuery({
    queryKey: ["store", "notices"],
    queryFn: ({ signal }) => api.get<Notice[]>("/api/store/notices", { role, signal }),
    refetchInterval: 20_000,
  });
}

const trackerQuery = (orderRef: string) => ({
  queryKey: ["store", "tracker", orderRef],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    api.get<Tracker>(`/api/store/orders/${encodeURIComponent(orderRef)}/tracker`, { role, signal }),
  refetchInterval: 20_000,
});

export function useTracker(orderRef: string | undefined) {
  return useQuery({ ...trackerQuery(orderRef ?? ""), enabled: Boolean(orderRef) });
}

/** One tracker per order card on My orders, and whether any is still on its way for the first time: until it is,
 *  the card cannot say which state it is in. */
export function useTrackers(orderRefs: string[]): {
  trackers: Record<string, Tracker | undefined>;
  waiting: boolean;
  failed: boolean;
} {
  return useQueries({
    queries: orderRefs.map(trackerQuery),
    combine: (results) => ({
      trackers: Object.fromEntries(orderRefs.map((ref, i) => [ref, results[i]?.data])),
      waiting: results.some((r) => r.isPending && r.fetchStatus === "fetching"),
      failed: results.some((r) => r.isError),
    }),
  });
}

/** Got it. Sent straight away (not paused while the browser thinks it is offline), so a failed send says so. */
export function useAcknowledge() {
  const client = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: (noticeId: string) => api.post<Notice>(`/api/store/notices/${noticeId}/ack`, {}, { role }),
    onSuccess: (notice) => {
      client.setQueryData<Notice[]>(["store", "notices"], (list) =>
        list?.map((n) => (n.id === notice.id ? notice : n)),
      );
      void client.invalidateQueries({ queryKey: ["store", "home"] });
    },
  });
}

export function useConfirmReceipt(orderRef: string) {
  const client = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: (input: { client_ref: string; issues: Issue[] }) =>
      api.post<Tracker>(`/api/store/orders/${encodeURIComponent(orderRef)}/receipt`, input, { role }),
    onSuccess: (tracker) => {
      client.setQueryData(["store", "tracker", orderRef], tracker);
      void client.invalidateQueries({ queryKey: ["store"] });
    },
  });
}

/** A problem found after confirming, until 4:00 PM on the delivery day. Sent straight away, so a failed send says so. */
export function useReportIssues(orderRef: string) {
  const client = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: (input: { client_ref: string; issues: Issue[] }) =>
      api.post<Tracker>(`/api/store/orders/${encodeURIComponent(orderRef)}/issues`, input, { role }),
    onSuccess: (tracker) => {
      client.setQueryData(["store", "tracker", orderRef], tracker);
      void client.invalidateQueries({ queryKey: ["store"] });
    },
  });
}

/** "40 dairy crates, 32 produce crates, 20 meat and fish boxes" */
export function describeLines(lines: { name: string; qty: number }[]): string {
  return lines.map((l) => `${l.qty} ${plural(l.name, l.qty)}`).join(", ");
}

export function plural(name: string, qty: number): string {
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  if (qty === 1) return lower;
  if (lower.endsWith("box")) return `${lower}es`;
  return `${lower}s`;
}
