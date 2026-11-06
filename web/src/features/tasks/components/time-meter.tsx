import { Clock3 } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";

/** Logged time against the estimate, as on desktop: the figures, then a small teal meter that turns red past the estimate. */
export function TimeMeter({
  logged = 0,
  estimate,
  className,
}: {
  logged?: number;
  estimate?: number;
  className?: string;
}) {
  const over = !!estimate && logged > estimate;
  const label = estimate
    ? `${formatDuration(logged)} / ${formatDuration(estimate)}`
    : formatDuration(logged);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={label}>
      <Clock3 className="size-3.5 shrink-0 text-muted" aria-hidden />
      <span className={cn("num", over && "text-error")}>
        {formatDuration(logged)}
        {estimate ? <span className="text-muted"> / {formatDuration(estimate)}</span> : null}
      </span>
      {estimate ? (
        <span aria-hidden className="h-1 w-10 overflow-hidden rounded-full bg-paper-3">
          <span
            className={cn("block h-full rounded-full", over ? "bg-error" : "bg-progress")}
            style={{ width: `${Math.min(100, (logged / estimate) * 100)}%` }}
          />
        </span>
      ) : null}
    </span>
  );
}
