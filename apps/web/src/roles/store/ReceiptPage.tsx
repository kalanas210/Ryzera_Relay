import {
  Circle,
  CircleAlert,
  CircleDot,
  Info,
  type LucideIcon,
  Package,
  PackageCheck,
  PackageX,
  PenLine,
  RefreshCw,
  Send,
  Snowflake,
  Thermometer,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiError } from "@/api/client";
import { useMe } from "@/app/session";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { BackHeader, Card, PhoneScreen } from "@/design/Phone";
import { Sheet } from "@/design/Sheet";
import { StatusChip } from "@/design/StatusChip";
import { Stepper } from "@/design/Stepper";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { dayOf, formatDayLong, formatWeekday } from "@/lib/time";
import {
  type Issue,
  type IssueKind,
  plural,
  type StoreHome,
  type StoreOrder,
  type Tracker,
  useConfirmReceipt,
  useReportIssues,
  useStoreHome,
  useStoreNotices,
  useTracker,
} from "./api";
import { ConfirmationPanel, DetailRow, NotPlanned, ProofCard } from "./parts";
import { cases, clock, flaggedLabel, issueSentAt, placedAt, sendIssues, shortLines, windowOf } from "./words";

/** One line of the receipt: what was loaded for the store, and what the driver's proof says was handed over. */
type Line = {
  code: string;
  name: string;
  qty: number;
  /** "30 loaded" before the driver's proof, "30 delivered" after. */
  qtyLabel: string;
  /** "6 short. You were told at 2:52 AM. Coming Thursday." */
  note: string | null;
};

type Staged = { flags: Record<string, Issue>; clientRef: string };

const KEY = (orderRef: string) => `relay.store.receipt.${orderRef}`;

/** The store's flags stay on the phone until they reach Relay, across a reload too; the same client_ref goes with every
 *  try, so a retry never makes a second receipt. */
function useStaged(orderRef: string) {
  const [staged, setStaged] = useState<Staged>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY(orderRef)) ?? "null") as Staged | null;
      if (saved?.clientRef) return saved;
    } catch {
      // nothing saved, or storage is blocked: start clean
    }
    return { flags: {}, clientRef: crypto.randomUUID() };
  });
  const save = (next: Staged) => {
    setStaged(next);
    try {
      localStorage.setItem(KEY(orderRef), JSON.stringify(next));
    } catch {
      // the flags still live on this screen
    }
  };
  // once Relay has the receipt, nothing is left to keep
  const clear = () => {
    setStaged({ flags: {}, clientRef: crypto.randomUUID() });
    try {
      localStorage.removeItem(KEY(orderRef));
    } catch {
      // nothing was kept
    }
  };
  return { staged, save, clear };
}

/** STM-05 Confirm receipt: check the goods against what was loaded for the store, flag a wrong line, and confirm.
 *  Afterwards the same page is the store's receipt, with the driver's proof once it arrives. */
export function ReceiptPage() {
  const { orderRef = "" } = useParams();
  const tracker = useTracker(orderRef);
  const home = useStoreHome();
  const notices = useStoreNotices();
  const me = useMe("store_manager");
  const now = useSimNow(15_000);
  const navigate = useNavigate();
  const confirm = useConfirmReceipt(orderRef);
  const report = useReportIssues(orderRef);
  const { staged, save, clear } = useStaged(orderRef);
  const [flagging, setFlagging] = useState<Line | null>(null);
  // sent from this screen just now: the confirmation shows until the page is left, then it is the receipt
  const [sent, setSent] = useState(false);
  const back = () => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate("/store"));

  const t = tracker.data;
  const data = home.data;
  const order = data?.orders.find((o) => o.order_ref === orderRef);
  const title = t?.receipt && !(sent && t.receipt.status === "confirmed") ? "Your receipt" : "Confirm receipt";
  const header = <BackHeader title={title} back={back} />;
  if (!t || !data || !order || !now) return <PhoneScreen header={header}>{null}</PhoneScreen>;
  if (t.stop_seq === null) return <NotPlanned header={header} />;

  const driver = calledName(t.driver) || "the driver";
  const lines = receiptLines(t, data, notices.data ?? []);
  const total = lines.reduce((n, l) => n + l.qty, 0);
  const done = () => navigate("/store");
  const kindChip = <StatusChip kind={t.kind === "chilled" ? "chilled" : "dry"} />;
  const toCome = <StillToCome order={order} tracker={t} home={data} notices={notices.data ?? []} />;

  // a problem can still be reported until 4:00 PM on the delivery day, after confirming too
  const issuesOpen = Boolean(t.issues_until && now.getTime() < Date.parse(t.issues_until));
  const until = t.issues_until ? clock(t.issues_until) : "";

  // just sent from this screen: the server has it, so now it may say so
  if (sent && t.receipt) {
    const r = t.receipt;
    return (
      <PhoneScreen
        header={header}
        bar={
          <Button variant="primary" full onClick={done}>
            Back to my orders
          </Button>
        }
      >
        {r.status === "confirmed" ? (
          <ConfirmationPanel
            icon={PackageCheck}
            tone="done"
            title="Receipt confirmed"
            meta={
              <>
                <span className="latin num">{t.order_ref}</span>, {total} cases, confirmed {clock(r.confirmed_at)}
              </>
            }
          >
            Thanks, {calledName(me.data?.display_name)}. The dispatcher can see your receipt
            {r.before_driver_proof ? `, so they know ${driver} has been to your store.` : "."}
          </ConfirmationPanel>
        ) : (
          <ConfirmationPanel
            icon={CircleAlert}
            tone="problem"
            title="Issue sent"
            meta={
              <>
                <span className="latin num">{t.order_ref}</span>, sent {clock(issueSentAt(r))}
              </>
            }
          >
            {t.proof?.photo_id
              ? `The dispatcher can see your ${r.issues.length === 1 ? "flag" : "flags"} and ${driver}'s photo.`
              : `The dispatcher can see your ${r.issues.length === 1 ? "flag" : "flags"}.`}
          </ConfirmationPanel>
        )}
        {t.proof ? null : <ProofCard tracker={t} />}
        {toCome}
        {r.status === "confirmed" && issuesOpen ? (
          <div className="flex flex-col items-start gap-1">
            <Button variant="quiet" compact icon={CircleAlert} className="-ml-3 px-3" onClick={() => setSent(false)}>
              Report a problem
            </Button>
            <p className="t-caption text-asphalt-500">You can still report a problem until {until} today</p>
          </div>
        ) : null}
      </PhoneScreen>
    );
  }

  // the receipt, on any later visit: until 4:00 PM a line can still be flagged and sent on its own
  if (t.receipt) {
    const r = t.receipt;
    const issues = Object.fromEntries(r.issues.map((i) => [i.case_type, i]));
    const fresh = Object.fromEntries(Object.entries(staged.flags).filter(([code]) => !issues[code]));
    const freshCount = Object.keys(fresh).length;
    const reportOffline = report.error instanceof ApiError && report.error.offline;
    const sendLater = () => {
      save(staged);
      report.mutate(
        { client_ref: staged.clientRef, issues: Object.values(fresh) },
        {
          onSuccess: () => {
            clear();
            setSent(true);
          },
        },
      );
    };
    return (
      <PhoneScreen
        header={header}
        bar={
          freshCount ? (
            <>
              {reportOffline ? (
                <Notice tone="waiting" compact field icon={WifiOff} role="status">
                  Not sent. Your phone is offline. Your flags are saved here.
                </Notice>
              ) : report.error ? (
                <Notice tone="problem" compact field role="alert">
                  {report.error.message}
                </Notice>
              ) : (
                <p className="text-center t-caption text-asphalt-500">
                  The dispatcher gets your {freshCount === 1 ? "flag" : "flags"} straight away.
                </p>
              )}
              <Button
                variant="primary"
                full
                icon={reportOffline ? RefreshCw : Send}
                disabled={report.isPending}
                onClick={sendLater}
              >
                {reportOffline ? "Try again" : sendIssues(freshCount)}
              </Button>
            </>
          ) : (
            <Button variant="primary" full onClick={done}>
              Back to my orders
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {kindChip}
            {r.status === "confirmed" ? (
              <StatusChip kind="confirmed" />
            ) : (
              <StatusChip tone="problem" icon={CircleAlert}>
                Issue sent
              </StatusChip>
            )}
          </div>
          <p className="t-label text-asphalt-500">
            <span className="latin num">{t.order_ref}</span>.{" "}
            {r.status === "confirmed"
              ? `You confirmed receipt at ${clock(r.confirmed_at)}`
              : `You sent an issue at ${clock(issueSentAt(r))}`}
          </p>
        </div>
        <ProofCard tracker={t} />
        <LinesCard
          lines={lines}
          total={total}
          helper={`${
            t.proof
              ? matches(t)
                ? `${driver}'s record matches what was loaded for you.`
                : `These are the counts loaded for you. ${driver}'s record is above.`
              : "These are the counts loaded for you."
          }${issuesOpen ? " Flag a line if you find a problem." : ""}`}
          flags={{ ...issues, ...fresh }}
          onFlag={issuesOpen ? setFlagging : undefined}
          locked={issues}
        />
        {issuesOpen ? (
          <p className="t-caption text-asphalt-500">You can report a problem until {until} today.</p>
        ) : null}
        {toCome}
        <FlagSheet
          line={flagging}
          chilled={t.kind === "chilled"}
          current={flagging ? fresh[flagging.code] : undefined}
          onClose={() => setFlagging(null)}
          onSave={(issue) => {
            save({ ...staged, flags: { ...staged.flags, [issue.case_type]: issue } });
            setFlagging(null);
          }}
          onRemove={(code) => {
            const { [code]: _, ...rest } = staged.flags;
            save({ ...staged, flags: rest });
            setFlagging(null);
          }}
        />
      </PhoneScreen>
    );
  }

  const flags = staged.flags;
  const flagCount = Object.keys(flags).length;
  const offline = confirm.error instanceof ApiError && confirm.error.offline;
  const departed = t.status !== "scheduled";
  const send = () => {
    save(staged); // the client_ref outlives a reload, so a retry after one still finds the first try
    confirm.mutate(
      { client_ref: staged.clientRef, issues: Object.values(flags) },
      {
        onSuccess: () => {
          clear();
          setSent(true);
        },
      },
    );
  };

  const linesCard = (
    <LinesCard
      lines={lines}
      total={total}
      helper={
        t.proof
          ? matches(t)
            ? `${driver}'s record matches what was loaded for you. Flag a line if you find a problem.`
            : `Check the goods against what was loaded for you. Flag a line if you find a problem.`
          : "Check the goods at your dock against what was loaded for you. Flag any line that's wrong."
      }
      flags={flags}
      onFlag={setFlagging}
    />
  );

  return (
    <PhoneScreen
      header={header}
      bar={
        <>
          {offline ? (
            <Notice tone="waiting" compact field icon={WifiOff} role="status">
              {flagCount
                ? "Not sent. Your phone is offline. Your flags are saved here."
                : "Not sent. Your phone is offline."}
            </Notice>
          ) : confirm.error ? (
            <Notice tone="problem" compact field role="alert">
              {confirm.error.message}
            </Notice>
          ) : (
            <p className="text-center t-caption text-asphalt-500">
              {flagCount
                ? t.proof
                  ? `The dispatcher gets your ${flagCount === 1 ? "flag" : "flags"} and ${driver}'s proof together.`
                  : `The dispatcher gets your ${flagCount === 1 ? "flag" : "flags"} straight away.`
                : "If something's wrong, flag that line first."}
            </p>
          )}
          <Button
            variant="primary"
            full
            icon={offline ? RefreshCw : flagCount ? Send : PackageCheck}
            disabled={!departed || confirm.isPending}
            onClick={send}
          >
            {offline ? "Try again" : flagCount ? sendIssues(flagCount) : "Everything arrived"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <div>{kindChip}</div>
        <p className="t-label text-asphalt-500">
          <span className="latin num">{t.order_ref}</span>. {placedAt(order, now)}
        </p>
      </div>
      {!departed ? (
        <Notice tone="info" field>
          The delivery has not left the hub yet. You can confirm receipt once it reaches your store.
        </Notice>
      ) : null}
      {t.proof ? (
        <>
          <ProofCard tracker={t} />
          {linesCard}
        </>
      ) : (
        <>
          {linesCard}
          {departed ? <ProofCard tracker={t} /> : null}
        </>
      )}
      <FlagSheet
        line={flagging}
        chilled={t.kind === "chilled"}
        current={flagging ? flags[flagging.code] : undefined}
        onClose={() => setFlagging(null)}
        onSave={(issue) => {
          save({ ...staged, flags: { ...flags, [issue.case_type]: issue } });
          setFlagging(null);
        }}
        onRemove={(code) => {
          const { [code]: _, ...rest } = flags;
          save({ ...staged, flags: rest });
          setFlagging(null);
        }}
      />
    </PhoneScreen>
  );
}

/** The driver's proof agrees with what was loaded, line for line. */
function matches(t: Tracker): boolean {
  if (!t.proof) return false;
  const delivered = Object.fromEntries(t.proof.lines.map((l) => [l.case_type, l.qty]));
  return t.on_board.every((l) => (delivered[l.case_type] ?? l.on_board) === l.on_board);
}

function receiptLines(t: Tracker, home: StoreHome, notices: Parameters<typeof shortLines>[2]): Line[] {
  const names = Object.fromEntries(home.case_types.map((c) => [c.code, c.name]));
  const shorts = Object.fromEntries(shortLines(t, home, notices).map((s) => [s.case_type, s]));
  const delivered = Object.fromEntries((t.proof?.lines ?? []).map((l) => [l.case_type, l.qty]));
  return t.on_board.map((l) => {
    const qty = t.proof ? (delivered[l.case_type] ?? l.on_board) : l.on_board;
    const s = shorts[l.case_type];
    const told = s?.notice ? ` You were told at ${clock(s.notice.created_at)}.` : "";
    const then = s?.day ? ` Coming ${s.day}.` : " They won't be replaced.";
    return {
      code: l.case_type,
      name: names[l.case_type] ?? l.name,
      qty,
      qtyLabel: `${qty} ${t.proof ? "delivered" : "loaded"}`,
      note: s ? `${s.qty} short.${told}${then}` : null,
    };
  });
}

function LinesCard({
  lines,
  total,
  helper,
  flags,
  onFlag,
  locked = {},
}: {
  lines: Line[];
  total: number;
  helper: string;
  flags: Record<string, Pick<Issue, "kind" | "qty" | "note">>;
  onFlag?: (line: Line) => void;
  /** Lines already reported to the dispatcher: shown, no longer changed here. */
  locked?: Record<string, unknown>;
}) {
  return (
    <Card className="flex flex-col gap-1 px-4 pt-4 pb-1">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="t-h3">What arrived</h2>
        <span className="num t-label-strong text-asphalt-700">{total} cases</span>
      </div>
      <p className="t-body text-asphalt-700">{helper}</p>
      <ul className="flex flex-col">
        {lines.map((line, i) => {
          const flag = flags[line.code];
          return (
            <li
              key={line.code}
              className={cx(
                "flex min-h-16 items-center justify-between gap-3",
                flag ? "my-1 rounded-button bg-problem-soft px-3 py-2" : "py-2",
                !flag && i < lines.length - 1 && "border-b border-asphalt-200",
              )}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="t-h3 text-asphalt-900">{line.name}</p>
                <p className="num t-body text-asphalt-700">{line.qtyLabel}</p>
                {flag ? (
                  <>
                    <p className="flex items-center gap-1.5 t-label-strong text-problem">
                      <TriangleAlert size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                      {flaggedLabel(flag.kind, flag.qty)}
                    </p>
                    {flag.note ? <p className="t-label text-asphalt-700">{flag.note}</p> : null}
                  </>
                ) : line.note ? (
                  <p className="flex items-start gap-1.5 t-label text-attention">
                    <Info size={16} strokeWidth={1.75} aria-hidden className="mt-px shrink-0" />
                    {line.note}
                  </p>
                ) : null}
              </div>
              {onFlag && !locked[line.code] ? (
                <Button
                  variant="quiet"
                  compact
                  icon={flag ? PenLine : CircleAlert}
                  className="shrink-0 px-3"
                  aria-label={`${flag ? "Change the flag on" : "Flag"} ${line.name}`}
                  onClick={() => onFlag(line)}
                >
                  {flag ? "Change" : "Flag"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** What is still to come: an order moved to a later run, and cases decided short that ride on a later order. */
function StillToCome({
  order,
  tracker,
  home,
  notices,
}: {
  order: StoreOrder;
  tracker: Tracker;
  home: StoreHome;
  notices: Parameters<typeof shortLines>[2];
}) {
  const window = windowOf(home.outlet);
  const from = formatWeekday(dayOf(order.run_date));
  const moved = home.orders.filter((o) => o.requested_date === order.run_date && o.run_date !== o.requested_date);
  const carried = shortLines(tracker, home, notices).filter((s) => s.comesOn && s.date);
  if (!moved.length && !carried.length) return null;
  const days = [...new Set([...moved.map((o) => o.run_date), ...carried.map((s) => s.date ?? "")])];
  const title = days.length === 1 && days[0] ? `Still to come on ${formatDayLong(dayOf(days[0]))}` : "Still to come";
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="t-h3">{title}</h2>
      {moved.map((o) => (
        <DetailRow
          key={o.id}
          icon={o.temp === "chilled" ? Snowflake : Package}
          iconClass={o.temp === "chilled" ? "text-chilled" : "text-asphalt-700"}
          sub={
            <>
              {window}, <span className="latin num">{o.order_ref}</span>, moved from {from}
            </>
          }
        >
          Your {o.temp === "chilled" ? "chilled" : "dry"} order, {o.units} cases
        </DetailRow>
      ))}
      {carried.map((s) => (
        <DetailRow
          key={s.case_type}
          icon={Package}
          sub={
            <>
              {window}, on <span className="latin num">{s.comesOn}</span>, marked from {from}
            </>
          }
        >
          {cases(s.name, s.qty)}
        </DetailRow>
      ))}
    </Card>
  );
}

const CHOICES: { kind: IssueKind; label: string; icon: LucideIcon }[] = [
  { kind: "missing", label: "Missing", icon: PackageX },
  { kind: "damaged", label: "Damaged", icon: TriangleAlert },
  { kind: "not_cold", label: "Not cold on arrival", icon: Thermometer },
];

/** Flag one line: what is wrong and how many. Staged on the phone; nothing is sent until the receipt is. */
function FlagSheet({
  line,
  chilled,
  current,
  onSave,
  onRemove,
  onClose,
}: {
  line: Line | null;
  chilled: boolean;
  current: Issue | undefined;
  onSave: (issue: Issue) => void;
  onRemove: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={Boolean(line)} onClose={onClose} title={line?.name ?? ""} meta={line?.qtyLabel}>
      {line ? (
        <FlagForm
          key={`${line.code}-${current?.kind ?? ""}`}
          line={line}
          chilled={chilled}
          current={current}
          onSave={onSave}
          onRemove={onRemove}
        />
      ) : null}
    </Sheet>
  );
}

function FlagForm({
  line,
  chilled,
  current,
  onSave,
  onRemove,
}: {
  line: Line;
  chilled: boolean;
  current: Issue | undefined;
  onSave: (issue: Issue) => void;
  onRemove: (code: string) => void;
}) {
  const [kind, setKind] = useState<IssueKind | null>(current?.kind ?? null);
  const [qty, setQty] = useState(current?.qty ?? 1);
  const [note, setNote] = useState(current?.note ?? "");
  const max = Math.max(1, line.qty);
  return (
    <div className="flex flex-col gap-4 pb-2">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 t-label text-asphalt-700">What's wrong?</legend>
        <div role="radiogroup" className="flex flex-col gap-2">
          {CHOICES.filter((c) => chilled || c.kind !== "not_cold").map((c) => {
            const selected = kind === c.kind;
            const Radio = selected ? CircleDot : Circle;
            return (
              // biome-ignore lint/a11y/useSemanticElements: a styled choice row, 56 high
              <button
                key={c.kind}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setKind(c.kind)}
                className={cx(
                  "flex min-h-14 items-center gap-3 rounded-button px-4 text-left",
                  selected
                    ? "border-2 border-petrol-700 bg-petrol-50 t-body-strong"
                    : "border border-asphalt-200 bg-white t-body",
                )}
              >
                <Radio
                  size={20}
                  strokeWidth={1.75}
                  aria-hidden
                  className={selected ? "text-petrol-700" : "text-asphalt-500"}
                />
                <c.icon size={20} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex items-center justify-between gap-3">
        <span className="t-body">How many?</span>
        <Stepper
          value={Math.min(qty, max)}
          onChange={setQty}
          min={1}
          max={max}
          label="How many?"
          unit={plural(line.name, 2)}
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className="sr-only">Note</span>
        <textarea
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a note (optional)"
          rows={3}
          className="min-h-18 w-full rounded-chip border border-asphalt-300 bg-white p-3 t-body text-asphalt-900 placeholder:text-asphalt-500"
        />
      </label>
      <Button
        variant="primary"
        full
        disabled={!kind}
        onClick={() => kind && onSave({ case_type: line.code, kind, qty: Math.min(qty, max), note: note.trim() })}
      >
        Add to receipt
      </Button>
      {current ? (
        <Button variant="quiet" full onClick={() => onRemove(line.code)}>
          Remove this flag
        </Button>
      ) : null}
    </div>
  );
}
