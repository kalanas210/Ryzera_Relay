import { describe, expect, it } from "vitest";
import type { FeedItem, RunMarker, RunRow } from "./api";
import {
  awaitingReview,
  defaultSelection,
  FOLDED,
  feedLinks,
  heldWords,
  inOrder,
  itemRows,
  lastRecord,
  markerStatus,
  onTheRoadTo,
  rank,
  rowCaption,
  runLine,
  shownInFeed,
  silentCaption,
  stations,
  vehicleRuns,
} from "./model";

const at = (clock: string) => `2026-04-08T${clock}:00+05:30`;

function marker(seq: number, place: string, over: Partial<RunMarker> = {}): RunMarker {
  return {
    stop_id: `stop-${place}`,
    seq,
    outlet_id: `OUT${110 + seq}`,
    place,
    state: "pending",
    planned: at("05:00"),
    closes: at("07:30"),
    recorded: null,
    estimate: null,
    range: null,
    passed: false,
    late_risk: false,
    receipt_at: null,
    moved_to: null,
    backup_of: null,
    held: null,
    denied: false,
    store_contact: null,
    handed_over: false,
    ...over,
  };
}

function row(over: Partial<RunRow> = {}): RunRow {
  return {
    trip_id: "trip-045",
    vehicle_id: "VEH045",
    trip_no: 1,
    is_backup: false,
    vehicle_kind: "Dry-box truck",
    driver: "Kasun Bandara",
    district: "Kegalle",
    temp: "ambient",
    brand: "Fresh",
    status: "on_the_road",
    planned_depart: at("03:29"),
    departed_at: at("03:33"),
    finished_at: null,
    expected_back: null,
    last_contact_at: at("05:41"),
    out_of_contact: false,
    silent_minutes: 0,
    position: "",
    caption: "",
    risk: "",
    delivered: 0,
    stops: 4,
    attention: 0,
    markers: [],
    ...over,
  };
}

function item(over: Partial<FeedItem> = {}): FeedItem {
  return {
    id: "item",
    kind: "delay",
    depot: "Kandy",
    title: "",
    body: "",
    created_at: at("05:00"),
    handled_at: null,
    handled_by: null,
    outcome: "",
    reviewed_at: null,
    reviewed_by: null,
    shortfall: null,
    ...over,
  };
}

/** Kasun's run at 6:15: Kegalle delivered, Mawanella arrived, then nothing from the phone since 5:41. */
const silent = row({
  out_of_contact: true,
  silent_minutes: 34,
  attention: 2,
  position: "Probably on the road to Hemmathagama.",
  markers: [
    marker(1, "Kegalle", { state: "delivered", recorded: at("05:11") }),
    marker(2, "Mawanella", { state: "arrived", recorded: at("05:30") }),
    marker(3, "Hemmathagama", {
      state: "next",
      estimate: at("06:35"),
      range: [at("06:15"), at("07:10")],
      closes: at("07:45"),
    }),
    marker(4, "Aranayake", {
      state: "moved",
      estimate: at("07:15"),
      range: [at("06:40"), at("07:50")],
      moved_to: "VEH060",
    }),
  ],
});

describe("the track's words", () => {
  it("says what was recorded and when, and estimates with around while the phone is silent", () => {
    const [kegalle, mawanella, hemmathagama, aranayake] = silent.markers;
    expect(markerStatus(kegalle!, true).text).toBe("Delivered 5:11");
    expect(markerStatus(mawanella!, true).text).toBe("Arrived 5:30");
    expect(markerStatus(hemmathagama!, true).text).toBe("around 6:35");
    expect(markerStatus(aranayake!, true)).toEqual({ text: "Also on VEH060", tone: "attention" });
    // settled by keeping the backup's copy, the stop is VEH060's alone
    expect(markerStatus({ ...aranayake!, handed_over: true }, false)).toEqual({ text: "With VEH060", tone: "muted" });
  });

  it("shows the next stop to the minute while in contact, and an estimate that passed stays where it was", () => {
    const next = marker(2, "Mawanella", { state: "next", estimate: at("05:30") });
    expect(markerStatus(next, false).text).toBe("Next, 5:30");
    expect(markerStatus({ ...next, passed: true }, false)).toEqual({ text: "5:30 passed", tone: "muted" });
  });

  it("counts a store's receipt as delivered, and late risk only when the estimate crosses the close", () => {
    expect(markerStatus(marker(3, "Hemmathagama", { state: "delivered", receipt_at: at("06:42") }), true).text).toBe(
      "Store receipt 6:42",
    );
    expect(markerStatus(marker(1, "Hantana", { estimate: at("07:55"), late_risk: true }), false).tone).toBe("problem");
  });

  it("never uses a dash or an arrow", () => {
    const words = silent.markers.map((m) => markerStatus(m, true).text).join(" ");
    // dashes U+2012 to U+2015 and every arrow from U+2190 to U+21FF
    const ch = String.fromCodePoint;
    expect(words).not.toMatch(new RegExp(`[${ch(0x2012)}-${ch(0x2015)}${ch(0x2190)}-${ch(0x21ff)}]`));
  });
});

describe("a silent run", () => {
  it("keeps the last record and says what happened to the stops since", () => {
    expect(lastRecord(silent)?.marker.place).toBe("Mawanella");
    expect(silentCaption(silent)).toBe("Last record: stop 2, arrived 5:30 AM. Stop 4 also given to VEH060.");
    expect(silentCaption({ ...silent, markers: silent.markers.slice(0, 3) })).toBe(
      "Last record: stop 2, arrived 5:30 AM. Times after that are estimates.",
    );
  });

  it("puts the estimated vehicle on the road only when Relay says so", () => {
    expect(onTheRoadTo(silent)).toBe("Hemmathagama");
    expect(onTheRoadTo({ ...silent, position: "Probably still unloading at Mawanella." })).toBeNull();
  });

  it("names the load and the district", () => {
    expect(runLine(silent)).toBe("Fresh dry, Kegalle district");
    expect(runLine(row({ temp: "chilled", district: "Matale" }))).toBe("Fresh chilled, Matale district");
  });
});

describe("vehicles on the desk", () => {
  const trip1 = row({ vehicle_id: "VEH042", trip_id: "t1", driver: "Sampath Lakmal" });
  const trip2 = row({
    vehicle_id: "VEH042",
    trip_id: "t2",
    trip_no: 2,
    driver: "Sampath Lakmal",
    departed_at: null,
    attention: 1,
  });

  it("groups a vehicle's trips and follows the one on the road", () => {
    const [vehicle] = vehicleRuns([trip2, trip1]);
    expect(vehicle?.current.trip_id).toBe("t1");
    expect(vehicle?.later?.trip_id).toBe("t2");
    expect(vehicle?.attention).toBe(0); // the trip on the road: a later trip keeps the vehicle in view, not first
  });

  it("puts a silent run first and folds runs with nothing to act on", () => {
    const quiet = row({ vehicle_id: "VEH044", trip_id: "t44", driver: "Suresh Nadarajah" });
    const vehicles = vehicleRuns([quiet, silent]);
    const links = feedLinks([], [quiet, silent]);
    expect(vehicles.map((v) => rank(v, links))).toEqual([FOLDED, 0]);
    expect(defaultSelection(vehicles, [], links, [quiet, silent])).toBe("VEH045");
  });
});

describe("feed items and their runs", () => {
  const backup = row({
    vehicle_id: "VEH060",
    trip_id: "trip-060",
    driver: "Nimal Fernando",
    is_backup: true,
    markers: [marker(1, "Aranayake", { backup_of: "stop-Aranayake" })],
  });
  const rows = [silent, backup];

  it("uses the item's reference when the feed sends one", () => {
    const moved = item({ kind: "stop_moved", ref: { trip_id: "trip-045", backup_trip_id: "trip-060" } });
    expect(itemRows(moved, rows).map((r) => r.vehicle_id)).toEqual(["VEH045", "VEH060"]);
  });

  it("finds the run from what the item names when it has no reference", () => {
    const silence = item({
      kind: "silence",
      title: "No contact from Kasun since 5:41 AM",
      body: "VEH045, Kegalle run.",
    });
    const moved = item({
      kind: "stop_moved",
      title: "Stop 4 moved to VEH060",
      body: "Nuwan Perera moved Aranayake from VEH045 at 6:15 AM: no contact.",
    });
    const receipt = item({
      kind: "receipt",
      title: "Hemmathagama confirmed receipt",
      body: "6:42 AM. VEH060 is still taking Aranayake.",
    });
    expect(itemRows(silence, rows)[0]?.vehicle_id).toBe("VEH045");
    expect(itemRows(moved, rows)[0]?.vehicle_id).toBe("VEH045");
    const receipted = {
      ...silent,
      markers: silent.markers.map((m) => (m.seq === 3 ? { ...m, receipt_at: at("06:42") } : m)),
    };
    expect(itemRows(receipt, [receipted, backup])[0]?.vehicle_id).toBe("VEH045");
  });

  it("hides a silence once the back-in-contact item has taken its place", () => {
    expect(
      shownInFeed(item({ kind: "silence", handled_at: at("07:14"), outcome: "Back in contact at 7:14 AM." })),
    ).toBe(false);
    expect(shownInFeed(item({ kind: "silence" }))).toBe(true);
  });
});

describe("the end of a trip", () => {
  /** Kasun at 7:22: all four stops delivered, Finish trip tapped at Aranayake's dock at 7:17. */
  const finished = row({
    status: "finished",
    finished_at: at("07:17"),
    expected_back: at("09:08"),
    markers: [
      marker(1, "Kegalle", { state: "delivered", recorded: at("05:11") }),
      marker(2, "Mawanella", { state: "delivered", recorded: at("05:59") }),
      marker(3, "Hemmathagama", { state: "delivered", recorded: at("06:36") }),
      marker(4, "Aranayake", { state: "delivered", recorded: at("07:09") }),
    ],
  });
  const hub = (r: RunRow) => stations(vehicleRuns([r])[0]!, "Kandy hub", at("07:22")).at(-1);

  it("never draws the finish as an arrival at the hub: the way home is an estimate", () => {
    expect(hub(finished)).toEqual({ kind: "hub", label: "Hub next", status: "around 9:10", recorded: false });
  });

  it("gives no time home when the hub's expected time is not after the finish", () => {
    expect(hub({ ...finished, expected_back: at("07:10") })).toEqual({
      kind: "hub",
      label: "Hub next",
      status: "",
      recorded: false,
    });
    expect(hub({ ...finished, expected_back: null })?.kind).toBe("hub");
  });

  it("names the next trip instead while the vehicle has one", () => {
    const second = row({ trip_id: "t2", trip_no: 2, departed_at: null, planned_depart: at("09:30") });
    const [vehicle] = vehicleRuns([{ ...finished, finished_at: null, status: "on_the_road" }, second]);
    expect(stations(vehicle!, "Kandy hub", at("07:22")).at(-1)).toEqual({
      kind: "hub",
      label: "Then trip 2",
      status: "Leaves 9:30",
      recorded: false,
    });
  });
});

describe("a stop with two copies", () => {
  const twoCopies = marker(4, "Aranayake", { state: "conflict", held: at("07:09") });

  it("shows what the phone holds until it is settled", () => {
    expect(heldWords(twoCopies, row())).toBe("Delivered 7:09");
  });

  it("shows the driver's no instead of the phone's delivery", () => {
    expect(heldWords({ ...twoCopies, denied: true }, row())).toBe("Kasun says not delivered");
  });

  it("says nothing above a stop that has one copy", () => {
    expect(heldWords(marker(4, "Aranayake", { state: "delivered", held: at("07:09") }), row())).toBeNull();
  });
});

describe("needs attention first", () => {
  /** 5:20: nothing open, Sampath's delay handled at 4:35, Kasun's shortfall decided at 2:52. */
  const kasun = row({
    markers: [
      marker(1, "Kegalle", { state: "delivered", recorded: at("05:11") }),
      marker(2, "Mawanella", { state: "next", estimate: at("05:30"), closes: at("07:45") }),
      marker(3, "Hemmathagama", { estimate: at("06:35"), closes: at("07:45") }),
      marker(4, "Aranayake", { estimate: at("07:15"), closes: at("07:30") }),
    ],
  });
  const sampath = row({
    vehicle_id: "VEH042",
    trip_id: "trip-042",
    driver: "Sampath Lakmal",
    planned_depart: at("02:40"),
    markers: [
      marker(1, "Palapathwela", { state: "delivered", recorded: at("04:28") }),
      marker(2, "Rattota", { state: "next", estimate: at("05:35"), closes: at("07:30") }),
    ],
  });
  const later = row({
    vehicle_id: "VEH042",
    trip_id: "trip-042b",
    trip_no: 2,
    driver: "Sampath Lakmal",
    departed_at: null,
    risk: "Kandy Town is expected after its 7:30 AM close.",
    markers: [marker(1, "Kandy Town", { estimate: at("07:40"), late_risk: true })],
  });
  const rows = [sampath, later, kasun];
  const items = [
    item({ kind: "delay", title: "Sampath Lakmal reports: Delayed, 45 min", handled_at: at("04:35") }),
    item({ kind: "shortfall", created_at: at("02:47"), handled_at: at("02:52"), ref: { trip_id: "trip-045" } }),
  ];

  it("opens on the run with the least room before a close, not the newest handled item", () => {
    const vehicles = vehicleRuns(rows);
    const links = feedLinks(items, rows);
    expect(vehicles.map((v) => rank(v, links))).toEqual([3, 3]);
    expect(inOrder(vehicles, links).map((v) => v.vehicle_id)).toEqual(["VEH045", "VEH042"]);
    expect(defaultSelection(vehicles, items, links, rows)).toBe("VEH045");
  });

  it("still opens on the newest open exception", () => {
    const open = [item({ kind: "delay", title: "Sampath Lakmal reports: Delayed, 45 min" }), ...items.slice(1)];
    const vehicles = vehicleRuns(rows);
    expect(defaultSelection(vehicles, open, feedLinks(open, rows), rows)).toBe("VEH042");
  });

  it("says every late stop of a later trip apart from this trip's windows", () => {
    const [vehicle] = vehicleRuns([
      { ...sampath, caption: "Left at 2:44 AM. Every stop still to come is expected inside its window." },
      { ...later, risk: "Kandy Town and Ampitiya are expected after their 7:30 AM and 8:00 AM closes." },
    ]);
    expect(rowCaption(vehicle!)).toBe(
      "Left at 2:44 AM. Trip 1 stops are inside their windows. Trip 2: Kandy Town and Ampitiya are expected after " +
        "their 7:30 AM and 8:00 AM closes.",
    );
  });
});

describe("a settled two-copy stop", () => {
  const settled = item({ kind: "conflict", title: "Stop 4 conflict resolved", handled_at: at("07:15") });

  it("waits under Now until the dispatcher has reviewed it", () => {
    expect(awaitingReview(settled)).toBe(true);
    expect(awaitingReview({ ...settled, reviewed_at: at("07:20") })).toBe(false);
    expect(awaitingReview({ ...settled, handled_at: null })).toBe(false);
    expect(awaitingReview({ ...settled, kind: "delay" })).toBe(false);
  });
});

describe("a settled two-copy stop on the desk", () => {
  it("keeps its run in front, and selected, until it is reviewed", () => {
    const quiet = row({ vehicle_id: "VEH042", trip_id: "trip-042", driver: "Sampath Lakmal" });
    const kasun = row({ status: "finished", finished_at: at("07:17") });
    const rows = [quiet, kasun];
    const settled = item({
      kind: "conflict",
      title: "Stop 4 conflict resolved",
      handled_at: at("07:15"),
      ref: { trip_id: "trip-045" },
    });
    const vehicles = vehicleRuns(rows);
    expect(defaultSelection(vehicles, [settled], feedLinks([settled], rows), rows)).toBe("VEH045");
    const reviewed = { ...settled, reviewed_at: at("07:20") };
    expect(feedLinks([reviewed], rows).open.size).toBe(0);
  });
});
