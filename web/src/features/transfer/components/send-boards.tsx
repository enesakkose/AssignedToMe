"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProviderLogo, type ProviderView } from "@/components/ui/provider-logo";
import { ErrorState } from "@/components/ui/state";

import { sendBoards } from "../actions";
import { Qr } from "./qr";

export type SendableBoard = { id: string; name: string; provider: ProviderView; signedIn: boolean };

/**
 * This browser → a phone or a Mac: type the code the other device shows, pick boards, and show them sealed as a QR
 * (and as text to paste). The sealed text is useless without the code, which only the other device shows.
 */
export function SendBoards({ boards }: { boards: SendableBoard[] }) {
  const t = useTranslations("transfer");
  const [code, setCode] = useState("");
  const [picked, setPicked] = useState(() => new Set(boards.map((b) => b.id)));
  const [sealed, setSealed] = useState<{ text: string; qr: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const signedIn = boards.filter((b) => b.signedIn && picked.has(b.id)).length;

  // Nothing of the transfer outlives its 10 minutes on screen.
  useEffect(() => {
    if (!sealed) return;
    const timer = setTimeout(() => setSealed(null), 10 * 60_000);
    return () => clearTimeout(timer);
  }, [sealed]);

  const show = () =>
    startTransition(async () => {
      setError(null);
      const result = await sendBoards([...picked], code);
      if ("text" in result) setSealed(result);
      else setError(result.error === "code" ? t("codeInvalid") : t("invalid"));
    });

  if (sealed)
    return (
      <div className="flex max-w-xl flex-col gap-5">
        <p className="text-md text-ink-2">{sealed.qr ? t("scan") : t("tooManyForQr")}</p>
        {sealed.qr && <Qr text={sealed.text} label={t("qrLabel")} />}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              void navigator.clipboard.writeText(sealed.text).then(() => setCopied(true))
            }
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? t("copied") : t("copy")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSealed(null);
              setCode("");
              setCopied(false);
            }}
          >
            {t("done")}
          </Button>
        </div>
        {/* Nothing travels back, so this page can't know when the other device is done. */}
        <p className="text-sm text-muted">{t("closeWhenDone")}</p>
      </div>
    );

  return (
    <form
      className="flex max-w-xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        show();
      }}
    >
      <p className="text-md text-ink-2">{t("sendStep")}</p>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-2">{t("code")}</span>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXX-XXXX"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          maxLength={9}
          className="max-w-56 font-mono tracking-widest uppercase"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink-2">{t("boards")}</legend>
        <ul className="cut overflow-hidden border border-rule bg-paper">
          {boards.map((b) => (
            <li key={b.id} className="border-b border-rule last:border-b-0">
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-md hover:bg-paper-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-ink)]"
                  checked={picked.has(b.id)}
                  onChange={(e) =>
                    setPicked((s) => {
                      const next = new Set(s);
                      if (e.target.checked) next.add(b.id);
                      else next.delete(b.id);
                      return next;
                    })
                  }
                />
                <ProviderLogo provider={b.provider} />
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
              </label>
            </li>
          ))}
        </ul>
        {signedIn > 0 && (
          <p className="text-sm text-muted">{t("signInNote", { count: signedIn })}</p>
        )}
      </fieldset>
      {error && <ErrorState title={t("failed")} description={error} />}
      <Button
        type="submit"
        variant="primary"
        disabled={pending || picked.size === 0 || !code.trim()}
        className="self-start"
      >
        {t("showQr")}
      </Button>
    </form>
  );
}
