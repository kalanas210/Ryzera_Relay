import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Clock,
  CloudOff,
  CopyPlus,
  FastForward,
  ListChecks,
  RotateCcw,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";
import { api } from "@/api/client";
import type { DemoState, Me } from "@/api/types";
import { useDemoState } from "@/app/session";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { formatStamp, formatTime } from "@/lib/time";
import { setForcedOffline, useForcedSignal } from "@/offline/signal";
import { useSimNow } from "./clock";
import { inStorm, playedSummary } from "./model";

type ClockMove = { action: "jump"; to: string; label: string } | { action: "advance"; minutes: number; label: string };

/** A control in the bar: one compact row on a phone, where each is a 48 px target, and the full row from tablet
 *  width, kept large enough for a finger on a touch screen. */
const CONTROL =
  "inline-flex min-h-12 shrink-0 items-center justify-center gap-1.5 rounded-button t-label-strong md:min-h-8 pointer-coarse:md:min-h-12";

/** The drawer's buttons, a finger's width on a phone. */
const PHONE = "max-md:min-h-12";

/** The judge's controls, kept apart from the product: the scenario clock, the next moment in the story, a private
 *  copy of the day, and reset. Hidden when demo mode is off. English only: it is the judge's, not the field's.
 *
 *  The shared walkthrough (MAIN), where every browser lands until it starts or joins a copy, stays at the start of the
 *  story for everyone, so a jump there first offers the judge a copy of their own and makes the jump in it. */
export function DemoBar() {
  const { data } = useDemoState();
  const now = useSimNow(15_000);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [played, setPlayed] = useState<string[]>([]);
  const [showPlayed, setShowPlayed] = useState(false);
  const [shared, setShared] = useState<ClockMove | null>(null);
  const { pathname } = useLocation();

  const act = useMutation({
    mutationFn: async (input: { path: string; body?: unknown; andMove?: ClockMove }) => {
      const state = await api.post<DemoState>(input.path, input.body);
      // a new copy carries its cookie from here on, so the move asked for in the shared walkthrough lands in it
      return input.andMove ? api.post<DemoState>("/api/demo/clock", clockBody(input.andMove)) : state;
    },
    onSuccess: (state) => {
      setPlayed(state.played ?? []);
      setShowPlayed(false);
      client.setQueryData(["demo"], state);
      // everything on screen depends on the clock or the copy of the day
      void client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "demo" && q.queryKey[0] !== "me" });
    },
    // a copy may have been started before the move failed: the bar shows the copy this browser is in now
    onError: () => void client.invalidateQueries({ queryKey: ["demo"] }),
  });

  if (!data?.demo_mode || !now) return null;
  const next = data.next;
  const isShared = data.workspace.is_default;

  const move = (to: ClockMove) => {
    if (isShared) {
      setOpen(false);
      setShared(to);
    } else {
      act.mutate({ path: "/api/demo/clock", body: clockBody(to) });
    }
  };
  const jumpNext: ClockMove | null = next
    ? { action: "jump", to: next.key, label: `${formatTime(next.at)}: ${next.label}` }
    : null;
  const summary = playedSummary(played.length);

  return (
    <>
      <div className="flex min-h-12 items-center gap-2 border-b border-asphalt-200 bg-asphalt-100 px-4 text-asphalt-700 t-label md:min-h-10 md:flex-wrap md:gap-x-3 md:gap-y-1 md:py-1">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Clock size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          <span className="num md:hidden">{formatTime(now)}</span>
          <span className="num hidden md:inline">{formatStamp(now)}</span>
          <span className="sr-only">scenario time</span>
        </span>
        <span aria-hidden className="hidden opacity-40 md:inline">
          |
        </span>
        <span className="hidden items-center gap-1.5 md:inline-flex">
          {isShared ? (
            "Shared walkthrough, clock held"
          ) : (
            <>
              Walkthrough <strong className="latin t-label-strong">{data.workspace.code}</strong>
            </>
          )}
        </span>
        <span className="ml-auto flex items-center gap-2 md:flex-wrap">
          {pathname.startsWith("/driver") ? <NoSignalSwitch now={now} outages={data.outages} /> : null}
          {jumpNext ? (
            <button
              type="button"
              disabled={act.isPending}
              onClick={() => move(jumpNext)}
              aria-label={`Jump to ${jumpNext.label}`}
              className={cx(CONTROL, "border border-asphalt-300 bg-white px-2.5 hover:bg-asphalt-50")}
            >
              <FastForward size={16} strokeWidth={1.75} aria-hidden />
              <span className="num md:hidden">{act.isPending ? "Moving" : next && formatTime(next.at)}</span>
              <span className="hidden md:inline">{act.isPending ? "Moving the clock" : jumpNext.label}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cx(CONTROL, "border border-asphalt-300 bg-white px-2.5 hover:bg-asphalt-50")}
            >
              <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
              <span className="md:hidden">Start again</span>
              <span className="hidden md:inline">The story is over: start again</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Demo controls"
            className={cx(CONTROL, "w-12 hover:bg-asphalt-200 md:w-auto md:px-2.5")}
          >
            <SlidersHorizontal size={20} strokeWidth={1.75} aria-hidden className="md:hidden" />
            <span className="hidden md:inline">Demo controls</span>
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden className="hidden md:inline" />
          </button>
        </span>
      </div>

      {played.length ? (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-asphalt-200 bg-petrol-50 pl-4 text-asphalt-900 t-label md:items-start md:gap-3 md:py-2"
        >
          <ListChecks size={16} strokeWidth={1.75} aria-hidden className="shrink-0 md:mt-0.5" />
          <div className="min-w-0 flex-1 py-1.5 md:py-0">
            <p className="t-label-strong">
              <span className="md:hidden">Relay played {summary.short}</span>
              <span className="hidden md:inline">Relay played {summary.long} you skipped, as the story goes:</span>
            </p>
            <p className={cx(!showPlayed && "hidden md:block")}>{played.join(". ")}.</p>
          </div>
          <button
            type="button"
            aria-expanded={showPlayed}
            onClick={() => setShowPlayed((shown) => !shown)}
            className="inline-flex min-h-12 shrink-0 items-center px-2 t-label-strong text-petrol-700 md:hidden"
          >
            {showPlayed ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setPlayed([])}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-button hover:bg-asphalt-100"
          >
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      ) : null}

      {act.error && !open && !shared ? (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-asphalt-200 bg-problem-soft pl-4 text-asphalt-900 t-label"
        >
          <p className="min-w-0 flex-1 py-1.5">{act.error.message}</p>
          <button
            type="button"
            aria-label="Close"
            onClick={() => act.reset()}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-button hover:bg-asphalt-100"
          >
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      ) : null}

      <Sheet
        open={shared !== null}
        onClose={() => setShared(null)}
        variant="dialog"
        title="This is the shared walkthrough"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button density="store" onClick={() => setShared(null)}>
              Not now
            </Button>
            <Button
              density="store"
              variant="primary"
              icon={CopyPlus}
              disabled={act.isPending}
              onClick={() => {
                if (!shared) return;
                act.mutate({ path: "/api/demo/workspaces", andMove: shared }, { onSettled: () => setShared(null) });
              }}
            >
              {act.isPending ? "Starting your copy" : "Start my copy"}
            </Button>
          </div>
        }
      >
        <div className="flex max-w-[26rem] flex-col gap-3 t-dense text-asphalt-700">
          <p className="t-dense-strong text-asphalt-900">Start your own copy to jump the clock?</p>
          <p>
            Everyone who opens Relay without a code lands here, so its clock stays at Tuesday 2:05 PM. Your copy starts
            at the same moment, is yours alone, and goes straight to {shared?.label ?? "the moment you chose"}.
          </p>
          <p>A phone joins it with the code shown in the demo bar.</p>
        </div>
      </Sheet>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Demo controls"
        meta={`${isShared ? "Shared walkthrough" : `Walkthrough ${data.workspace.code}`} · ${formatStamp(now)}`}
        variant="drawer"
        width={440}
      >
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h3 className="t-h3">Jump to a moment in the story</h3>
            <p className="t-dense text-asphalt-700">
              The day runs on a scenario clock that starts on Tuesday 7 April 2026 at 2:05 PM. The clock only moves
              forward. When you jump ahead, Relay plays the story steps you skipped (the plan, the swap, the loading),
              so every screen matches the moment. As the clock runs, people nobody is playing act on time; the one you
              are playing waits for you.
            </p>
            <ol className="flex flex-col">
              {data.moments.map((m) => (
                <li key={m.key} className="flex items-center gap-3 border-b border-asphalt-200 py-2">
                  <span className="num t-dense-strong w-20 shrink-0">{formatTime(m.at)}</span>
                  <span className={cx("t-dense flex-1", m.passed && "text-asphalt-500")}>{m.label}</span>
                  {m.passed ? (
                    <span className="t-caption text-asphalt-500">Passed</span>
                  ) : (
                    <Button
                      density="desk"
                      className={PHONE}
                      compact
                      disabled={act.isPending}
                      aria-label={`Go to ${formatTime(m.at)}, ${m.label}`}
                      onClick={() => move({ action: "jump", to: m.key, label: `${formatTime(m.at)}: ${m.label}` })}
                    >
                      Go
                    </Button>
                  )}
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              {[15, 60].map((minutes) => {
                const label = `${minutes === 60 ? "1 hour" : `${minutes} min`} ahead`;
                return (
                  <Button
                    key={minutes}
                    density="desk"
                    className={PHONE}
                    icon={FastForward}
                    disabled={act.isPending}
                    onClick={() => move({ action: "advance", minutes, label: formatTime(advanced(now, minutes)) })}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="t-h3">Your copy of the day</h3>
            <p className="t-dense text-asphalt-700">
              {isShared
                ? "You are in the shared walkthrough, where everyone without a code lands, so its clock stays at 2:05 PM on Tuesday. Start a private copy to move the clock: it starts at the same moment and is only for this browser."
                : `This is a private copy of the day, walkthrough ${data.workspace.code}. Open the same code on a phone to play the driver there.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                density="desk"
                className={PHONE}
                icon={CopyPlus}
                disabled={act.isPending}
                onClick={() => act.mutate({ path: "/api/demo/workspaces" })}
              >
                Start a private copy
              </Button>
              <JoinCode onJoin={(code) => act.mutate({ path: "/api/demo/join", body: { code } })} />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="t-h3">Start again</h3>
            {isShared ? (
              <p className="t-dense text-asphalt-700">
                The shared walkthrough goes back to Tuesday 2:05 PM by itself an hour after the last person leaves it.
              </p>
            ) : (
              <>
                <p className="t-dense text-asphalt-700">
                  Puts this copy back to Tuesday 2:05 PM: every order, plan, load and delivery made in it is removed.
                </p>
                <div>
                  <Button
                    density="desk"
                    className={PHONE}
                    variant="danger"
                    icon={RotateCcw}
                    disabled={act.isPending}
                    onClick={() => {
                      if (window.confirm(`Reset walkthrough ${data.workspace.code} to Tuesday 2:05 PM?`)) {
                        act.mutate({ path: "/api/demo/reset" });
                      }
                    }}
                  >
                    Reset this copy
                  </Button>
                </div>
              </>
            )}
          </section>
          {act.error ? <p className="t-dense text-problem">{act.error.message}</p> : null}
        </div>
      </Sheet>
    </>
  );
}

function clockBody(move: ClockMove) {
  return move.action === "jump" ? { action: "jump", to: move.to } : { action: "advance", minutes: move.minutes };
}

const advanced = (now: Date, minutes: number) => new Date(now.getTime() + minutes * 60_000);

/** For the driver only: cut this device off as if the phone had lost its signal, so a judge on a desktop browser can
 *  walk the offline flow. The scenario clock keeps running; nothing the phone saves is sent until it is switched off.
 *  Inside the story's storm the phone has no signal whatever the switch says, so it reads on until the storm ends. */
function NoSignalSwitch({ now, outages }: { now: Date; outages: DemoState["outages"] }) {
  const forced = useForcedSignal();
  const client = useQueryClient();
  const me = client.getQueryData<Me>(["me", "driver"]);
  const name = calledName(me?.display_name);
  const storm = inStorm(me ? outages[me.username] : undefined, now);
  const on = forced.on || storm !== null;
  const phone = name ? `${name}'s phone` : "Phone";
  const label = storm ? `${phone}: storm until ${formatTime(storm.to)}` : `${phone}: no signal`;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={storm ? label : undefined}
      disabled={storm !== null}
      onClick={() => setForcedOffline(!forced.on, now.toISOString())}
      className={cx(
        CONTROL,
        "px-2.5 disabled:cursor-not-allowed",
        on ? "bg-asphalt-900 text-white" : "border border-asphalt-300 bg-white hover:bg-asphalt-50",
      )}
    >
      <CloudOff size={16} strokeWidth={1.75} aria-hidden />
      <span className="hidden md:inline">{label}</span>
      <span
        aria-hidden
        className={cx("relative ml-0.5 inline-flex h-4 w-7 rounded-full", on ? "bg-signal-400" : "bg-asphalt-300")}
      >
        <span
          className={cx(
            "absolute top-0.5 size-3 rounded-full bg-white transition-[left]",
            on ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function JoinCode({ onJoin }: { onJoin: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim()) onJoin(code.trim());
      }}
    >
      <label className="sr-only" htmlFor="join-code">
        Walkthrough code
      </label>
      <input
        id="join-code"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="Code"
        maxLength={8}
        className="latin h-9 max-md:h-12 w-24 rounded-chip border border-asphalt-300 bg-white px-3 t-dense uppercase"
      />
      <Button density="desk" className={PHONE} type="submit" icon={Users}>
        Join
      </Button>
    </form>
  );
}
