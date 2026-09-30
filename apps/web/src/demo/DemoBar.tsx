import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Clock, CopyPlus, FastForward, RotateCcw, Users } from "lucide-react";
import { useState } from "react";
import { api } from "@/api/client";
import type { DemoState } from "@/api/types";
import { useDemoState } from "@/app/session";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { cx } from "@/lib/cx";
import { formatStamp, formatTime } from "@/lib/time";
import { useSimNow } from "./clock";

/** The judge's controls, kept apart from the product: the scenario clock, the next moment in the
 *  story, a private copy of the day, and reset. Hidden when demo mode is off. */
export function DemoBar({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { data } = useDemoState();
  const now = useSimNow(15_000);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);

  const act = useMutation({
    mutationFn: (input: { path: string; body?: unknown }) => api.post<DemoState>(input.path, input.body),
    onSuccess: (state) => {
      client.setQueryData(["demo"], state);
      // everything on screen depends on the clock or the copy of the day
      void client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "demo" && q.queryKey[0] !== "me" });
    },
  });

  if (!data?.demo_mode || !now) return null;
  const next = data.next;

  return (
    <>
      <div
        className={cx(
          "flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 t-label",
          tone === "dark" ? "bg-asphalt-900 text-white" : "border-b border-asphalt-200 bg-asphalt-100 text-asphalt-700",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <Clock size={16} strokeWidth={1.75} aria-hidden />
          <span className="num">{formatStamp(now)}</span>
          <span className="sr-only">scenario time</span>
        </span>
        <span aria-hidden className="opacity-40">
          |
        </span>
        <span className="inline-flex items-center gap-1.5">
          Walkthrough <strong className="latin t-label-strong">{data.workspace.code}</strong>
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {next ? (
            <button
              type="button"
              disabled={act.isPending}
              onClick={() => act.mutate({ path: "/api/demo/clock", body: { action: "jump", to: next.key } })}
              className={cx(
                "inline-flex h-8 items-center gap-1 rounded-button px-2.5 t-label-strong",
                tone === "dark"
                  ? "bg-white/10 hover:bg-white/20"
                  : "bg-white hover:bg-asphalt-50 border border-asphalt-300",
              )}
            >
              <FastForward size={16} strokeWidth={1.75} aria-hidden />
              {formatTime(next.at)}: {next.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cx(
              "inline-flex h-8 items-center gap-1 rounded-button px-2.5 t-label-strong",
              tone === "dark" ? "hover:bg-white/10" : "hover:bg-asphalt-200",
            )}
          >
            Demo controls
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </span>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Demo controls"
        meta={`Walkthrough ${data.workspace.code} · ${formatStamp(now)}`}
        variant="drawer"
        width={440}
      >
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h3 className="t-h3">Jump to a moment in the story</h3>
            <p className="t-dense text-asphalt-700">
              The day runs on a scenario clock that starts on Tuesday 7 April 2026 at 2:05 PM. The clock only moves
              forward; people you are not playing act on time as it passes.
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
                      compact
                      disabled={act.isPending}
                      onClick={() => act.mutate({ path: "/api/demo/clock", body: { action: "jump", to: m.key } })}
                    >
                      Go
                    </Button>
                  )}
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              {[15, 60].map((minutes) => (
                <Button
                  key={minutes}
                  density="desk"
                  icon={FastForward}
                  disabled={act.isPending}
                  onClick={() => act.mutate({ path: "/api/demo/clock", body: { action: "advance", minutes } })}
                >
                  {minutes === 60 ? "1 hour" : `${minutes} min`} ahead
                </Button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="t-h3">Your copy of the day</h3>
            <p className="t-dense text-asphalt-700">
              {data.workspace.is_default
                ? "You are in the shared walkthrough. If someone else is using it, start a private copy: it starts again at 2:05 PM on Tuesday, only for this browser."
                : "This is a private copy of the day. Open the same code on a phone to play the driver there."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                density="desk"
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
            <p className="t-dense text-asphalt-700">
              Puts this copy back to Tuesday 2:05 PM: every order, plan, load and delivery made in it is removed.
            </p>
            <div>
              <Button
                density="desk"
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
          </section>
          {act.error ? <p className="t-dense text-problem">{act.error.message}</p> : null}
        </div>
      </Sheet>
    </>
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
        className="latin h-9 w-24 rounded-chip border border-asphalt-300 bg-white px-3 t-dense uppercase"
      />
      <Button density="desk" type="submit" icon={Users}>
        Join
      </Button>
    </form>
  );
}
