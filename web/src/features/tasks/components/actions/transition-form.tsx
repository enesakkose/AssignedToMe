"use client";

import type { Transition, TransitionInput } from "@mytask/core";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, inputClass } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

/** A transition's screen (e.g. "Estimated Budget Effort"), built from the fields the source reports. Stays open on error. */
export function TransitionForm({
  taskKey,
  transition,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  taskKey: string;
  transition: Transition;
  pending: boolean;
  error?: string;
  onSubmit: (input: TransitionInput) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("actions");
  const [values, setValues] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const problems: Record<string, string> = {};
  for (const f of transition.fields) {
    const v = values[f.key]?.trim() ?? "";
    if (f.required && !v) problems[f.key] = t("required");
    else if (v && f.kind === "number" && !Number.isFinite(Number(v.replace(",", "."))))
      problems[f.key] = t("mustBeNumber");
  }
  const shown = (key: string) => (touched ? problems[key] : undefined);
  const submit = () => {
    setTouched(true);
    if (Object.keys(problems).length) return;
    onSubmit({ values, comment: comment.trim() || undefined });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !pending && onCancel()}
      title={transition.name}
      description={t("formMovesTo", { key: taskKey, status: transition.to.name })}
      closeLabel={t("close")}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button variant="primary" disabled={pending} onClick={submit}>
            {transition.name}
          </Button>
        </>
      }
    >
      <form
        className="-mx-1 flex max-h-[55vh] flex-col gap-4 overflow-y-auto px-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {transition.fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              {f.required ? f.name : t("optional", { name: f.name })}
            </span>
            {f.kind === "select" ? (
              <select
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                aria-invalid={!!shown(f.key)}
                className={cn(inputClass, "appearance-none")}
              >
                <option value="">{t("choose")}</option>
                {(f.options ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : f.kind === "textarea" ? (
              <Textarea
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                aria-invalid={!!shown(f.key)}
              />
            ) : (
              <Input
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                inputMode={f.kind === "number" ? "decimal" : undefined}
                aria-invalid={!!shown(f.key)}
              />
            )}
            {shown(f.key) && <span className="text-sm text-error">{shown(f.key)}</span>}
          </label>
        ))}
        {transition.allowsComment && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              {t("optional", { name: t("comment") })}
            </span>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
        )}
        <button type="submit" hidden />
      </form>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </Dialog>
  );
}
