import { Clock, LayoutGrid, SquareCheckBig } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ComponentType } from "react";

/** What the app does, in the same hairline grid as the sources: each job, one line, no mock screenshots. */
export async function Features() {
  const t = await getTranslations("landing");
  const cells: { icon: ComponentType<{ className?: string }>; title: string; line: string }[] = [
    { icon: SquareCheckBig, title: t("statusTitle"), line: t("statusLine") },
    { icon: Clock, title: t("timeTitle"), line: t("timeLine") },
    { icon: LayoutGrid, title: t("tabsTitle"), line: t("tabsLine") },
  ];
  return (
    <ul className="grid border-t border-l border-rule sm:grid-cols-2 lg:grid-cols-3">
      {cells.map(({ icon: Icon, title, line }) => (
        <li
          key={title}
          className="flex flex-col gap-6 border-r border-b border-rule p-8 transition-colors duration-[var(--dur-micro)] hover:bg-paper-2"
        >
          <span className="grid size-11 place-items-center rounded-[12px] bg-paper shadow-window">
            <Icon className="size-5 text-ink-2" />
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-display text-xl font-medium tracking-[-0.01em] text-ink">
              {title}
            </span>
            <span className="max-w-[28rem] text-md text-muted">{line}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
