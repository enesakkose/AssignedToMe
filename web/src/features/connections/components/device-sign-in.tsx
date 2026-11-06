"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/state";

import { beginDeviceSignIn, pollDeviceSignIn } from "../actions";
import { useErrorText, type ErrorCode } from "../error-text";

/** Device-code sign-in (GitHub): shows the code, opens the page to type it on, and waits until it has been entered. */
export function DeviceSignIn({
  providerId,
  label,
  app,
}: {
  providerId: string;
  label: string;
  app: string;
}) {
  const t = useTranslations("connect");
  const errorText = useErrorText();
  const router = useRouter();
  const [device, setDevice] = useState<{ url: string; code: string } | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const waiting = useRef(false);

  // Leaving the page stops asking.
  useEffect(() => () => void (waiting.current = false), []);

  const start = async () => {
    setError(null);
    setBusy(true);
    const begun = await beginDeviceSignIn(providerId);
    setBusy(false);
    if ("error" in begun) return setError(begun.error);
    setDevice(begun);
    void navigator.clipboard?.writeText(begun.code).catch(() => undefined);
    waiting.current = true;
    while (waiting.current) {
      const result = await pollDeviceSignIn();
      if (!waiting.current) return;
      if ("done" in result) {
        router.push("/app");
        router.refresh();
        return;
      }
      if ("error" in result) {
        waiting.current = false;
        setDevice(null);
        return setError(result.error);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!device && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void start()}
          className="self-start"
        >
          {label}
        </Button>
      )}
      {device && (
        <div className="flex flex-col gap-3">
          <p className="text-md text-ink-2">{t("deviceCode", { app })}</p>
          <span className="self-start rounded-[12px] border border-rule-2 bg-paper-2 px-5 py-3 font-mono text-2xl tracking-[0.2em] text-ink select-all">
            {device.code}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={device.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[var(--control-md)] items-center gap-1.5 rounded-control bg-accent px-4 text-md font-medium text-accent-ink hover:bg-accent-hover"
            >
              {t("openSite", { app })}
              <ExternalLink className="size-4" aria-hidden />
            </a>
            <Button
              variant="ghost"
              onClick={() => {
                waiting.current = false;
                setDevice(null);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
          <p aria-live="polite" className="text-sm text-muted">
            {t("waiting", { app })}
          </p>
        </div>
      )}
      {error && <ErrorState title={t("failed")} description={errorText(error, app)} />}
    </div>
  );
}
