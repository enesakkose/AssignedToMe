"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Download, Monitor, Moon, Send, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useTransition } from "react";

import {
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "@/components/ui/menu";
import { LOCALES } from "@/i18n/locales";
import { setLocale } from "@/i18n/set-locale";
import { cn } from "@/lib/cn";

/** Theme and language, the sidebar's last row. Opens upward, from where it sits. */
export function SettingsMenu({ className }: { className?: string }) {
  const t = useTranslations("header");
  const tt = useTranslations("transfer");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const pickLanguage = (next: string) => {
    const data = new FormData();
    data.set("locale", next);
    startTransition(() => setLocale(data));
  };
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger
        aria-busy={pending || undefined}
        className={cn(
          "flex h-8 w-full items-center gap-2.5 rounded-full px-3 text-md text-ink-2 transition-colors duration-[var(--dur-micro)] outline-none hover:bg-paper-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus data-[popup-open]:bg-paper-3 data-[popup-open]:text-ink pointer-coarse:h-11",
          className,
        )}
      >
        <Settings className="size-4 text-muted" aria-hidden />
        {t("menu")}
      </BaseMenu.Trigger>
      <MenuContent side="top" align="start" className="w-64">
        {/* Boards move between this browser, the phone app and the Mac app only sealed with a one-time code. */}
        <MenuGroup>
          <MenuItem icon={<Send />} render={<Link href="/app/transfer/send" />}>
            {tt("send")}
          </MenuItem>
          <MenuItem icon={<Download />} render={<Link href="/app/transfer/receive" />}>
            {tt("receive")}
          </MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>{t("theme")}</MenuGroupLabel>
          <MenuRadioGroup value={theme} onValueChange={(v) => setTheme(String(v))}>
            <MenuRadioItem value="system" icon={<Monitor />}>
              {t("themeSystem")}
            </MenuRadioItem>
            <MenuRadioItem value="light" icon={<Sun />}>
              {t("themeLight")}
            </MenuRadioItem>
            <MenuRadioItem value="dark" icon={<Moon />}>
              {t("themeDark")}
            </MenuRadioItem>
          </MenuRadioGroup>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>{t("language")}</MenuGroupLabel>
          <MenuRadioGroup value={locale} onValueChange={(v) => pickLanguage(String(v))}>
            {LOCALES.map((code) => (
              <MenuRadioItem key={code} value={code} lang={code}>
                {new Intl.DisplayNames(code, { type: "language" }).of(code)}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuContent>
    </BaseMenu.Root>
  );
}
