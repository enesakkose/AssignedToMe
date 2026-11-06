"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

const HOUR = 60 * 60_000;

/** Server state for the app: refreshed every hour, and on focus once it is older than that (AGENTS.md). */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: HOUR,
            refetchInterval: HOUR,
            refetchOnWindowFocus: true,
            retry: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
