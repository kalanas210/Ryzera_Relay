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
  sending?: string;
  offline: string;
  /** Records saved on this device that have not reached Relay yet. */
  waiting?: number;
};

/** Status only, never a button: all synced, sending, or offline with what is still to send. */
export function SyncPill({ synced, sending = synced, offline, waiting = 0 }: Props) {
  const online = useOnline();
  const busy = useIsMutating() > 0;
  const state = !online || waiting > 0 ? "offline" : busy ? "sending" : "synced";
  const Icon = state === "offline" ? CloudOff : state === "sending" ? RefreshCw : CircleCheck;
  return (
    <span
      role="status"
      className={cx(
        "inline-flex h-8 max-w-[140px] shrink-0 items-center gap-1 rounded-chip px-2 t-label",
        state === "synced" && "bg-done-soft text-done",
        state === "sending" && "bg-petrol-50 text-petrol-700",
        state === "offline" && "border border-asphalt-300 bg-waiting-soft text-asphalt-700",
      )}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
      <span className="min-w-0 leading-tight">
        {state === "offline" ? offline : state === "sending" ? sending : synced}
      </span>
    </span>
  );
}
