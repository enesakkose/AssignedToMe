import { isCancelled, type PriorityLevel, type StatusCategory } from "@mytask/core";
import {
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Equal,
} from "lucide-react";

import { cn } from "@/lib/cn";

const statuses = {
  todo: { Icon: CircleDashed, tone: "text-muted" },
  in_progress: { Icon: CircleDot, tone: "text-progress" },
  done: { Icon: CircleCheck, tone: "text-success" },
} satisfies Record<StatusCategory, unknown>;

const statusLook = (category: StatusCategory, label: string) =>
  category === "done" && isCancelled(label)
    ? { Icon: CircleX, tone: "text-error" }
    : statuses[category];

/** The status as its icon alone, named for screen readers; for dense rows where the group already says the status. */
export function StatusIcon({
  category,
  label,
  className,
}: {
  category: StatusCategory;
  label: string;
  className?: string;
}) {
  const { Icon, tone } = statusLook(category, label);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex size-4 shrink-0 items-center justify-center", tone, className)}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

/** Status is coloured text with one icon, never a filled chip. */
export function Status({
  category,
  label,
  className,
}: {
  category: StatusCategory;
  label: string;
  className?: string;
}) {
  const { Icon, tone } = statusLook(category, label);
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-sm font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate" title={label}>
        {label}
      </span>
    </span>
  );
}

const priorities = {
  5: { Icon: ChevronsUp, tone: "text-error" },
  4: { Icon: ChevronUp, tone: "text-error" },
  3: { Icon: Equal, tone: "text-warning" },
  2: { Icon: ChevronDown, tone: "text-muted" },
  1: { Icon: ChevronsDown, tone: "text-muted" },
} satisfies Record<PriorityLevel, unknown>;

/** Priority name with a level icon; an unknown level shows the name only. */
export function Priority({
  level,
  label,
  className,
}: {
  level?: PriorityLevel;
  label: string;
  className?: string;
}) {
  const p = level ? priorities[level] : undefined;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-0.5 text-sm text-ink-2", className)}>
      {p && <p.Icon className={cn("size-4 shrink-0", p.tone)} aria-hidden />}
      <span className="truncate">{label}</span>
    </span>
  );
}

/** The priority as its level icon alone; a task without one keeps the column's width so rows stay aligned. */
export function PriorityIcon({
  level,
  label,
  className,
}: {
  level?: PriorityLevel;
  label?: string;
  className?: string;
}) {
  const p = level ? priorities[level] : undefined;
  if (!p || !label) return <span aria-hidden className={cn("size-4 shrink-0", className)} />;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex size-4 shrink-0 items-center justify-center", p.tone, className)}
    >
      <p.Icon className="size-4" aria-hidden />
    </span>
  );
}

const dotTone = {
  todo: "border-muted",
  in_progress: "border-progress bg-progress/30",
  done: "border-success bg-success",
};

/** Compact status marker for sub-task rows. */
export function StatusDot({
  category,
  status,
  className,
}: {
  category: StatusCategory;
  status: string;
  className?: string;
}) {
  const tone =
    category === "done" && isCancelled(status) ? "border-error bg-error" : dotTone[category];
  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 rounded-full border-[1.5px]", tone, className)}
    />
  );
}
