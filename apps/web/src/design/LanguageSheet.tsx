import { Check } from "lucide-react";
import { LANGUAGES, type Lang } from "@/i18n";
import { cx } from "@/lib/cx";
import { Sheet } from "./Sheet";

/** Overlay / Language sheet, shared by the dock tablet and the driver's phone: each option in its own script. */
export function LanguageSheet({
  open,
  onClose,
  value,
  onChange,
  title,
  helper,
  note,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  value: Lang;
  onChange: (lang: Lang) => void;
  title: string;
  helper: string;
  note: string;
  /** The close button's name in the reader's language. */
  closeLabel?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} closeLabel={closeLabel}>
      <div className="flex flex-col gap-3">
        <p className="t-body text-asphalt-700">{helper}</p>
        <div role="radiogroup" aria-label={title} className="flex flex-col gap-2">
          {LANGUAGES.map((option) => {
            const selected = option.code === value;
            return (
              // biome-ignore lint/a11y/useSemanticElements: a styled radio row, 64 high for gloved fingers
              <button
                key={option.code}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  onChange(option.code);
                  onClose();
                }}
                className={cx(
                  "flex min-h-16 items-center gap-3 rounded-card px-4 text-left",
                  selected ? "border-2 border-petrol-700 bg-petrol-50" : "border border-asphalt-200 bg-white",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span lang={option.code} className="t-field text-asphalt-900">
                    {option.native}
                  </span>
                  {option.code !== "en" ? <span className="t-label text-asphalt-500">{option.english}</span> : null}
                </span>
                {selected ? <Check size={24} strokeWidth={1.75} aria-hidden className="text-petrol-700" /> : null}
              </button>
            );
          })}
        </div>
        <p className="t-caption text-asphalt-500">{note}</p>
      </div>
    </Sheet>
  );
}

export type { Lang };
