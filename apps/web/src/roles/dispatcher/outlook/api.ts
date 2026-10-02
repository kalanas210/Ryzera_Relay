import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export type OutlookDepot = "Kandy" | "Peliyagoda";
export type FleetState = "over" | "limit" | "within";

export type OutlookDay = {
  date: string;
  chilled_orders: number;
  chilled_kg: number;
  chilled_m3: number;
  needed: number;
  available: number;
  in_workshop: string[];
  state: FleetState;
  /** The run being planned counts its orders in, not the forecast. */
  from_order_book: boolean;
  waits: number;
  /** Chilled orders one refrigerated vehicle fewer than needed can serve, on forecast days the search counted it. */
  served_one_fewer: number | null;
};

export type BusiestDay = OutlookDay & {
  segments: { filled: number; short: number; standby: number; workshop: number };
  headline: boolean;
};

export type OutlookWeek = {
  iso_year: number;
  iso_week: number;
  first_day: string;
  last_day: string;
  open_days: number;
  chip: { label: string; tone: "attention" | "neutral" } | null;
  lines: string[];
  demand: { chilled: number; dry: number; style: number; tech: number; all: number } | null;
  chilled_limit_m3: number | null;
  chilled_pct: number | null;
  busiest: BusiestDay | null;
  days: OutlookDay[];
};

export type KeyFigure = { value: string; label: string; tone: "attention" | "problem" | "neutral" };

export type Outlook = {
  depot: OutlookDepot;
  depot_label: string;
  now: string;
  run_date: string;
  forecast_updated: string | null;
  fleet: number;
  weeks: OutlookWeek[];
  headline: {
    date: string;
    needed: number;
    available: number;
    state: FleetState;
    title: string;
    detail: string;
    support: string;
  } | null;
  key_figures: KeyFigure[];
  arrange: string[];
  notes: string[];
  /** How the numbers are made, one paragraph each. */
  method: string[];
  labels: { fleet: string; vehicles: string; day: string; tech: string } | null;
  /** Why there is nothing to show, for a depot with no forecast. */
  empty: string | null;
};

/** DSP-05 reads only: the forecast comes with the seed, and the run being planned follows the order book. */
export function useOutlook(depot: OutlookDepot) {
  return useQuery({
    queryKey: ["dispatch", "outlook", depot],
    queryFn: ({ signal }) => api.get<Outlook>(`/api/dispatch/outlook?depot=${depot}`, { role: "dispatcher", signal }),
    refetchInterval: 30_000,
  });
}
