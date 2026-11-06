import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { isLocale, LOCALE_COOKIE, localeFromHeader } from "./locales";

export default getRequestConfig(async () => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved)
    ? saved
    : localeFromHeader((await headers()).get("accept-language"));
  return { locale, messages: (await import(`./messages/${locale}.json`)).default };
});
