import { Delete } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type Props = {
  value: string;
  onChange: (next: string) => void;
  error?: boolean;
  length?: number;
  disabled?: boolean;
  /** The Delete key's name and the dots' description, in the reader's language. */
  deleteLabel?: string;
  progressLabel?: (entered: number, length: number) => string;
  /** The line under the dots: a note, or what went wrong. The caller keeps its height fixed, so a message coming
   *  or going never moves the keys. */
  message?: ReactNode;
};

const enteredInEnglish = (entered: number, length: number) => `${entered} of ${length} digits entered`;

/** The shared dock tablet's PIN pad: 4 rows of 3 keys, 64 high, 8 apart for gloved fingers. */
export function PinPad({
  value,
  onChange,
  error,
  length = 4,
  disabled,
  deleteLabel = "Delete last digit",
  progressLabel = enteredInEnglish,
  message,
}: Props) {
  const press = (digit: string) => {
    if (value.length < length) onChange(value + digit);
  };
  const dots = (
    <div className="flex gap-4" role="img" aria-label={progressLabel(value.length, length)}>
      {Array.from({ length }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
          key={i}
          className={cx(
            "size-4 rounded-full",
            error ? "border-2 border-problem" : i < value.length ? "bg-asphalt-900" : "border-2 border-asphalt-300",
          )}
        />
      ))}
    </div>
  );
  return (
    // full width, so a centred parent cannot shrink the keys below their 114 x 64
    <div className={cx("flex w-full flex-col items-center", message === undefined ? "gap-6" : "gap-4")}>
      {message === undefined ? (
        dots
      ) : (
        <div className="flex w-full flex-col items-center gap-3">
          {dots}
          {message}
        </div>
      )}
      <div className="grid w-full max-w-[358px] grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} label={d} onClick={() => press(d)} disabled={disabled} />
        ))}
        <span />
        <Key label="0" onClick={() => press("0")} disabled={disabled} />
        <button
          type="button"
          aria-label={deleteLabel}
          disabled={disabled || value.length === 0}
          onClick={() => onChange(value.slice(0, -1))}
          className="flex h-16 items-center justify-center rounded-button border border-asphalt-300 bg-white text-asphalt-900 disabled:opacity-50"
        >
          <Delete size={24} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Key({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="t-h1 num h-16 rounded-button border border-asphalt-300 bg-white text-asphalt-900 active:bg-asphalt-100"
    >
      {label}
    </button>
  );
}
