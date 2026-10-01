import {
  Check,
  ClipboardList,
  Info,
  type LucideIcon,
  MessageSquare,
  Package,
  PackageX,
  Route,
  Send,
  TriangleAlert,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { Stepper } from "@/design/Stepper";
import { useLoaderText, weekdayIn } from "@/i18n";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { type LoadLine, loadKindKey, type StopGroup, type TripLoad, useFlag, useWithdrawFlag } from "./api";

type Props = {
  load: TripLoad;
  group: StopGroup | null;
  line: LoadLine | null;
  onClose: () => void;
};

/** LDR-03 Flag a shortfall: two taps for a missing line, and the dispatcher's answer in the same place. */
export function FlagSheet({ load, group, line, onClose }: Props) {
  const { t } = useLoaderText();
  const open = Boolean(group && line);
  const item = line ? t(`cases.${line.case_type}`, { defaultValue: line.case_type }) : "";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={group && line ? t("flag.title", { item, n: group.seq }) : ""}
      meta={
        group ? (
          <span className="latin">
            {t("flag.meta", { place: group.place, outlet: group.outlet_id, order: group.order_ref })}
          </span>
        ) : undefined
      }
      closeLabel={t("who.close")}
    >
      {group && line ? (
        line.shortfall ? (
          <FlagRecord load={load} group={group} line={line} onClose={onClose} />
        ) : (
          <NewFlag load={load} group={group} line={line} onClose={onClose} />
        )
      ) : null}
    </Sheet>
  );
}

function NewFlag({
  load,
  group,
  line,
  onClose,
}: {
  load: TripLoad;
  group: StopGroup;
  line: LoadLine;
  onClose: () => void;
}) {
  const { t } = useLoaderText();
  const flag = useFlag(load.trip_id);
  const [kind, setKind] = useState<"missing" | "damaged">("missing");
  const [qty, setQty] = useState(() => (line.loaded > 0 && line.loaded < line.qty ? line.qty - line.loaded : 1));
  const shelf = line.qty - qty;
  const kindLabel = t(`kinds.${load.temp === "chilled" ? "chilled" : load.brand === "Fresh" ? "dry" : load.brand}`);
  return (
    <div className="flex flex-col gap-4 pb-2">
      <p className="flex items-center gap-1.5 t-label text-asphalt-700">
        <Package size={16} strokeWidth={1.75} aria-hidden />
        {t("flag.planned", { kind: kindLabel, n: line.qty })}
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 t-label text-asphalt-700">{t("flag.what")}</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {(["missing", "damaged"] as const).map((k) => {
            const Icon = k === "missing" ? PackageX : TriangleAlert;
            const selected = kind === k;
            return (
              // biome-ignore lint/a11y/useSemanticElements: a styled two-way choice, 64 high for gloves
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setKind(k)}
                className={cx(
                  "flex h-16 items-center justify-center gap-2 rounded-button t-field-button",
                  selected
                    ? "border-2 border-petrol-700 bg-petrol-50 text-petrol-700"
                    : "border border-asphalt-300 bg-white text-asphalt-900",
                )}
              >
                <Icon size={24} strokeWidth={1.75} aria-hidden />
                {k === "missing" ? t("flag.missing") : t("flag.damaged")}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <p className="t-label text-asphalt-700">
          {kind === "missing" ? t("flag.howManyMissing") : t("flag.howManyDamaged")}
        </p>
        <div className="flex items-center gap-3">
          <Stepper
            value={qty}
            onChange={setQty}
            min={1}
            max={line.qty}
            label={kind === "missing" ? t("flag.howManyMissing") : t("flag.howManyDamaged")}
            unit={t(`cases.${line.case_type}`, { defaultValue: line.case_type })}
            size="field"
          />
          <span className="num t-label text-asphalt-700">{t("load.of", { n: line.qty })}</span>
        </div>
        <p className="t-body text-asphalt-700">
          {kind === "missing" ? t("flag.shelf", { shelf }) : t("flag.damagedHelp")}
        </p>
      </div>
      <p className="flex items-start gap-3 t-body text-asphalt-700">
        <Info size={24} strokeWidth={1.75} aria-hidden className="shrink-0" />
        {t("flag.info", { name: load.dispatcher ?? "", n: qty })}
      </p>
      {flag.error ? (
        <p role="alert" className="t-body-strong text-problem">
          {t("load.notSaved", { message: flag.error.message })}
        </p>
      ) : null}
      <Button
        variant="primary"
        density="field"
        full
        icon={Send}
        disabled={flag.isPending}
        onClick={() => flag.mutate({ lineId: line.id, kind, qty }, { onSuccess: onClose })}
      >
        {kind === "missing" ? t("flag.sendMissing", { n: qty }) : t("flag.sendDamaged", { n: qty })}
      </Button>
      <span className="sr-only">{group.place}</span>
    </div>
  );
}

function FlagRecord({
  load,
  group,
  line,
  onClose,
}: {
  load: TripLoad;
  group: StopGroup;
  line: LoadLine;
  onClose: () => void;
}) {
  const { t, lang, clock } = useLoaderText();
  const withdraw = useWithdrawFlag(load.trip_id);
  const s = line.shortfall;
  if (!s) return null;
  const Icon = s.kind === "missing" ? PackageX : TriangleAlert;
  const day = s.added_to_day ? weekdayIn(lang, s.added_to_day) : "";
  const from = weekdayIn(lang, load.planned_depart);
  const stopCases = group.cases - (s.decision ? s.qty : 0);
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-start gap-3 rounded-card border border-asphalt-200 bg-asphalt-50 p-4">
        <Icon
          size={24}
          strokeWidth={1.75}
          aria-hidden
          className={cx("mt-0.5 shrink-0", s.kind === "missing" ? "text-attention" : "text-problem")}
        />
        <div className="flex flex-col gap-0.5">
          <p className="t-h3">
            {s.kind === "missing" ? t("flag.yourFlagMissing", { n: s.qty }) : t("flag.yourFlagDamaged", { n: s.qty })}
          </p>
          <p className="t-label text-asphalt-700">
            {t("flag.sentBy", { name: s.flagged_by ?? "", time: clock(s.flagged_at) })}
          </p>
        </div>
      </div>

      {s.decision && s.decided_at ? (
        <section className="flex flex-col gap-2 rounded-card border border-attention bg-attention-soft p-4">
          <p className="t-caption text-asphalt-700">
            {t("flag.answeredAt", { name: s.decided_by ?? "", time: clock(s.decided_at) })}
          </p>
          <h3 className="t-h2">
            {s.decision === "send_short" ? t("flag.sendShortAdd", { day }) : t("flag.sendShortNone")}
          </h3>
          <p className="t-body">
            {s.decision === "send_short" && s.added_to_order_ref
              ? t("flag.bodyAdd", {
                  loaded: line.loaded,
                  n: s.qty,
                  place: group.place,
                  day,
                  order: s.added_to_order_ref,
                  from,
                  kind: t(`kindsLower.${loadKindKey(load.brand, load.temp)}`),
                })
              : t("flag.bodyNone", { loaded: line.loaded, n: s.qty })}
          </p>
          <hr className="border-attention/30" />
          <Consequence icon={MessageSquare}>
            {s.store_contact ? t("flag.toldStore", { name: s.store_contact }) : t("flag.toldStoreNoName")}
          </Consequence>
          {load.driver ? (
            <Consequence icon={Route}>
              {t("flag.runSheet", { driver: calledName(load.driver), cases: stopCases, n: group.seq })}
            </Consequence>
          ) : null}
          <Consequence icon={ClipboardList}>{t("flag.record")}</Consequence>
        </section>
      ) : (
        <>
          <p className="t-body text-asphalt-700">{t("flag.waiting", { name: load.dispatcher ?? "" })}</p>
          {withdraw.error ? (
            <p role="alert" className="t-body-strong text-problem">
              {t("load.notSaved", { message: withdraw.error.message })}
            </p>
          ) : null}
          <Button
            density="field"
            full
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate(line.id, { onSuccess: onClose })}
          >
            {t("flag.withdraw")}
          </Button>
        </>
      )}
      <Button variant="primary" density="field" full icon={Check} onClick={onClose}>
        {t("flag.back")}
      </Button>
    </div>
  );
}

function Consequence({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-3 t-body">
      <Icon size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-700" />
      <span>{children}</span>
    </p>
  );
}
