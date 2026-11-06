"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { ListFilter } from "lucide-react";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button-variants";
import {
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
} from "@/components/ui/menu";

export type FilterGroupView = {
  id: string;
  label: string;
  options: { label: string; href: string; active: boolean }[];
};

/** Filters as a menu of checkboxes. Every option is a URL, so the server does the filtering; this only opens and closes. */
export function FilterMenu({
  label,
  clearLabel,
  count,
  groups,
  clearHref,
}: {
  label: string;
  clearLabel: string;
  count: number;
  groups: FilterGroupView[];
  clearHref: string;
}) {
  const router = useRouter();
  const go = (href: string) => router.push(href, { scroll: false });
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <ListFilter aria-hidden />
        {label}
        {count > 0 && (
          <span className="num grid h-4 min-w-4 place-items-center rounded-sm bg-accent px-1 text-xs text-accent-ink">
            {count}
          </span>
        )}
      </BaseMenu.Trigger>
      <MenuContent className="w-56">
        {groups.map((g, i) => (
          <MenuGroup key={g.id}>
            {i > 0 && <MenuSeparator />}
            <MenuGroupLabel>{g.label}</MenuGroupLabel>
            {/* Ticking stays in the menu: switching several filters is one visit. */}
            {g.options.map((o) => (
              <MenuCheckboxItem key={o.label} checked={o.active} onCheckedChange={() => go(o.href)}>
                {o.label}
              </MenuCheckboxItem>
            ))}
          </MenuGroup>
        ))}
        {count > 0 && (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => go(clearHref)}>{clearLabel}</MenuItem>
          </>
        )}
      </MenuContent>
    </BaseMenu.Root>
  );
}
