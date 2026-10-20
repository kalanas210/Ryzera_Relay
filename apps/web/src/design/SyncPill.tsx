import { useIsMutating } from "@tanstack/react-query";
import { CircleCheck, CloudOff, RefreshCw } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cx } from "@/lib/cx";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

type Props = {
  synced: string;
  sending: string;
  offline: string;
  // records saved on this device that have not reached Relay yet
  waiting?: number;
  toSend?: (count: number) => string;
};

// Status only, never a button. Every count it shows is a real one, so with nothing waiting it reads plain "Offline".
export function SyncPill({ synced, sending, offline, waiting = 0, toSend }: Props) {
  const online = useOnline();
  const busy = useIsMutating() > 0;
  const state = !online || waiting > 0 ? "offline" : busy ? "sending" : "synced";
  const Icon = state === "offline" ? CloudOff : state === "sending" ? RefreshCw : CircleCheck;
  const label =
    state === "offline" ? (waiting > 0 && toSend ? toSend(waiting) : offline) : state === "sending" ? sending : synced;
  return (
    <span
      role="status"
      className={cx(
        "inline-flex h-8 max-w-[140px] shrink-0 items-center gap-1 rounded-chip px-2 t-label",
        state === "synced"
          ? "bg-done-soft text-done"
          : // offline and sending follow the Waiting rule
            "border border-asphalt-300 bg-waiting-soft text-asphalt-700",
      )}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
      <span className="min-w-0 leading-tight">{label}</span>
    </span>
  );
}
