"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { ChevronDown, Globe, Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore, useTransition } from "react";

import { MenuContent, MenuRadioGroup, MenuRadioItem } from "@/components/ui/menu";
import { LOCALES } from "@/i18n/locales";
import { setLocale } from "@/i18n/set-locale";

const noop = () => () => {};

const trigger =
  "inline-flex h-9 items-center gap-2 rounded-full px-3 text-md text-muted transition-colors duration-[var(--dur-micro)] hover:bg-paper-3 hover:text-ink data-[popup-open]:bg-paper-3 data-[popup-open]:text-ink pointer-coarse:h-11 [&>svg]:size-4";

/** Language and theme in the footer: two small dropdowns that open upward, each showing what is chosen now. */
export function FooterPrefs() {
  const t = useTranslations("header");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [, startTransition] = useTransition();
  // Which theme is on is only known in the browser; until then the trigger shows System.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const themes = [
    { value: "system", label: t("themeSystem"), Icon: Monitor },
    { value: "light", label: t("themeLight"), Icon: Sun },
    { value: "dark", label: t("themeDark"), Icon: Moon },
  ];
  const current = themes.find((x) => x.value === (mounted ? theme : "system")) ?? themes[0]!;
  const languageName = (code: string) => new Intl.DisplayNames(code, { type: "language" }).of(code);
  const pick = (code: string) => {
    const data = new FormData();
    data.set("locale", code);
    startTransition(() => setLocale(data));
  };
  return (
    <div className="flex items-center gap-1">
      <BaseMenu.Root>
        <BaseMenu.Trigger aria-label={t("language")} className={trigger}>
          <Globe aria-hidden />
          {languageName(locale)}
          <ChevronDown aria-hidden className="text-muted" />
        </BaseMenu.Trigger>
        <MenuContent side="top" align="end" className="w-44">
          <MenuRadioGroup value={locale} onValueChange={(v) => pick(String(v))}>
            {LOCALES.map((code) => (
              <MenuRadioItem key={code} value={code} lang={code}>
                {languageName(code)}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </BaseMenu.Root>
      <BaseMenu.Root>
        <BaseMenu.Trigger aria-label={t("theme")} className={trigger}>
          <current.Icon aria-hidden />
          {current.label}
          <ChevronDown aria-hidden className="text-muted" />
        </BaseMenu.Trigger>
        <MenuContent side="top" align="end" className="w-44">
          <MenuRadioGroup
            value={mounted ? theme : undefined}
            onValueChange={(v) => setTheme(String(v))}
          >
            {themes.map(({ value, label, Icon }) => (
              <MenuRadioItem key={value} value={value} icon={<Icon />}>
                {label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </BaseMenu.Root>
    </div>
  );
}
