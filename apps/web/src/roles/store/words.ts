/** How the store's screens put a delivery into words. Pure, so the rules are tested without a screen: times
 *  rounded to 5 minutes and written "around 6:35 AM", counts kept with their nouns, and never a guess at why a
 *  driver has gone quiet. */
import { calledName } from "@/lib/names";
import { dayOf, daysBetween, formatDayLong, formatTime, formatWeekday, formatWindow, roundTo5 } from "@/lib/time";
import { type IssueKind, type Notice, plural, type StoreHome, type StoreOrder, type Tracker } from "./api";

/** What one order card shows. */
export type CardState =
  /** Not on a published run yet. */
  | "received"
  /** Moved to a later run. */
  | "deferred"
  | "scheduled"
  | "on_the_way"
  /** The estimate has gone by and nothing new has come from the driver. */
  | "passed"
  | "arrived"
  /** The driver's proof is in and the store has not confirmed yet. */
  | "delivered"
  | "confirmed"
  | "disputed";

/** The card's state on the day My orders is showing (`focus`): an order moved to a later run reads "Moved to
 *  Thursday" on its first day, and follows its delivery like any other on the day it now runs. */
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

/** "6:36 AM", with a no-break space so the AM never wraps away from its time. */
export function clock(value: string | Date): string {
  return formatTime(value).replace(/\s(AM|PM)$/, `${NBSP}$1`);
}

/** "6:35 AM", always to 5 minutes on a store screen. */
export function around(value: string | Date): string {
  return clock(roundTo5(value));
}

/** "4:00 to 7:45 AM", kept on one line. */
export function windowOf(outlet: { window_open: string; window_close: string }): string {
  return formatWindow(outlet.window_open, outlet.window_close).replace(/\s/g, NBSP);
}

/** "6:05 to 7:05 AM" (or "6:05 and 7:05 AM"), with the AM or PM once when both ends share it. */
export function span(from: string | Date, to: string | Date, joiner: "to" | "and" = "to"): string {
  const a = around(from);
  const b = around(to);
  const suffix = /\s(AM|PM)$/;
  const ma = a.match(suffix);
  const mb = b.match(suffix);
  return ma && mb && ma[1] === mb[1] ? `${a.replace(suffix, "")} ${joiner} ${b}` : `${a} ${joiner} ${b}`;
}

/** "36 rice and dhal cases" from the full case name. */
export function cases(name: string, qty: number): string {
  return `${qty} ${plural(name, qty)}`;
}

/** The contents line, from what is on the truck once it is loaded, otherwise from the order. */
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

/** "Placed 2:14 PM" on the day it was placed, "Placed Tuesday 2:14 PM" after. */
export function placedAt(order: StoreOrder, now: Date): string {
  const sameDay = daysBetween(order.placed_at, now) === 0;
  return `Placed ${sameDay ? "" : `${formatWeekday(order.placed_at)} `}${clock(order.placed_at)}`;
}

/** The card's meta after the order ID: "Placed 2:14 PM. Locked at 4:00 PM." while the delivery is still to come
 *  tomorrow; "Placed Tuesday 2:14 PM" on later days, with no Locked. An order that reached Waypoint after its cutoff
 *  was never open to change, so it says nothing of locking. */
export function placedLine(order: StoreOrder, now: Date): string {
  const sameDay = daysBetween(order.placed_at, now) === 0;
  const lockedSince = order.locked && Date.parse(order.placed_at) < Date.parse(order.locks_at);
  return `${placedAt(order, now)}${sameDay && lockedSince ? `. Locked at ${clock(order.locks_at)}.` : ""}`;
}

/** When a cutoff falls, said from today: "today", "tomorrow" or "on Monday". */
export function dayWhen(at: string | Date, now: Date): string {
  const days = daysBetween(now, at);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `on ${formatWeekday(at)}`;
}

/** "this evening", "tomorrow evening": when the plan for a run is published, the evening its orders close. */
export function eveningOf(closesAt: string | Date, now: Date): string {
  const when = dayWhen(closesAt, now);
  return when === "today" ? "this evening" : `${when} evening`;
}

/** "Orders for Thursday close tomorrow at 4:00 PM." On the day itself, "Orders for Wednesday close at 4:00 PM." */
export function closesLine(run: string, closesAt: string, now: Date): string {
  const when = dayWhen(closesAt, now);
  return `Orders for ${formatWeekday(dayOf(run))} close ${when === "today" ? "" : `${when} `}at ${clock(closesAt)}.`;
}

/** "a", "a and b", "a, b and c" */
export function andList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export type Temp = "ambient" | "chilled";

/** How a store names an order's type: Fresh stores send dry and chilled orders separately. */
export function kindOf(temp: Temp): "dry" | "chilled" {
  return temp === "chilled" ? "chilled" : "dry";
}

/** The type a new order starts on: the first type the store has no order for yet that day, chilled before dry as
 *  the form is drawn; once it has both, chilled. */
export function defaultTemp(temps: Temp[], already: { temp: Temp }[]): Temp {
  return temps.find((t) => !already.some((o) => o.temp === t)) ?? temps[0] ?? "chilled";
}

/** When an issue reached the dispatcher: one reported after confirming carries its own time, not the receipt's. */
export function issueSentAt(receipt: { confirmed_at: string; reported_at: string | null }): string {
  return receipt.reported_at ?? receipt.confirmed_at;
}

/** "1 stop before you", or that the store is next. */
export function stopsBefore(n: number): string {
  if (n <= 0) return "Your store is the next stop";
  return `${n} stop${n === 1 ? "" : "s"} before you`;
}

/** "Last heard from Kasun 5:20 AM": the driver's phone, named, so it never reads as the age of this screen. */
export function lastHeard(tracker: Tracker): string | null {
  if (!tracker.last_heard) return null;
  return `Last heard from ${calledName(tracker.driver)} ${clock(tracker.last_heard)}`;
}

/** A short line on the card: "6 rice and dhal cases short. They come Thursday." before the delivery, "6 rice and
 *  dhal cases follow on Thursday." after it. Without a later order: "They won't be replaced." */
export function shortRow(name: string, qty: number, day: string | null, after: boolean): string {
  const what = cases(name, qty);
  if (!day) return `${what} short. ${qty === 1 ? "It won't" : "They won't"} be${NBSP}replaced.`;
  return after
    ? `${what} follow${qty === 1 ? "s" : ""} on${NBSP}${day}.`
    : `${what} short. ${qty === 1 ? "It comes" : "They come"}${NBSP}${day}.`;
}

const ISSUE_WORDS: Record<IssueKind, string> = { missing: "missing", damaged: "damaged", not_cold: "not cold" };

/** "Flagged: 1 damaged" */
export function flaggedLabel(kind: IssueKind, qty: number): string {
  return `Flagged: ${qty} ${ISSUE_WORDS[kind]}`;
}

/** "1 damaged packet foods case and 2 dairy crates not cold" */
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

/** "Send 1 issue", "Send 2 issues" */
export function sendIssues(n: number): string {
  return `Send ${n} issue${n === 1 ? "" : "s"}`;
}

/** "Kandy hub"; the Peliyagoda depot goes by its name alone. */
export function hubName(depot: string): string {
  return depot === "Kandy" ? "Kandy hub" : depot;
}

/** Where the goods come off at this store. */
export function dockWords(dockType: string): { unloading: string; at: string } {
  if (dockType === "street") return { unloading: "Unloading at the curb", at: "at the curb" };
  if (dockType === "mall_bay") return { unloading: "Unloading at the mall bay", at: "at the mall bay" };
  return { unloading: "Unloading at your rear dock", at: "at the rear dock" };
}

/** The summary under the day: "1 on the way, 1 moved to Thursday". */
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

/** A notice's line in Updates, as the lock screen says it: a deferral by the day it now comes, a short delivery by
 *  when the cases follow, any other by the first lines of what was sent. */
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

/** The dispatcher's reminder to order, while it still matters: unread, for the day orders are open for, before
 *  that day's cutoff, and with nothing sent for that day yet. */
export function openReminder(notices: Notice[], home: StoreHome, now: Date): Notice | undefined {
  if (now >= new Date(home.cutoff)) return undefined;
  if (home.orders.some((o) => o.requested_date === home.ordering_for)) return undefined;
  return notices.find((n) => n.kind === "cutoff_reminder" && !n.read_at && n.data.run_date === home.ordering_for);
}

/** The newest notice of a kind about one order. */
export function noticeFor(notices: Notice[], kind: string, orderRef: string): Notice | undefined {
  return notices.find((n) => n.kind === kind && n.data.order_ref === orderRef);
}

/** The cases decided short on this order and the weekday they come, from the order they were added to. */
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
