"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { isLocale, LOCALE_COOKIE } from "./locales";

/** Form action behind the language switch: remembers the choice for a year. */
export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
