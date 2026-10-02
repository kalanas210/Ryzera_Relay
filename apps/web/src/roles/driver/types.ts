/** What the driver's phone reads from Relay (apps/api schemas/driver.py) and sends back. */
import type { FieldRecord, Outcome } from "@/offline/outbox";

export type StopStatus = "pending" | "arrived" | "delivered" | "failed" | "moved" | "cancelled";

export type DriverLine = {
  case_type: string;
  name: string;
  ordered: number;
  loaded: number;
  /** Cases the dispatcher decided to send short; they come on the store's next order. */
  short: number;
  short_until: string | null;
};

export type DriverStop = {
  stop_id: string;
  seq: number;
  version: number;
  status: StopStatus;
  order_ref: string;
  outlet_id: string;
  place: string;
  store_name: string;
  dock_type: string;
  van_only: boolean;
  window_open: string;
  window_close: string;
  planned: string;
  /** The time Relay last sent: rounded to 5 minutes on the phone, never pushed later while offline. */
  expected: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  moved_to: string | null;
  cases: number;
  lines: DriverLine[];
  receiver: string | null;
  has_photo: boolean;
  /** When Relay had the stop's records, if the phone held them with no signal: "Saved offline, sent 7:14 AM". */
  sent_at: string | null;
};

export type Shortfall = {
  stop_seq: number;
  place: string;
  case_type: string;
  case_name: string;
  qty: number;
  kind: "missing" | "damaged";
  decision: "send_short" | "no_replacement";
  decided_at: string | null;
  decided_by: string | null;
  added_to: string | null;
  added_day: string | null;
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

export type DriverTrip = {
  trip_id: string;
  vehicle_id: string;
  vehicle_kind: string;
  trip_no: number;
  trips_today: number;
  is_backup: boolean;
  brand: string;
  temp: "ambient" | "chilled";
  district: string;
  depot: string;
  depot_label: string;
  status: string;
  planned_depart: string;
  departed_at: string | null;
  planned_back: string;
  expected_back: string | null;
  finished_at: string | null;
  load: "loading" | "to_accept" | "accepted";
  loader: string | null;
  handover: Handover;
  shortfalls: Shortfall[];
  stops: DriverStop[];
};

export type Question = {
  id: string;
  stop_id: string;
  seq: number;
  place: string;
  question: string;
  status: "waiting_for_driver" | "escalated" | "resolved";
  answer: string | null;
  opened_at: string;
  /** The phone's own records for the stop as Relay has them, for a phone that holds none of them itself. */
  arrived_at: string | null;
  delivered_at: string | null;
  cases: number;
  receiver: string | null;
  has_photo: boolean;
  signed: boolean;
  backup_vehicle: string | null;
  /** Who is driving the second copy: "Stop 4 was also given to Nimal". */
  backup_driver: string | null;
  moved_at: string | null;
  moved_by: string | null;
  answered_at: string | null;
  resolved_at: string | null;
  /** "driver" when the driver said yes, "dispatcher" when the office cancelled the copy first. */
  resolution: string;
};

export type DriverNotice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  /** What the message is about: a moved stop's stop_id and trip_id. */
  data: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

/** The story's scripted loss of signal for this driver: inside it the phone behaves as if it had no network. */
export type Outage = { from: string; to: string };

/** A photo the story's phone outbox holds; a stand-in is one the demo's autopilot took, fetched to keep with it. */
export type HeldPhoto = {
  id: string;
  stop_id: string | null;
  event_id: string | null;
  taken_at: string;
  width: number | null;
  height: number | null;
  stand_in: boolean;
};

export type DriverRun = {
  run_date: string;
  now: string;
  driver: string;
  vehicle_id: string | null;
  published: boolean;
  dispatcher: string | null;
  trip: DriverTrip | null;
  later: DriverTrip[];
  /** Open questions, and the settled ones of this run so the phone can say how each was settled. */
  questions: Question[];
  notices: DriverNotice[];
  outage: Outage | null;
  /** Inside the story's outage only: what the story's phone outbox holds, so a demo jump's stops show as saved here. */
  held?: { records: FieldRecord[]; photos: HeldPhoto[] } | null;
};

export type RecordResult = { id: string; outcome: Outcome; reason: string };

export type RecordsOut = { results: RecordResult[]; run: DriverRun };

export type CheckinOut = { now: string; outage: Outage | null };

export type ProblemReason =
  | "delayed"
  | "outlet_closed"
  | "access_blocked"
  | "goods_refused"
  | "damaged_in_transit"
  | "vehicle_problem";

/** Why a line came off the truck short at the store. */
export type LineReason = "damaged" | "refused" | "not_on_truck";
