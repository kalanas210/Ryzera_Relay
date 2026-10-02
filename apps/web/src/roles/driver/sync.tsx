/** The driver's phone and Relay: the run it last heard, the outbox it sends from, and whether it has signal.
 *
 *  Every action is written to the outbox first and the screens update from the phone's own records at once. The
 *  sender goes when the browser says it is back online, when the app comes to the front, at start, after each new
 *  record and with the minute check-in; there is no retry button. With no signal the screens work from the last run
 *  kept in IndexedDB, so the expected times stay the ones Relay last sent and are never pushed later.
 *
 *  No signal means any of: the browser is offline, the last request found no connection, the story's scripted
 *  outage for this driver is running on the scenario clock, or the demo bar's switch is on. The switch blocks every
 *  request from the driver screens; only the demo's own channel tells Relay it is on, so the story's autopilot leaves
 *  this driver to the phone in the judge's hand and a jump never plays a stop that may be waiting on it. Inside the
 *  scripted outage Relay itself takes nothing from the phone; the phone still reads the demo's stand-in for its own
 *  memory (the run as it last saw it, and what a demo jump recorded for its driver) and hands that stand-in what it
 *  saves, so a jump never plays a stop the phone already holds.
 *
 *  What the phone keeps belongs to one copy of the day: when the demo bar starts a new copy or resets this one, the
 *  kept run, the outbox and the drafts of the old copy are let go. */
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "@/api/client";
import type { DemoState, Me } from "@/api/types";
import { useDemoState, useMe } from "@/app/session";
import { useSimNow } from "@/demo/clock";
import { useOnline } from "@/design/SyncPill";
import {
  type FieldRecord,
  newRecordId,
  Offline,
  Outbox,
  type PhotoRecord,
  type Queued,
  type RecordKind,
  type Sent,
  type Transport,
} from "@/offline/outbox";
import { phone } from "@/offline/phone";
import { setForcedOffline, useForcedSignal } from "@/offline/signal";
import { LOCATION_WAIT_MS, locate } from "./device";
import { type Counts, countOf, type LocalItem, localItems, minuteIso, overlay, type PillView, pillView } from "./local";
import type { CheckinOut, DriverRun, HeldPhoto, Outage, RecordResult, RecordsOut } from "./types";

export const RUN_KEY = ["driver", "run"] as const;
const role = "driver" as const;
const CHECKIN_MS = 60_000;
/** A reconnect's "Sending 3 stops" stays up long enough to read, even when the send itself is quicker. */
const SENDING_MIN_MS = 1_500;

const outbox = new Outbox();

type Snapshot = { run: DriverRun; saved_at: number };

/** The last time records saved with no signal reached Relay: "Stops 2, 3 and 4 reached the office at 7:14 AM". */
export type Reconnect = { trip_id: string; at: string; stopIds: string[]; photos: number };

export type RecordInput = {
  kind: RecordKind;
  trip_id: string;
  stop_id?: string | null;
  base_version?: number | null;
  payload?: Record<string, unknown>;
};

type Driver = {
  me: Me | undefined;
  /** Relay's last run, as fetched or as kept on the phone. */
  server: DriverRun | null;
  /** The same run with this phone's own records laid over it. */
  run: DriverRun | null;
  loaded: boolean;
  now: Date | null;
  offline: boolean;
  offlineSince: string | null;
  items: LocalItem[];
  pill: PillView;
  /** What a reconnect is sending right now. */
  batch: Counts | null;
  reconnect: Reconnect | null;
  save: (input: RecordInput, options?: { locate?: boolean }) => Promise<FieldRecord>;
  savePhoto: (photo: PhotoRecord) => Promise<void>;
};

const DriverContext = createContext<Driver | null>(null);

export function useDriver(): Driver {
  const driver = useContext(DriverContext);
  if (!driver) throw new Error("useDriver outside the driver shell");
  return driver;
}

/** No connection, or a gateway that cannot reach Relay: either way the phone has no word from Relay. The story's
 *  outage answers 503 itself and is told apart by the outage window. */
function unreachable(error: ApiError): boolean {
  return error.offline || error.status === 502 || error.status === 504;
}

export function inside(outage: Outage | null | undefined, at: Date | null): boolean {
  if (!outage || !at) return false;
  return Date.parse(outage.from) <= at.getTime() && at.getTime() < Date.parse(outage.to);
}

/** Scenario time now: the demo clock if the phone has read it, else the kept run's time moved on by the wall clock. */
function scenarioNow(client: QueryClient, snapshot: Snapshot | null | undefined): Date {
  const state = client.getQueryState<DemoState>(["demo"]);
  if (state?.data) return new Date(Date.parse(state.data.now) + (Date.now() - state.dataUpdatedAt) * state.data.rate);
  if (snapshot) return new Date(Date.parse(snapshot.run.now) + (Date.now() - snapshot.saved_at));
  return new Date();
}

/** The copy of the day this phone works in: the demo's code and edition, or "phone" when there is no demo to ask
 *  (demo mode off, Relay out of reach, or no network at all), when the phone works from what it kept. */
function useCopy(): string | null {
  const demo = useDemoState();
  if (demo.data) return demo.data.demo_mode ? `${demo.data.workspace.code}:${demo.data.workspace.edition}` : "phone";
  return demo.isError || demo.fetchStatus === "paused" ? "phone" : null;
}

/** Let go of what the phone kept for another copy of the day, once, when the copy changes. True if it did. */
async function forgetOtherCopies(copy: string, username: string): Promise<boolean> {
  if (copy === "phone") return false;
  const kept = await phone.get<string>("copy");
  if (kept?.value === copy) return false;
  await phone.put("copy", copy);
  if (!kept) return false;
  await outbox.clear();
  await Promise.all(["lastContact", `run:${username}`, `reconnect:${username}`].map((key) => phone.remove(key)));
  await phone.removeWhere((key) => key.startsWith("draft:"));
  setForcedOffline(false); // the switch's "no signal since" belongs to the old copy's clock
  return true;
}

/** A record or photo a demo jump saved on this phone in the storm, added once with the id the story gave it. */
async function keepHeld(held: NonNullable<DriverRun["held"]>): Promise<void> {
  const [queued, sent] = await Promise.all([outbox.waiting(), outbox.sent()]);
  const known = new Set([...queued.map((q) => q.id), ...sent.map((s) => s.id)]);
  for (const record of held.records) {
    if (!known.has(record.id)) await outbox.add(record, { savedOffline: true });
  }
  for (const photo of held.photos.filter((p: HeldPhoto) => p.stand_in && !known.has(p.id))) {
    const response = await fetch(`/api/driver/held/photos/${photo.id}`, {
      headers: { "X-Relay-Client": "web", "X-Relay-Role": role },
      credentials: "same-origin",
    }).catch(() => null);
    if (!response?.ok) continue;
    await outbox.addPhoto(
      {
        id: photo.id,
        stop_id: photo.stop_id,
        event_id: photo.event_id,
        taken_at: photo.taken_at,
        blob: await response.blob(),
        width: photo.width ?? 0,
        height: photo.height ?? 0,
      },
      { savedOffline: true },
    );
  }
}

export function DriverSync({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const me = useMe("driver");
  const username = me.data?.username;
  const copy = useCopy();
  const forced = useForcedSignal();
  const online = useOnline();
  const simNow = useSimNow(5_000);
  const [snapshot, setSnapshot] = useState<Snapshot | null | undefined>(undefined);
  const [netDown, setNetDown] = useState(false);
  const [lastContact, setLastContact] = useState<string | null>(null);
  const [box, setBox] = useState<{ queued: Queued[]; sent: Sent[]; moving: ReadonlySet<string> }>({
    queued: [],
    sent: [],
    moving: new Set(),
  });
  const [batch, setBatch] = useState<Counts | null>(null);
  const [reconnect, setReconnect] = useState<Reconnect | null>(null);

  // what this phone kept from before, for this copy of the day: the run, when it last reached Relay, the last reconnect
  useEffect(() => {
    if (!username || !copy) return;
    let live = true;
    setSnapshot(undefined);
    void forgetOtherCopies(copy, username)
      .then((forgot) => {
        if (forgot) client.removeQueries({ queryKey: RUN_KEY });
        return Promise.all([
          phone.get<DriverRun>(`run:${username}`),
          phone.get<string>("lastContact"),
          phone.get<Reconnect>(`reconnect:${username}`),
        ]);
      })
      .then(([kept, contact, again]) => {
        if (!live) return;
        setSnapshot(kept ? { run: kept.value, saved_at: kept.saved_at } : null);
        setLastContact(contact?.value ?? null);
        setReconnect(again?.value ?? null);
      });
    return () => {
      live = false;
    };
  }, [username, copy, client]);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const usernameRef = useRef(username);
  usernameRef.current = username;

  const contact = useCallback((at: string) => {
    setLastContact(at);
    setNetDown(false);
    void phone.put("lastContact", at);
  }, []);

  const keep = useCallback(
    (run: DriverRun) => {
      void client.cancelQueries({ queryKey: RUN_KEY });
      client.setQueryData(RUN_KEY, run);
      if (usernameRef.current) void phone.put(`run:${usernameRef.current}`, run);
    },
    [client],
  );

  const known = client.getQueryData<DriverRun>(RUN_KEY) ?? snapshot?.run ?? null;
  const now = simNow ?? (snapshot ? scenarioNow(client, snapshot) : null);
  // The demo clock carries the story's outage too, so a jump into it cuts the phone off before it asks anything.
  const demo = useDemoState().data as DemoState | undefined;
  const outage = (username ? demo?.outages?.[username] : undefined) ?? known?.outage ?? null;
  const outageOn = inside(outage, now);
  const blocked = forced.on || outageOn;
  const offline = blocked || !online || netDown;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const offlineRef = useRef(offline);
  offlineRef.current = offline;
  // the story's storm, not the demo bar's switch: the phone still reads and feeds the demo's stand-in for its memory
  const storm = outageOn && !forced.on;

  const query = useQuery<DriverRun, ApiError>({
    queryKey: RUN_KEY,
    queryFn: async ({ signal }) => {
      const fresh = await api.get<DriverRun>("/api/driver/run", { role, signal });
      // Inside the story's outage the answer is the phone's own memory, not Relay's: the run as the phone last saw
      // it before the signal went, and what a demo jump recorded for the driver, which joins the outbox as saved on
      // this phone. It is no contact with Relay.
      if (inside(fresh.outage, new Date(fresh.now))) {
        if (fresh.held) await keepHeld(fresh.held);
        const memory = { ...fresh, held: null };
        if (usernameRef.current) void phone.put(`run:${usernameRef.current}`, memory);
        return memory;
      }
      contact(fresh.now);
      if (usernameRef.current) void phone.put(`run:${usernameRef.current}`, fresh);
      return fresh;
    },
    // nothing is asked before the phone knows which copy of the day it is in, so it never mixes two
    enabled: Boolean(username) && Boolean(copy) && snapshot !== undefined && !forced.on,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (query.error && unreachable(query.error)) setNetDown(true);
  }, [query.error]);

  const server = query.data ?? snapshot?.run ?? null;

  // the outbox, read again whenever it changes
  useEffect(() => {
    let live = true;
    let ticket = 0;
    const load = async () => {
      const mine = ++ticket;
      const [queued, sent] = await Promise.all([outbox.waiting(), outbox.sent()]);
      if (live && mine === ticket) setBox({ queued, sent, moving: new Set(outbox.inFlight()) });
    };
    void load();
    const off = outbox.subscribe(() => void load());
    return () => {
      live = false;
      off();
    };
  }, []);

  const failed = useCallback((error: unknown) => {
    // no connection, or the story's outage answered for Relay: either way nothing arrived
    if (error instanceof ApiError && (unreachable(error) || error.status === 503)) {
      if (unreachable(error)) setNetDown(true);
      return new Offline(error.message);
    }
    return error;
  }, []);

  const transport = useMemo<Transport>(
    () => ({
      async sendRecords(records) {
        if (blockedRef.current) throw new Offline("No signal");
        try {
          const device_id = await phone.deviceId();
          const sent_at = scenarioNow(client, snapshotRef.current).toISOString();
          const out = await api.post<RecordsOut>("/api/driver/records", { device_id, sent_at, records }, { role });
          keep(out.run);
          contact(out.run.now);
          return out.results.map((r) => ({ id: r.id, outcome: r.outcome, reason: r.reason, at: out.run.now }));
        } catch (error) {
          throw failed(error);
        }
      },
      async sendPhoto(photo) {
        if (blockedRef.current) throw new Offline("No signal");
        const form = new FormData();
        form.append("file", photo.blob, `${photo.id}.jpg`);
        form.append("taken_at", photo.taken_at);
        if (photo.stop_id) form.append("stop_id", photo.stop_id);
        if (photo.event_id) form.append("event_id", photo.event_id);
        if (photo.width > 0) form.append("width", String(photo.width));
        if (photo.height > 0) form.append("height", String(photo.height));
        try {
          const out = await api.put<RecordResult>(`/api/driver/photos/${photo.id}`, form, { role });
          const at = scenarioNow(client, snapshotRef.current).toISOString();
          contact(at);
          return { outcome: out.outcome, at };
        } catch (error) {
          // Relay cannot take the photo (too large, not a picture): sending it again never helps, so it leaves the
          // queue with the reason
          if (error instanceof ApiError && (error.status === 422 || error.status === 413)) {
            return { outcome: "rejected", reason: error.message };
          }
          throw failed(error);
        }
      },
    }),
    [client, contact, failed, keep],
  );

  const kick = useCallback(async () => {
    if (blockedRef.current || !usernameRef.current) return;
    const waiting = await outbox.waiting();
    if (!waiting.length) return;
    const reconnecting = waiting.some((q) => q.saved_offline);
    const started = Date.now();
    const going = countOf(localItems(waiting, [], new Set()));
    if (reconnecting) setBatch(going);
    const result = await outbox.flush(transport);
    if (reconnecting) {
      const trip = waiting.find((q) => q.type === "record" && q.body.trip_id)?.body as FieldRecord | undefined;
      if (result.sent > 0 && result.failed === 0 && trip?.trip_id) {
        const at = scenarioNow(client, snapshotRef.current).toISOString();
        const again: Reconnect = { trip_id: trip.trip_id, at, stopIds: going.stopIds, photos: going.photos };
        setReconnect(again);
        void phone.put(`reconnect:${usernameRef.current}`, again);
      }
      window.setTimeout(() => setBatch(null), Math.max(0, SENDING_MIN_MS - (Date.now() - started)));
    }
    if (result.held) {
      // a record still waiting for its location: try again once its wait is over
      const until = Math.max(...waiting.map((q) => q.held_until ?? 0));
      window.setTimeout(() => void kick(), Math.max(500, until - Date.now() + 100));
    }
  }, [client, transport]);

  // back in coverage (the outage ended, the switch went off): send, and hear the run again
  const wasBlocked = useRef(blocked);
  useEffect(() => {
    if (!username) return;
    if (wasBlocked.current && !blocked) void client.invalidateQueries({ queryKey: RUN_KEY });
    wasBlocked.current = blocked;
    if (!blocked) void kick();
  }, [blocked, username, client, kick]);

  useEffect(() => {
    const back = () => {
      setNetDown(false);
      void kick();
    };
    const visible = () => {
      if (document.visibilityState === "visible") void kick();
    };
    window.addEventListener("online", back);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", back);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [kick]);

  // the minute check-in: no location, just "this phone is here", which is what the office reads as last contact
  useEffect(() => {
    if (!username) return;
    const learn = (next: Outage | null) => {
      const same = (o: Outage | null | undefined) => (o?.from ?? null) === (next?.from ?? null);
      client.setQueryData<DriverRun>(RUN_KEY, (cur) => (cur && !same(cur.outage) ? { ...cur, outage: next } : cur));
      setSnapshot((cur) => (cur && !same(cur.run.outage) ? { ...cur, run: { ...cur.run, outage: next } } : cur));
    };
    const beat = async () => {
      if (blockedRef.current) return;
      try {
        const device_id = await phone.deviceId();
        const waiting_records = (await outbox.waiting()).length;
        if (blockedRef.current) return; // the outage may have begun while the phone looked
        const out = await api.post<CheckinOut>("/api/driver/checkin", { device_id, waiting_records }, { role });
        learn(out.outage);
        if (inside(out.outage, new Date(out.now))) return;
        contact(out.now);
        void kick();
      } catch (error) {
        failed(error);
      }
    };
    void beat();
    const id = window.setInterval(() => void beat(), CHECKIN_MS);
    return () => window.clearInterval(id);
  }, [username, client, contact, failed, kick]);

  const save = useCallback(
    async (input: RecordInput, options: { locate?: boolean } = {}) => {
      const body: FieldRecord = {
        id: newRecordId(),
        kind: input.kind,
        trip_id: input.trip_id,
        stop_id: input.stop_id ?? null,
        occurred_at: minuteIso(scenarioNow(client, snapshotRef.current)),
        base_version: input.base_version ?? null,
        payload: input.payload ?? {},
      };
      const savedOffline = offlineRef.current;
      if (options.locate) {
        // the time is saved now; the location is tried in the background and the record waits for it at most 15 s
        await outbox.add(body, { savedOffline, holdMs: LOCATION_WAIT_MS });
        void locate()
          .then((fix) => outbox.release(body.id, fix ?? {}))
          .then(() => kick());
      } else {
        await outbox.add(body, { savedOffline });
      }
      void kick();
      return body;
    },
    [client, kick],
  );

  const savePhoto = useCallback(
    async (photo: PhotoRecord) => {
      await outbox.addPhoto(photo, { savedOffline: offlineRef.current });
      void kick();
    },
    [kick],
  );

  // The demo bar's switch, said on the demo's own channel until Relay has it. With the switch off at the start there
  // is nothing to say: the phone's first check-in tells Relay it has signal.
  const said = useRef<string | null>(null);
  const [sayAgain, setSayAgain] = useState(0);
  const demoMode = Boolean(demo?.demo_mode);
  // biome-ignore lint/correctness/useExhaustiveDependencies: sayAgain is the retry after a failed attempt
  useEffect(() => {
    if (!demoMode || !username || !copy || copy === "phone") return;
    const word = `${copy}:${forced.on}`;
    if (said.current === word) return;
    if (said.current === null && !forced.on) {
      said.current = word;
      return;
    }
    let live = true;
    let retry = 0;
    api.put("/api/driver/signal", { on: forced.on }, { role }).then(
      () => {
        if (live) said.current = word;
      },
      () => {
        if (live) retry = window.setTimeout(() => setSayAgain((n) => n + 1), 15_000);
      },
    );
    return () => {
      live = false;
      window.clearTimeout(retry);
    };
  }, [demoMode, username, copy, forced.on, sayAgain]);

  // In the story's storm, what this phone saves is handed to the demo's stand-in for its memory, so a demo jump
  // leaves those stops to it. Relay applies nothing from it until the signal returns.
  const handed = useRef("");
  useEffect(() => {
    if (!storm || !username) return;
    const ids = box.queued.map((q) => q.id).join(",");
    if (!ids || ids === handed.current) return;
    void (async () => {
      const device_id = await phone.deviceId();
      const records = box.queued.flatMap((q) => (q.type === "record" ? [q.body] : []));
      const photos = box.queued.flatMap((q) => {
        if (q.type !== "photo") return [];
        const { blob: _blob, ...meta } = q.body;
        return [meta];
      });
      await api.post("/api/driver/held", { device_id, records, photos }, { role });
      handed.current = ids;
    })().catch(() => {
      // tried again when the outbox next changes
    });
  }, [storm, username, box.queued]);

  const tick = now ? Math.floor(now.getTime() / 5_000) : 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a record's location wait runs out with the clock
  const items = useMemo(() => localItems(box.queued, box.sent, box.moving), [box, tick]);
  const run = useMemo(() => (server ? overlay(server, items) : null), [server, items]);
  const pill = pillView(items, offline, batch);
  const offlineSince = forced.on ? forced.since : outageOn && outage ? outage.from : lastContact;

  const value: Driver = {
    me: me.data,
    server,
    run,
    loaded: snapshot !== undefined || query.data !== undefined,
    now,
    offline,
    offlineSince,
    items,
    pill,
    batch,
    reconnect,
    save,
    savePhoto,
  };
  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>;
}
