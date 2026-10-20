import { CircleAlert, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Notice } from "./Notice";

type Props = {
  title: string;
  onRetry: () => void;
  retrying?: boolean;
  children?: ReactNode;
  className?: string;
};

// Gray, not red. Nothing about the delivery day is wrong, the page just has nothing to show yet.
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
