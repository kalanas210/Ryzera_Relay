import {
  CalendarClock,
  ChevronRight,
  CircleCheck,
  Clock,
  History,
  Image as ImageIcon,
  type LucideIcon,
  MapPin,
  Upload,
  User,
  WifiOff,
  X,
} from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { buttonLook } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { Card, PhoneScreen } from "@/design/Phone";
import { useOnline } from "@/design/SyncPill";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import type { Tracker } from "./api";
import { around, cases, clock } from "./words";

/** "36 rice and dhal cases, 44 packet foods cases": the list wraps between items, never inside one. */
export function Contents({ lines, className }: { lines: { name: string; qty: number }[]; className?: string }) {
  return (
    <p className={cx("t-body", className)}>
      {lines.map((l, i) => (
        <Fragment key={l.name}>
          {i > 0 ? ", " : null}
          <span className="whitespace-nowrap">{cases(l.name, l.qty)}</span>
        </Fragment>
      ))}
    </p>
  );
}

/** A row at the foot of a card that opens something: "Read the notice". */
export function LinkRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-mx-4 -mb-4 flex min-h-11 items-center justify-between gap-2 border-t border-asphalt-200 px-4 py-2 t-label-strong text-petrol-700"
    >
      {children}
      <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
    </Link>
  );
}

/** An action that opens another screen, with the store button's look: a link, so it reads and opens as one. */
export function ButtonLink({
  to,
  icon: Icon,
  variant = "secondary",
  children,
}: {
  to: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  const look = buttonLook({ variant, density: "store", full: true });
  return (
    <Link to={to} className={look.className}>
      {Icon ? <Icon size={look.icon} strokeWidth={1.75} aria-hidden /> : null}
      {children}
    </Link>
  );
}

/** The amber row for something that changed: "6 rice and dhal cases short. They come Thursday." */
export function AttentionRow({ to, children }: { to: string | null; children: ReactNode }) {
  const body = (
    <>
      <Clock size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-attention" />
      <span className="min-w-0 flex-1 t-label text-asphalt-900">{children}</span>
      {to ? <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-700" /> : null}
    </>
  );
  const box = "flex min-h-11 items-center gap-2 rounded-button bg-attention-soft px-3 py-2";
  return to ? (
    <Link to={to} className={box}>
      {body}
    </Link>
  ) : (
    <p className={box}>{body}</p>
  );
}

/** Good-to-know news, in petrol rather than amber: "Moved later at 9:12 PM. It was expected around 5:20 AM." */
export function InfoNote({ icon: Icon = CalendarClock, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-button bg-petrol-50 p-3 t-body text-asphalt-900">
      <Icon size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-petrol-700" />
      <span>{children}</span>
    </p>
  );
}

export function DetailRow({
  icon: Icon,
  children,
  sub,
  iconClass = "text-asphalt-700",
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  sub?: ReactNode;
  iconClass?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start gap-3", className)}>
      <Icon size={20} strokeWidth={1.75} aria-hidden className={cx("mt-0.5 shrink-0", iconClass)} />
      <div className="min-w-0">
        <p className="t-body text-asphalt-900">{children}</p>
        {sub ? <p className="t-label text-asphalt-500">{sub}</p> : null}
      </div>
    </div>
  );
}

/** A time Relay works out rather than one it was told: a white circle in a dashed ring. */
export function EstimateMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block size-4 shrink-0 rounded-full border-[1.5px] border-dashed border-asphalt-500 bg-white",
        className,
      )}
    />
  );
}

/** The store's own phone lost Relay: what is on screen is what was known at the last answer, in scenario time. */
export function OfflineNotice({ failed, knownAt }: { failed: boolean; knownAt: string | undefined }) {
  const online = useOnline();
  if ((online && !failed) || !knownAt) return null;
  return (
    <Notice tone="info" icon={WifiOff} compact field role="status">
      You're offline. Showing what we knew at {clock(knownAt)}.
    </Notice>
  );
}

/** "Receipt confirmed" or "Issue sent", once the server has the record. */
export function ConfirmationPanel({
  icon: Icon,
  tone,
  title,
  children,
  meta,
}: {
  icon: LucideIcon;
  tone: "done" | "problem";
  title: string;
  children: ReactNode;
  meta: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 p-6 text-center">
      <span
        className={cx(
          "flex size-16 items-center justify-center rounded-full",
          tone === "done" ? "bg-done-soft" : "bg-problem-soft",
        )}
      >
        <Icon size={32} strokeWidth={1.75} aria-hidden className={tone === "done" ? "text-done" : "text-problem"} />
      </span>
      <h2 className="t-h1">{title}</h2>
      <p className="t-body text-asphalt-700">{children}</p>
      <p className="t-label text-asphalt-500">{meta}</p>
    </Card>
  );
}

/** The driver's proof of delivery, or a plain line that it has not reached Relay yet. */
export function ProofCard({ tracker }: { tracker: Tracker }) {
  const [enlarged, setEnlarged] = useState(false);
  const proof = tracker.proof;
  const name = calledName(tracker.driver) || "the driver";
  if (!proof) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="t-h3">Proof of delivery</h2>
        <DetailRow
          icon={History}
          sub="It joins this receipt as soon as that phone reaches us. You don't need to wait for it."
        >
          Driver's proof: waiting for <span className="latin">{name}</span>'s phone
        </DetailRow>
      </Card>
    );
  }
  const delivered = clock(proof.delivered_at);
  const late = proof.sent_at ? new Date(proof.sent_at).getTime() - new Date(proof.delivered_at).getTime() : 0;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="t-h3">
        Proof of delivery from <span className="latin">{tracker.driver ?? "the driver"}</span>
      </h2>
      <div className="flex items-start gap-3">
        {proof.photo_id ? (
          <button
            type="button"
            onClick={() => setEnlarged(true)}
            aria-label={`Delivery photo, ${delivered}. Tap to enlarge.`}
            className="relative size-18 shrink-0 overflow-hidden rounded-button border border-asphalt-200"
          >
            <img src={photoUrl(proof.photo_id)} alt="" className="size-full object-cover" />
            <span className="absolute right-1 bottom-1 flex size-6 items-center justify-center rounded-chip bg-white text-asphalt-900">
              <ImageIcon size={16} strokeWidth={1.75} aria-hidden />
            </span>
          </button>
        ) : proof.photo_coming ? (
          <span className="flex size-18 shrink-0 items-center justify-center rounded-button border border-dashed border-asphalt-300 bg-asphalt-50 p-1 text-center t-caption text-asphalt-500">
            Photo on its way
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-0.5 t-body text-asphalt-900">
          {tracker.arrived_at && clock(tracker.arrived_at) !== delivered ? (
            <p>
              Arrived <span className="num">{clock(tracker.arrived_at)}</span>
            </p>
          ) : null}
          <p>
            Delivered <span className="num">{delivered}</span>
            {proof.in_window ? ", in your\u00a0window" : ""}
          </p>
          {proof.receiver ? (
            <p>
              {proof.signed ? "Signed for by" : "Received by"} <span className="latin">{proof.receiver}</span>
            </p>
          ) : null}
        </div>
      </div>
      {proof.sent_at ? (
        <p className="flex items-start gap-2 t-caption text-asphalt-500">
          <Upload size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {late >= 5 * 60_000 ? (
            <span>
              Saved on <span className="latin">{name}</span>'s phone at {delivered} and sent at {clock(proof.sent_at)},
              when the phone reached us again.
            </span>
          ) : (
            <span>
              Sent from <span className="latin">{name}</span>'s phone at {clock(proof.sent_at)}.
            </span>
          )}
        </p>
      ) : null}
      {proof.photo_id ? (
        <PhotoViewer
          open={enlarged}
          onClose={() => setEnlarged(false)}
          src={photoUrl(proof.photo_id)}
          alt={`Delivery photo, ${delivered}`}
          caption={`${delivered}, ${tracker.order_ref}`}
        />
      ) : null}
    </Card>
  );
}

/** The delivery photo filling the screen, with a close button; Esc closes it too. On the native <dialog>, so the
 *  browser keeps focus inside it and gives it back to the thumbnail. */
function PhotoViewer({
  open,
  onClose,
  src,
  alt,
  caption,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  caption: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={alt}
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-full max-w-none flex-col bg-asphalt-900 p-0 text-white open:flex backdrop:bg-asphalt-900"
    >
      <div className="flex shrink-0 items-center gap-3 py-1 pr-1 pl-4">
        <p className="min-w-0 flex-1 t-label">{caption}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-12 shrink-0 items-center justify-center rounded-button hover:bg-asphalt-700"
        >
          <X size={24} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {open ? <img src={src} alt={alt} className="min-h-0 w-full flex-1 object-contain" /> : null}
    </dialog>
  );
}

/** The photo endpoint checks who may see it; an <img> cannot send the role header, so the role rides along. */
const photoUrl = (id: string) => `/api/photos/${id}?as=store_manager`;

/** The driver's run up to this store: what is done, where the truck was last known, and this store. */
export function RunCard({ tracker }: { tracker: Tracker }) {
  const name = calledName(tracker.driver);
  // out of contact, or past the estimate: the store's own row stops claiming a time Relay was told
  const quiet = tracker.out_of_contact || tracker.passed;
  const reached = ["arrived", "delivered", "confirmed", "disputed"].includes(tracker.status);
  const before = tracker.stops.filter((s) => s.state !== "yours");
  // the stop the truck is at or heading to: the furthest one with an arrival, else the first still to come
  const current = reached
    ? undefined
    : ([...before].reverse().find((s) => s.state === "arrived") ?? before.find((s) => s.state === "pending"));
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="t-h3">
        <span className="latin">{name}</span>'s run this morning
      </h2>
      <ol className="flex flex-col">
        {tracker.stops.map((stop, i) => {
          const last = i === tracker.stops.length - 1;
          const yours = stop.state === "yours";
          const inset = yours && !quiet && !reached;
          let status: ReactNode;
          let mark: ReactNode;
          let tone = "t-label text-asphalt-700";
          if (yours && reached) {
            status = tracker.proof
              ? `Delivered ${clock(tracker.proof.delivered_at)}`
              : tracker.receipt
                ? `Your receipt ${clock(tracker.receipt.confirmed_at)}`
                : "At your store now";
            mark = <CircleCheck size={20} strokeWidth={1.75} aria-hidden className="text-done" />;
            tone = "t-label text-done";
          } else if (yours) {
            const at = stop.at ? around(stop.at) : "";
            status = tracker.passed ? (
              `Estimate passed (around ${tracker.expected ? around(tracker.expected) : at})`
            ) : quiet ? (
              <span className="inline-flex items-center gap-1.5">
                <EstimateMark />
                Around {at}
              </span>
            ) : (
              `Around ${at}`
            );
            mark = (
              <span
                className={cx(
                  "flex size-6 items-center justify-center rounded-full",
                  quiet ? "bg-asphalt-100 text-asphalt-900" : "text-petrol-700",
                )}
              >
                <MapPin size={20} strokeWidth={1.75} aria-hidden />
              </span>
            );
            tone = quiet ? "t-label-strong text-asphalt-900" : "t-label-strong text-petrol-700";
          } else if (stop.state === "delivered") {
            status = `Delivered ${stop.at ? clock(stop.at) : ""}`;
            mark = <CircleCheck size={20} strokeWidth={1.75} aria-hidden className="text-done" />;
            tone = "t-label text-done";
          } else if (stop.state === "arrived") {
            const heard = tracker.out_of_contact && stop === current && tracker.last_heard;
            status = `Arrived ${stop.at ? clock(stop.at) : ""}${heard ? `. Last heard ${clock(tracker.last_heard ?? "")}` : ""}`;
            mark = stop === current ? <SignalDot /> : <PendingDot />;
            if (stop === current) tone = "t-label-strong text-asphalt-900";
          } else {
            const at = stop.at ? around(stop.at) : "";
            status = stop === current ? `Next stop, expected around ${at}` : `Expected around ${at}`;
            mark = stop === current ? <SignalDot /> : <PendingDot />;
            if (stop === current) tone = "t-label-strong text-asphalt-900";
          }
          return (
            <li
              key={stop.seq}
              className={cx(
                "relative flex min-h-14 items-center gap-3",
                inset && "-mx-2 rounded-button bg-petrol-50 px-2",
              )}
            >
              <span className="relative flex w-6 shrink-0 items-center justify-center self-stretch">
                {i > 0 ? <span aria-hidden className="absolute top-0 h-1/2 w-0.5 bg-asphalt-300" /> : null}
                {!last ? <span aria-hidden className="absolute top-1/2 bottom-0 w-0.5 bg-asphalt-300" /> : null}
                <span
                  className={cx(
                    "relative flex items-center justify-center rounded-full",
                    inset ? "bg-petrol-50" : "bg-white",
                  )}
                >
                  {mark}
                </span>
              </span>
              <span className="flex min-w-0 flex-col py-2">
                <span className="t-body-strong text-asphalt-900">
                  Stop {stop.seq}, {yours ? "your store" : <span className="latin">{stop.place}</span>}
                </span>
                <span className={cx("num", tone)}>{status}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {reached ? null : (
        <p className="t-caption text-asphalt-500">
          {quiet
            ? `Times update when ${name}'s phone next reaches us.`
            : `Times update each time ${name} records a stop.`}
        </p>
      )}
    </Card>
  );
}

function SignalDot() {
  return <span aria-hidden className="size-3 rounded-full border-[1.5px] border-signal-ink bg-signal-400" />;
}

function PendingDot() {
  return <span aria-hidden className="size-3 rounded-full border-[1.5px] border-asphalt-300 bg-white" />;
}

/** Who is driving; there is no call button anywhere for the store. */
export function DriverRow({ tracker, depot }: { tracker: Tracker; depot: string }) {
  if (!tracker.driver) return null;
  return (
    <Card className="flex items-start gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-asphalt-100 text-asphalt-700">
        <User size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="latin t-h3">{tracker.driver}</p>
        <p className="t-label text-asphalt-700">
          Driver, <span className="latin num">{tracker.vehicle_id}</span> {tracker.vehicle_kind?.toLowerCase()}
        </p>
        {tracker.departed_at ? (
          <p className="t-label text-asphalt-500">
            Left {depot === "Kandy" ? "the Kandy hub" : <span className="latin">{depot}</span>} at{" "}
            {clock(tracker.departed_at)}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/** An order not on a published run yet (or moved to a later one) has nothing to track. */
export function NotPlanned({ header }: { header: ReactNode }) {
  return (
    <PhoneScreen header={header}>
      <Notice tone="info" field>
        This order is not on a run yet. Its delivery time shows in My orders once the dispatcher plans the run.
      </Notice>
    </PhoneScreen>
  );
}
