import { CircleAlert, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Notice } from "./Notice";

type Props = {
  /** What did not load, in a sentence: "Relay could not load the plan." */
  title: string;
  /** Asks again now; usually the query's refetch. */
  onRetry: () => void;
  /** True while that ask is on its way. */
  retrying?: boolean;
  /** What happens meanwhile, for example "Relay tries again every 15 seconds." */
  children?: ReactNode;
  className?: string;
};

/** A desk page whose first load failed: what is missing, what Relay does about it, and Try again. Gray, not red:
 *  nothing about the delivery day is wrong, the page just has nothing to show yet. */
export function ErrorState({ title, onRetry, retrying = false, children, className }: Props) {
  return (
    <Notice
      tone="waiting"
      icon={CircleAlert}
      role="alert"
      title={title}
      className={className}
      action={
        <Button density="desk" icon={RefreshCw} disabled={retrying} onClick={onRetry}>
          {retrying ? "Trying again" : "Try again"}
        </Button>
      }
    >
      {children}
    </Notice>
  );
}
