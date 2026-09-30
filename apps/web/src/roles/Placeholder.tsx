import type { ReactNode } from "react";
import { Notice } from "@/design/Notice";

/** A screen that is on its way in this build, kept honest about it. */
export function Placeholder({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <h1 className="t-h1">{title}</h1>
      <Notice tone="info">{children}</Notice>
    </div>
  );
}
