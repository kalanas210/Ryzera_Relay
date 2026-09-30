import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
