// Device calls. Location is read only at Arrived, Complete stop and Send report, never in between.
import { useEffect, useState } from "react";

export type Fix = { lat: number; lng: number; accuracy_m: number };

// How long a record waits for its location, in ms. The time itself never waits.
export const LOCATION_WAIT_MS = 15_000;

// GPS works without mobile data, so this runs with or without signal. No fix gives null.
export function locate(timeoutMs = LOCATION_WAIT_MS): Promise<Fix | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const stop = window.setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(stop);
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_m: Math.min(100_000, Math.round(position.coords.accuracy)),
        });
      },
      () => {
        window.clearTimeout(stop);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

export function useLocationOff(): boolean {
  const [off, setOff] = useState(false);
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const update = () => setOff(status?.state === "denied");
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => {
        status = s;
        update();
        s.addEventListener("change", update);
      })
      .catch(() => setOff(false));
    return () => status?.removeEventListener("change", update);
  }, []);
  return off;
}

// The browser drops the lock when the page is hidden, so it is asked for again on return.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (cancelled) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => {
          // Battery saver or an unfocused tab can refuse. The trip carries on without it.
        });
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
    };
  }, [active]);
}

export async function photoSize(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: 0, height: 0 };
  }
}
