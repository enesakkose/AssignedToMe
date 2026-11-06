"use client";

import { fillGuide } from "@mytask/core";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input, SecretInput } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/state";

import { connectWithToken } from "../actions";
import { useErrorText, type ErrorCode } from "../error-text";

export type FieldView = {
  key: string;
  label: string;
  type: "text" | "email" | "url" | "secret";
  optional?: boolean;
  placeholder?: string;
};
export type GuideView = { text: string; link?: string; copy?: string };

function CopyValue({ value }: { value: string }) {
  const t = useTranslations("connect");
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex items-center gap-2 rounded-[10px] border border-rule-2 bg-paper-2 py-1.5 pr-1.5 pl-3">
      <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink" title={value}>
        {value}
      </code>
      <button
        type="button"
        aria-label={copied ? t("copied") : t("copy")}
        title={copied ? t("copied") : t("copy")}
        onClick={() => void navigator.clipboard.writeText(value).then(() => setCopied(true))}
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors duration-[var(--dur-micro)] hover:bg-paper-3 hover:text-ink"
      >
        {copied ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
      </button>
    </span>
  );
}

/** The provider's form, drawn from its fields, beside its step-by-step guide. The board is tried before it is saved. */
export function ConnectForm({
  providerId,
  providerName,
  appName,
  fields,
  guide,
  editing,
}: {
  providerId: string;
  providerName: string;
  appName: string;
  /** The board being edited: its name and non-secret values. */
  editing?: { id: string; name: string; values: Record<string, string> };
  fields: FieldView[];
  guide: GuideView[];
}) {
  const t = useTranslations("connect");
  const errorText = useErrorText();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(editing?.values ?? {});
  const [name, setName] = useState(editing?.name ?? "");
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await connectWithToken(providerId, { name, values, boardId: editing?.id });
      if ("ok" in result) {
        router.push("/app");
        router.refresh();
      } else setError(result.error);
    });

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink-2">{f.label}</span>
            {f.type === "secret" ? (
              <SecretInput
                name={f.key}
                required={!f.optional && !editing}
                placeholder={editing ? t("keepSecret") : f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                showLabel={t("show")}
                hideLabel={t("hide")}
              />
            ) : (
              <Input
                name={f.key}
                type={f.type === "url" ? "url" : f.type}
                required={!f.optional}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-2">{t("name")}</span>
          <Input
            name="name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="text-sm text-muted">{t("nameHint")}</span>
        </label>
        {error && <ErrorState title={t("failed")} description={errorText(error, appName)} />}
        <Button type="submit" variant="primary" disabled={pending} className="self-start">
          {pending ? t("connecting") : editing ? t("save") : t("submit")}
        </Button>
      </form>

      <section aria-labelledby="guide" className="flex flex-col gap-4">
        <h2 id="guide" className="font-body text-lg font-medium tracking-normal">
          {t("guideTitle", { name: providerName })}
        </h2>
        <ol className="flex flex-col gap-4">
          {guide.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-paper-3 text-xs text-ink-2">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-2 text-md text-ink-2">
                {step.text}
                {step.link && (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 self-start rounded-sm text-ink underline-offset-2 hover:underline"
                  >
                    {new URL(step.link).host}
                    <ExternalLink className="size-3.5 text-muted" aria-hidden />
                  </a>
                )}
                {step.copy && <CopyValue value={fillGuide(step.copy, values)} />}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
