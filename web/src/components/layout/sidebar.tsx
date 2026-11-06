"use client";

import { PanelLeftClose } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/ui/brand-mark";
import { IconButton } from "@/components/ui/button";
import { SettingsMenu } from "@/features/settings/components/settings-menu";

/** The app's left column: the mark and name, what to look at (`nav`), and the settings at the foot. */
export function Sidebar({ nav, onCollapse }: { nav: ReactNode; onCollapse?: () => void }) {
  const t = useTranslations("header");
  const tn = useTranslations("nav");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 pr-2 pl-5">
        <Link
          href="/"
          aria-label={t("home")}
          className="mr-auto flex items-center gap-2 rounded-sm text-ink"
        >
          <BrandMark className="size-[18px]" />
          <span className="font-display text-md font-semibold">AssignedToMe</span>
        </Link>
        {onCollapse && (
          <IconButton label={tn("collapse")} onClick={onCollapse} className="hidden lg:inline-flex">
            <PanelLeftClose />
          </IconButton>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">{nav}</div>
      <div className="flex shrink-0 flex-col border-t border-rule p-2">
        <SettingsMenu />
      </div>
    </div>
  );
}
