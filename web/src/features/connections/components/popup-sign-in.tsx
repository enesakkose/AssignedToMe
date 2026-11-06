"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { ErrorState } from "@/components/ui/state";
import { cn } from "@/lib/cn";

import { useErrorText } from "../error-text";

/**
 * Atlassian / Linear sign-in in its own window, so this page stays where it is. The popup reports back through
 * postMessage (same origin only) and closes; a blocked popup falls back to this tab.
 */
export function PopupSignIn({
  providerId,
  app,
  children,
}: {
  providerId: string;
  app: string;
  children: ReactNode;
}) {
  const t = useTranslations("connect");
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const popup = useRef<Window | null>(null);
  const href = `/api/oauth/start?provider=${encodeURIComponent(providerId)}`;

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== popup.current) return;
      const data = e.data as { type?: string; ok?: boolean; error?: string };
      if (data?.type !== "atm:sign-in") return;
      setWaiting(false);
      if (data.ok) {
        router.push("/app");
        router.refresh();
      } else setError(data.error ?? "signin");
    };
    window.addEventListener("message", onMessage);
    // The person closed the window without finishing: stop waiting.
    const timer = window.setInterval(() => {
      if (popup.current?.closed) setWaiting(false);
    }, 800);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
  }, [router]);

  return (
    <div className="flex flex-col gap-3">
      <a
        href={href}
        onClick={(e) => {
          const w = window.open(`${href}&popup=1`, "atm-sign-in", "popup,width=520,height=720");
          if (!w) return; // Blocked: the link opens the sign-in in this tab instead.
          e.preventDefault();
          popup.current = w;
          setError(null);
          setWaiting(true);
        }}
        className={cn(buttonVariants({ variant: "secondary", size: "md" }), "gap-2.5 self-start")}
      >
        {children}
      </a>
      {waiting && (
        <p aria-live="polite" className="text-sm text-muted">
          {t("waiting", { app })}
        </p>
      )}
      {error && <ErrorState title={t("failed")} description={errorText({ code: error }, app)} />}
    </div>
  );
}
