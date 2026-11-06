import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** What belongs here and the one action that fills it. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-16 text-center", className)}>
      <span aria-hidden className="text-muted [&_svg]:size-6">
        {icon}
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-lg">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** What broke and what to do about it. */
export function ErrorState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("cut flex flex-col gap-2 border border-error/30 bg-error-wash p-4", className)}
    >
      <h2 className="text-title text-error">{title}</h2>
      <p className="text-sm text-ink-2">{description}</p>
      {action}
    </div>
  );
}
