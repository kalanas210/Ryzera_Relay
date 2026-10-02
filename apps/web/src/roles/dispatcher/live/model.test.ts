import { describe, expect, it } from "vitest";
import type { FeedItem, RunMarker, RunRow } from "./api";
import {
  defaultSelection,
  FOLDED,
  feedLinks,
  itemRows,
  lastRecord,
  markerStatus,
  onTheRoadTo,
  rank,
  runLine,
  shownInFeed,
  silentCaption,
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
    last_contact_at: at("05:41"),
    out_of_contact: false,
    silent_minutes: 0,
    position: "",
    caption: "",
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
