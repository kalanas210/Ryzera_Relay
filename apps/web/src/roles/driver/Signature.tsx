/** DRV-03 / Signature: the receiver signs on the phone with a finger. The strokes are kept as SVG path data, small
 *  enough to travel inside the delivery record, and drawn in currentColor so whoever shows it picks the ink. */
import { Eraser, PenLine } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { useDriverText } from "./words";

export type Signature = { path: string; width: number; height: number };

type Point = { x: number; y: number };

const PAD_HEIGHT = 240;
/** Points closer than this (in CSS pixels) add nothing a reader could see, so they are dropped. */
const MIN_STEP = 2;

export function pathOf(strokes: Point[][]): string {
  return strokes
    .filter((s) => s.length)
    .map((s) => {
      const [first, ...rest] = s.map((p) => `${Math.round(p.x)} ${Math.round(p.y)}`);
      // a tap is a dot: a stroke needs some length to be drawn with round caps
      return rest.length ? `M${first}L${rest.join("L")}` : `M${first}l0.1 0`;
    })
    .join("");
}

export function svgOf(signature: Signature): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${signature.width} ${signature.height}">` +
    `<path d="${signature.path}" fill="none" stroke="currentColor" stroke-width="2.5" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></svg>`
  );
}

/** A kept signature, drawn back at the width it was made. */
export function SignatureView({ signature, label }: { signature: Signature; label: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${signature.width} ${signature.height}`}
      className="h-auto w-full text-asphalt-900"
    >
      <path
        d={signature.path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SignatureSheet({
  open,
  onClose,
  receiver,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  receiver: string;
  onUse: (signature: Signature) => void;
}) {
  const { t } = useDriverText();
  const [signature, setSignature] = useState<Signature | null>(null);
  const [clearKey, setClearKey] = useState(0);
  const clear = () => {
    setSignature(null);
    setClearKey((k) => k + 1);
  };
  return (
    <Sheet
      open={open}
      onClose={() => {
        clear();
        onClose();
      }}
      title={receiver.trim() ? t("sign.title", { name: receiver.trim() }) : t("sign.titleNoName")}
      closeLabel={t("header.close")}
    >
      <div className="flex flex-col gap-4">
        {open ? (
          <SignaturePad key={clearKey} label={t("sign.box")} hint={t("sign.here")} onChange={setSignature} />
        ) : null}
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            density="field"
            full
            disabled={!signature}
            reason={t("sign.first")}
            onClick={() => {
              if (!signature) return;
              onUse(signature);
              clear();
              onClose();
            }}
          >
            {t("sign.use")}
          </Button>
          <Button variant="quiet" density="field" full icon={Eraser} onClick={clear}>
            {t("sign.clear")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** Signature pad, 240 high: pointer strokes on a canvas, with a baseline and "Sign here" to aim at. */
function SignaturePad({
  label,
  hint,
  onChange,
}: {
  label: string;
  hint: string;
  onChange: (signature: Signature | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);
  const width = useRef(0);

  const redraw = useCallback(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = getComputedStyle(c).color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes.current) {
      const [first, ...rest] = stroke;
      if (!first) continue;
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      if (!rest.length) ctx.lineTo(first.x + 0.1, first.y);
      for (const p of rest) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }, []);

  // the canvas follows its box, which is only laid out once the sheet is open
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const resize = () => {
      const rect = c.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = window.devicePixelRatio || 1;
      width.current = rect.width;
      c.width = Math.round(rect.width * ratio);
      c.height = Math.round(PAD_HEIGHT * ratio);
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(c);
    return () => observer.disconnect();
  }, [redraw]);

  const at = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const done = () => {
    drawing.current = false;
    const path = pathOf(strokes.current);
    onChange(path ? { path, width: Math.round(width.current), height: PAD_HEIGHT } : null);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        className="block h-60 w-full touch-none rounded-card border border-asphalt-300 bg-white text-asphalt-900"
        onPointerDown={(event) => {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // a pointer the browser no longer tracks: the stroke still draws while it stays on the pad
          }
          drawing.current = true;
          strokes.current.push([at(event)]);
          redraw();
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const stroke = strokes.current[strokes.current.length - 1];
          const last = stroke?.[stroke.length - 1];
          const p = at(event);
          if (!stroke || (last && Math.hypot(p.x - last.x, p.y - last.y) < MIN_STEP)) return;
          stroke.push(p);
          redraw();
        }}
        onPointerUp={done}
        onPointerCancel={done}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-4 bottom-[60px] flex flex-col gap-1">
        <span className="flex items-center gap-1.5 t-label text-asphalt-500">
          <PenLine size={16} strokeWidth={1.75} />
          {hint}
        </span>
        <span className="h-px bg-asphalt-200" />
      </div>
    </div>
  );
}
