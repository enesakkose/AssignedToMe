"use client";

import type { Provider } from "@mytask/core";
import { CircleAlert, Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ProviderLogo } from "@/components/ui/provider-logo";
import type { Board } from "@/features/boards/lib/board";
import { ALL_BOARDS, queueHref, type QueueParams } from "@/features/tasks/lib/queue-params";

function NavItem({
  href,
  active,
  icon,
  label,
  end,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  end?: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-current={active ? "page" : undefined}
        className="flex h-8 items-center gap-2.5 rounded-full px-3 text-md text-ink-2 transition-colors duration-[var(--dur-micro)] hover:bg-paper-3 hover:text-ink focus-visible:outline-offset-[-2px] aria-[current=page]:bg-paper-3 aria-[current=page]:font-medium aria-[current=page]:text-ink pointer-coarse:h-11"
      >
        <span className="grid size-4 shrink-0 place-items-center text-muted">{icon}</span>
        <span className="min-w-0 flex-1 truncate" title={label}>
          {label}
        </span>
        {end}
      </Link>
    </li>
  );
}

const Count = ({ n }: { n: number }) => <span className="num text-xs text-muted">{n}</span>;

/** Where the tasks come from: all of them, or one board. The choice is the URL's `board`, so each row is a link. */
export function BoardNav({
  boards,
  providers,
  counts,
  params,
}: {
  boards: Board[];
  providers: Map<string, Provider>;
  counts: Record<string, number>;
  params: QueueParams;
}) {
  const t = useTranslations("queue");
  const total = boards.reduce((n, b) => n + (counts[b.id] ?? 0), 0);
  const known = boards.some((b) => b.id === params.board);
  // Moving to another board keeps the search and filters but drops the open task, which may not be on it.
  const to = (board: string) => queueHref(params, { board, task: "" });
  return (
    <nav aria-label={t("boards")} className="flex flex-col gap-6">
      <ul className="flex flex-col gap-0.5">
        <NavItem
          href={to(ALL_BOARDS)}
          active={!known}
          icon={<Inbox className="size-4" aria-hidden />}
          label={t("title")}
          end={<Count n={total} />}
        />
      </ul>
      {boards.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="px-3 font-body text-xs font-medium tracking-normal text-muted">
            {t("boards")}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {boards.map((b) => {
              const provider = providers.get(b.id);
              return (
                <NavItem
                  key={b.id}
                  href={to(b.id)}
                  active={params.board === b.id}
                  icon={provider && <ProviderLogo provider={provider} />}
                  label={b.name}
                  end={
                    b.signedOut ? (
                      <CircleAlert
                        className="size-4 text-error"
                        aria-label={t("errorTitle", { board: b.name })}
                      />
                    ) : (
                      <Count n={counts[b.id] ?? 0} />
                    )
                  }
                />
              );
            })}
          </ul>
        </div>
      )}
      <ul className="flex flex-col gap-0.5">
        <NavItem
          href="/app/connect"
          active={false}
          icon={<Plus className="size-4" aria-hidden />}
          label={t("addBoard")}
        />
      </ul>
    </nav>
  );
}
