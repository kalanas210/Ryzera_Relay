// How the store's screens put a delivery into words. Times round to 5 minutes, counts keep
// their nouns, and there is never a guess at why a driver has gone quiet.
import { calledName } from "@/lib/names";
import { dayOf, daysBetween, formatDayLong, formatTime, formatWeekday, formatWindow, roundTo5 } from "@/lib/time";
import { type IssueKind, type Notice, plural, type StoreHome, type StoreOrder, type Tracker } from "./api";

export type CardState =
  // Not on a published run yet.
  | "received"
  | "deferred"
  | "scheduled"
  | "on_the_way"
  // The estimate has gone by and nothing new has come from the driver.
  | "passed"
  | "arrived"
  // The driver's proof is in and the store has not confirmed yet.
  | "delivered"
  | "confirmed"
  | "disputed";

// focus is the day My orders is showing. A moved order reads as deferred on its first day,
// and follows its delivery like any other on the day it now runs.
export function cardState(order: StoreOrder, tracker: Tracker | undefined, focus?: string): CardState {
  if (order.run_date !== order.requested_date && (!focus || focus !== order.run_date)) return "deferred";
  if (!tracker || tracker.stop_seq === null) return "received";
  switch (tracker.status) {
    case "on_the_way":
      return tracker.passed ? "passed" : "on_the_way";
    case "scheduled":
      return "scheduled";
    default:
      return tracker.status;
  }
}

const NBSP = "\u00a0";

// A no-break space keeps the AM or PM with its time.
export function clock(value: string | Date): string {
  return formatTime(value).replace(/\s(AM|PM)$/, `${NBSP}$1`);
}

export function around(value: string | Date): string {
  return clock(roundTo5(value));
}

export function windowOf(outlet: { window_open: string; window_close: string }): string {
  return formatWindow(outlet.window_open, outlet.window_close).replace(/\s/g, NBSP);
}

export function span(from: string | Date, to: string | Date, joiner: "to" | "and" = "to"): string {
  const a = around(from);
  const b = around(to);
  const suffix = /\s(AM|PM)$/;
  const ma = a.match(suffix);
  const mb = b.match(suffix);
  return ma && mb && ma[1] === mb[1] ? `${a.replace(suffix, "")} ${joiner} ${b}` : `${a} ${joiner} ${b}`;
}

export function cases(name: string, qty: number): string {
  return `${qty} ${plural(name, qty)}`;
}

export function contents(
  order: StoreOrder,
  tracker: Tracker | undefined,
  names: Record<string, string>,
): { name: string; qty: number }[] {
  const loaded = tracker && tracker.status !== "scheduled" && tracker.on_board.length > 0;
  const decidedShort = tracker?.on_board.some((l) => l.short > 0);
  if (tracker && (loaded || decidedShort)) {
    return tracker.on_board.map((l) => ({ name: names[l.case_type] ?? l.name, qty: l.on_board }));
  }
  return order.lines.map((l) => ({ name: l.name, qty: l.qty }));
}

export function placedAt(order: StoreOrder, now: Date): string {
  const sameDay = daysBetween(order.placed_at, now) === 0;
  return `Placed ${sameDay ? "" : `${formatWeekday(order.placed_at)} `}${clock(order.placed_at)}`;
}

// "Locked at" shows only on the day the order was placed. An order that reached Waypoint
// after its cutoff was never open to change, so it never says Locked.
export function placedLine(order: StoreOrder, now: Date): string {
  const sameDay = daysBetween(order.placed_at, now) === 0;
  const lockedSince = order.locked && Date.parse(order.placed_at) < Date.parse(order.locks_at);
  return `${placedAt(order, now)}${sameDay && lockedSince ? `. Locked at ${clock(order.locks_at)}.` : ""}`;
}

export function dayWhen(at: string | Date, now: Date): string {
  const days = daysBetween(now, at);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `on ${formatWeekday(at)}`;
}

// The plan for a run is published the evening its orders close.
export function eveningOf(closesAt: string | Date, now: Date): string {
  const when = dayWhen(closesAt, now);
  return when === "today" ? "this evening" : `${when} evening`;
}

export function closesLine(run: string, closesAt: string, now: Date): string {
  const when = dayWhen(closesAt, now);
  return `Orders for ${formatWeekday(dayOf(run))} close ${when === "today" ? "" : `${when} `}at ${clock(closesAt)}.`;
}

export function andList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export type Temp = "ambient" | "chilled";

// Fresh stores send dry and chilled orders separately.
export function kindOf(temp: Temp): "dry" | "chilled" {
  return temp === "chilled" ? "chilled" : "dry";
}

// The first type with no order yet that day, chilled before dry. With both sent, chilled.
export function defaultTemp(temps: Temp[], already: { temp: Temp }[]): Temp {
  return temps.find((t) => !already.some((o) => o.temp === t)) ?? temps[0] ?? "chilled";
}

export function issueSentAt(receipt: { confirmed_at: string; reported_at: string | null }): string {
  return receipt.reported_at ?? receipt.confirmed_at;
}

export function stopsBefore(n: number): string {
  if (n <= 0) return "Your store is the next stop";
  return `${n} stop${n === 1 ? "" : "s"} before you`;
}

// Names the driver's phone, so it never reads as the age of this screen.
export function lastHeard(tracker: Tracker): string | null {
  if (!tracker.last_heard) return null;
  return `Last heard from ${calledName(tracker.driver)} ${clock(tracker.last_heard)}`;
}

export function shortRow(name: string, qty: number, day: string | null, after: boolean): string {
  const what = cases(name, qty);
  if (!day) return `${what} short. ${qty === 1 ? "It won't" : "They won't"} be${NBSP}replaced.`;
  return after
    ? `${what} follow${qty === 1 ? "s" : ""} on${NBSP}${day}.`
    : `${what} short. ${qty === 1 ? "It comes" : "They come"}${NBSP}${day}.`;
}

const ISSUE_WORDS: Record<IssueKind, string> = { missing: "missing", damaged: "damaged", not_cold: "not cold" };

export function flaggedLabel(kind: IssueKind, qty: number): string {
  return `Flagged: ${qty} ${ISSUE_WORDS[kind]}`;
}

export function issuesSentence(
  issues: { case_type: string; kind: IssueKind; qty: number }[],
  names: Record<string, string>,
) {
  return andList(
    issues.map((i) => {
      const name = plural(names[i.case_type] ?? i.case_type, i.qty);
      return i.kind === "not_cold" ? `${i.qty} ${name} not cold` : `${i.qty} ${ISSUE_WORDS[i.kind]} ${name}`;
    }),
  );
}

export function sendIssues(n: number): string {
  return `Send ${n} issue${n === 1 ? "" : "s"}`;
}

// Kandy is "Kandy hub". The Peliyagoda depot goes by its name alone.
export function hubName(depot: string): string {
  return depot === "Kandy" ? "Kandy hub" : depot;
}

export function dockWords(dockType: string): { unloading: string; at: string } {
  if (dockType === "street") return { unloading: "Unloading at the curb", at: "at the curb" };
  if (dockType === "mall_bay") return { unloading: "Unloading at the mall bay", at: "at the mall bay" };
  return { unloading: "Unloading at your rear dock", at: "at the rear dock" };
}

export function daySummary(states: CardState[], movedTo: string | null): string {
  if (states.length === 0) return "No orders yet";
  const count = (...kinds: CardState[]) => states.filter((s) => kinds.includes(s)).length;
  const moved = count("deferred");
  const arrived = count("arrived", "delivered", "confirmed", "disputed");
  const onTheWay = count("on_the_way", "passed");
  const coming = count("scheduled", "received");
  const parts: string[] = [];
  if (arrived) parts.push(`${arrived} arrived`);
  if (onTheWay) parts.push(`${onTheWay} on the way`);
  if (coming) {
    const allReceived = coming === 2 && count("received") === 2 && moved === 0;
    parts.push(allReceived ? "Both orders received" : `${coming} order${coming > 1 ? "s" : ""} coming`);
  }
  if (moved) parts.push(`${moved} moved to ${movedTo ?? "a later day"}`);
  return parts.join(", ");
}

export function noticeLine(notice: Notice, home: StoreHome): string {
  const order = home.orders.find((o) => o.order_ref === notice.data.order_ref);
  if (notice.kind === "order_deferred" && order) {
    return `Your ${kindOf(order.temp)} order ${order.order_ref} moves to ${formatDayLong(dayOf(order.run_date))}, ${windowOf(home.outlet)}.`;
  }
  if (notice.kind === "short_delivery") {
    const day = notice.data.added_day;
    return typeof day === "string" ? `They come ${formatWeekday(dayOf(day))}.` : "They won't be replaced.";
  }
  return notice.body.split("\n\n")[0] ?? "";
}

// The dispatcher's reminder shows only while it is unread, before the cutoff,
// and with nothing sent yet for that day.
export function openReminder(notices: Notice[], home: StoreHome, now: Date): Notice | undefined {
  if (now >= new Date(home.cutoff)) return undefined;
  if (home.orders.some((o) => o.requested_date === home.ordering_for)) return undefined;
  return notices.find((n) => n.kind === "cutoff_reminder" && !n.read_at && n.data.run_date === home.ordering_for);
}

export function noticeFor(notices: Notice[], kind: string, orderRef: string): Notice | undefined {
  return notices.find((n) => n.kind === kind && n.data.order_ref === orderRef);
}

export function shortLines(tracker: Tracker | undefined, home: StoreHome, notices: Notice[]) {
  if (!tracker) return [];
  const names = Object.fromEntries(home.case_types.map((c) => [c.code, c.name]));
  const told = noticeFor(notices, "short_delivery", tracker.order_ref);
  return tracker.on_board
    .filter((l) => l.short > 0)
    .map((l) => {
      const later = home.orders.find((o) => o.order_ref === l.comes_on);
      const addedDay = later?.run_date ?? (typeof told?.data.added_day === "string" ? told.data.added_day : null);
      return {
        case_type: l.case_type,
        name: names[l.case_type] ?? l.name,
        qty: l.short,
        day: l.comes_on && addedDay ? formatWeekday(dayOf(addedDay)) : null,
        dayLong: l.comes_on && addedDay ? formatDayLong(dayOf(addedDay)) : null,
        date: l.comes_on ? addedDay : null,
        comesOn: l.comes_on,
        notice: told,
      };
    });
}
