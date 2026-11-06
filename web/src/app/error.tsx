"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/state";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  return (
    <div className="mx-auto w-full max-w-lg p-6 pt-24">
      <ErrorState
        title={t("title")}
        description={t("description")}
        action={
          <Button size="sm" onClick={reset} className="self-start">
            {t("retry")}
          </Button>
        }
      />
    </div>
  );
}
