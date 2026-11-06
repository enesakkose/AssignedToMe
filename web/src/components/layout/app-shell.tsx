import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** The frame of every screen: the sidebar from 1024px unless collapsed, the page beside it filling the window. */
export function AppShell({
  sidebar,
  collapsed,
  children,
}: {
  sidebar: ReactNode;
  collapsed?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh">
      <aside
        className={cn(
          "hidden w-60 shrink-0 border-r border-rule bg-band",
          !collapsed && "lg:block",
        )}
      >
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1">{children}</div>
    </div>
  );
}
