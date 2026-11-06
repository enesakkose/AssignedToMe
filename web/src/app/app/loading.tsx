import { Skeleton } from "@/components/ui/skeleton";

/** The screen's shape while it loads: the sidebar, the title row, a group band and a few rows. */
export default function Loading() {
  return (
    <div className="flex h-dvh" aria-busy>
      <div className="hidden w-60 shrink-0 flex-col gap-2 border-r border-rule bg-band p-4 lg:flex">
        <Skeleton className="mb-4 h-5 w-32" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-rule px-6">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="ml-auto h-7 w-64 rounded-input" />
        </div>
        <div className="h-9 border-b border-rule bg-band" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex h-11 items-center gap-3 border-b border-rule px-6">
            <Skeleton className="size-4" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="ml-auto size-5 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
