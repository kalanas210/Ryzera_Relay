import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { cx } from "@/lib/cx";
import { IconButton } from "./Button";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** bottom: a phone sheet; drawer: the dispatcher's side drawer; dialog: a centered confirmation. */
  variant?: "bottom" | "drawer" | "dialog";
  width?: number;
  meta?: ReactNode;
  /** A drawer without a scrim leaves the page behind it readable (DEG-03 / move stop 4). */
  modal?: boolean;
  dismissible?: boolean;
  /** The close button's accessible name, in the reader's language. */
  closeLabel?: string;
};

/** Pointers held down on the page right now. A sheet that opens during a press (a press and hold, say) must not be
 *  light dismissed by the release of that same press: the browser saw no dialog when the press began, so it reads
 *  the release as a tap outside. */
const pressed = new Set<number>();
if (typeof window !== "undefined") {
  const release = (event: PointerEvent) => pressed.delete(event.pointerId);
  window.addEventListener("pointerdown", (event) => pressed.add(event.pointerId), true);
  window.addEventListener("pointerup", release, true);
  window.addEventListener("pointercancel", release, true);
}

// Esc still closes a sheet that is not armed yet; only a tap outside waits for a fresh press.
const closedBy = (dismissible: boolean, armed: boolean) => (dismissible ? (armed ? "any" : "closerequest") : "none");

/** Sheets, drawers and dialogs, all on the native <dialog>: the browser traps focus, handles Esc and
 *  puts it in the top layer. Tapping the scrim closes it (closedby="any", with a fallback for Safari), once the
 *  press that opened it has ended. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "bottom",
  width,
  meta,
  modal = true,
  dismissible = true,
  closeLabel = "Close",
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // False from an open during a press until the next press starts.
  const armed = useRef(true);

  // closedby is set here rather than as a prop, so React never puts "any" back in the middle of a press.
  useEffect(() => {
    ref.current?.setAttribute("closedby", closedBy(dismissible, armed.current));
  }, [dismissible]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      armed.current = pressed.size === 0;
      dialog.setAttribute("closedby", closedBy(dismissible, armed.current));
      if (modal) dialog.showModal();
      else dialog.show();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, modal, dismissible]);

  useEffect(() => {
    if (!open) return;
    const arm = () => {
      if (armed.current) return;
      armed.current = true;
      ref.current?.setAttribute("closedby", closedBy(dismissible, true));
    };
    window.addEventListener("pointerdown", arm, true);
    return () => window.removeEventListener("pointerdown", arm, true);
  }, [open, dismissible]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !dismissible || "closedBy" in HTMLDialogElement.prototype) return;
    const onClick = (event: MouseEvent) => {
      if (event.target !== dialog || !armed.current) return;
      const r = dialog.getBoundingClientRect();
      const inside =
        r.top <= event.clientY && event.clientY <= r.bottom && r.left <= event.clientX && event.clientX <= r.right;
      if (!inside) dialog.close();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, [dismissible]);

  const place =
    variant === "bottom"
      ? "mt-auto mb-0 w-full max-w-[560px] mx-auto rounded-t-sheet rounded-b-none max-h-[92dvh]"
      : variant === "drawer"
        ? "ml-auto mr-0 my-0 h-dvh max-h-dvh rounded-l-sheet rounded-r-none"
        : "m-auto rounded-sheet max-h-[90dvh]";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault();
      }}
      style={width ? { width, maxWidth: "100vw" } : undefined}
      className={cx(
        "flex-col bg-white p-0 text-asphalt-900 shadow-float open:flex backdrop:bg-scrim",
        place,
        !modal && "fixed inset-y-0 right-0 z-40",
      )}
    >
      {variant === "bottom" ? (
        <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-asphalt-300" />
      ) : null}
      <header
        className={cx(
          "flex shrink-0 items-start gap-3",
          variant === "bottom" ? "px-4 pt-2 pb-3" : "border-b border-asphalt-200 px-6 py-4",
        )}
      >
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="t-h2">
            {title}
          </h2>
          {meta ? <p className="t-label mt-0.5 text-asphalt-700">{meta}</p> : null}
        </div>
        {dismissible ? (
          <IconButton
            icon={X}
            label={closeLabel}
            density={variant === "bottom" ? "field" : "store"}
            onClick={onClose}
          />
        ) : null}
      </header>
      <div className={cx("min-h-0 flex-1 overflow-y-auto", variant === "bottom" ? "px-4 pb-4" : "px-6 py-4")}>
        {children}
      </div>
      {footer ? (
        <footer
          className={cx(
            "shrink-0 border-t border-asphalt-200 bg-white",
            variant === "bottom" ? "px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]" : "px-6 py-3",
          )}
        >
          {footer}
        </footer>
      ) : null}
    </dialog>
  );
}
