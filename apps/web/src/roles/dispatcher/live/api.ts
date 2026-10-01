import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiError, api } from "@/api/client";

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
  departs: string;
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
};

export type FeedItem = {
  id: string;
  kind: string;
  depot: string;
  title: string;
  body: string;
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
  outcome: string;
  shortfall: ShortfallDetail | null;
};

export type Feed = {
  depot: "Kandy" | "Peliyagoda";
  depot_label: string;
  run_date: string;
  now: FeedItem[];
  earlier: FeedItem[];
};

const role = "dispatcher" as const;

export function useFeed(depot: "Kandy" | "Peliyagoda") {
  return useQuery({
    queryKey: ["feed", depot],
    queryFn: ({ signal }) => api.get<Feed>(`/api/dispatch/live/feed?depot=${depot}`, { role, signal }),
    refetchInterval: 8_000,
  });
}

export function useDecide(depot: "Kandy" | "Peliyagoda") {
  const client = useQueryClient();
  return useMutation<Feed, ApiError, { shortfallId: string; decision: "send_short" | "no_replacement" }>({
    mutationFn: ({ shortfallId, decision }) =>
      api.post<Feed>(`/api/dispatch/live/shortfalls/${shortfallId}/decide`, { decision }, { role }),
    onSuccess: (feed) => client.setQueryData(["feed", depot], feed),
  });
}
