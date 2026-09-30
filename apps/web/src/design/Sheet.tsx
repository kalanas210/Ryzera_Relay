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
};

/** Sheets, drawers and dialogs, all on the native <dialog>: the browser traps focus, handles Esc and
 *  puts it in the top layer. Tapping the scrim closes it (closedby="any", with a fallback for Safari). */
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
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (modal) dialog.showModal();
      else dialog.show();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, modal]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !dismissible || "closedBy" in HTMLDialogElement.prototype) return;
    const onClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
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
      // closedby is newer than React's DOM types
      {...({ closedby: dismissible ? "any" : "none" } as Record<string, string>)}
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
          <IconButton icon={X} label="Close" density={variant === "bottom" ? "field" : "store"} onClick={onClose} />
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
