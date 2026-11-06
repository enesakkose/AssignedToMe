"use client";

import { formatTransferCode } from "@mytask/core";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";

import { receiveBoards, startReceive } from "../actions";

/**
 * A phone or a Mac → this browser: show a one-time code for the other device to seal its boards with, then paste the
 * text it copies. The code lives in a sealed cookie on the server too, so only this browser can open the text.
 */
export function ReceiveBoards() {
  const t = useTranslations("transfer");
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A new code each time the screen opens: one code, one transfer.
  useEffect(() => {
    void startReceive().then((r) => setCode(r.code));
  }, []);

  const add = () =>
    startTransition(async () => {
      setError(null);
      const result = await receiveBoards(text);
      if ("added" in result) {
        if (result.added === 0) return setError(t("noBoards"));
        toast.success(t("imported", { count: result.added }));
        router.push("/app");
        router.refresh();
      } else
        setError(
          result.error === "wrong_code"
            ? t("wrongCode")
            : result.error === "expired"
              ? t("expired")
              : result.error === "limit"
                ? t("limit")
                : t("invalid"),
        );
    });

  return (
    <form
      className="flex max-w-xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <p className="text-md text-ink-2">{t("receiveStep")}</p>
      {code ? (
        <p
          aria-label={t("yourCode")}
          className="cut self-start border border-rule bg-paper-2 px-5 py-3 font-mono text-xl tracking-[0.2em] text-ink select-all"
        >
          {formatTransferCode(code)}
        </p>
      ) : (
        <Skeleton className="h-14 w-56" />
      )}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-2">{t("paste")}</span>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          spellCheck={false}
          className="font-mono text-xs"
        />
      </label>
      {error && <ErrorState title={t("failed")} description={error} />}
      <Button
        type="submit"
        variant="primary"
        disabled={pending || !code || !text.trim()}
        className="self-start"
      >
        {t("import")}
      </Button>
    </form>
  );
}
