"use client";

import { isSafeUrl } from "@mytask/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { useErrorText } from "@/features/connections/error-text";
import { formatAge } from "@/lib/format";

import { addComment, deleteComment, getComments } from "../../actions";
import { detailOf, unwrap } from "./unwrap";

/**
 * The task's latest comments, oldest first, and a box to add one. Text is shown as text (never as HTML); links in a
 * comment open only when they are http(s). Your own comments can be deleted.
 */
export function Comments({
  board,
  taskKey,
  app,
  canAdd,
  canDelete,
}: {
  board: string;
  taskKey: string;
  app: string;
  canAdd: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("actions");
  const locale = useLocale();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const key = ["comments", board, taskKey];
  const comments = useQuery({
    queryKey: key,
    queryFn: () => unwrap(getComments(board, taskKey)),
    staleTime: 60_000,
  });
  const add = useMutation({
    mutationFn: (body: string) => unwrap(addComment(board, taskKey, body)),
    onSuccess: () => {
      setText("");
      toast.success(t("commentAdded"));
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(deleteComment(board, taskKey, id)),
    onSuccess: () => toast.success(t("commentDeleted")),
    onError: (e) => toast.error(t("deleteComment"), { description: errorText(detailOf(e), app) }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <section aria-labelledby="comments" className="flex flex-col gap-3">
      <h3 id="comments" className="text-title">
        {t("comments")}
      </h3>
      {comments.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : comments.isError ? (
        <p className="text-sm text-error">{errorText(detailOf(comments.error), app)}</p>
      ) : comments.data.length === 0 ? (
        <p className="text-md text-muted">{t("noComments")}</p>
      ) : (
        <ol className="flex flex-col">
          {comments.data.map((c) => (
            <li key={c.id} className="flex gap-3 border-b border-rule py-3 last:border-b-0">
              <Avatar name={c.author} className="mt-0.5" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-ink">
                    {c.mine ? t("you") : (c.author ?? "")}
                  </span>
                  <time dateTime={c.created} className="text-muted">
                    {formatAge(c.created, locale)}
                  </time>
                  {canDelete && c.mine && (
                    <IconButton
                      label={t("deleteComment")}
                      className="ml-auto size-7"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(c.id)}
                    >
                      <Trash2 />
                    </IconButton>
                  )}
                </div>
                <p className="text-md leading-relaxed whitespace-pre-line text-ink-2 [overflow-wrap:anywhere]">
                  {c.parts
                    ? c.parts.map((part, i) =>
                        part.type === "text" ? (
                          <span key={i}>{part.text}</span>
                        ) : part.type === "link" && isSafeUrl(part.url) ? (
                          <a
                            key={i}
                            href={part.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ink underline underline-offset-2"
                          >
                            {part.text}
                          </a>
                        ) : part.type === "link" ? (
                          <span key={i}>{part.text}</span>
                        ) : null,
                      )
                    : c.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {canAdd && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) add.mutate(text.trim());
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("writeComment")}
            aria-label={t("writeComment")}
            maxLength={8000}
          />
          {add.isError && (
            <p role="alert" className="text-sm text-error">
              {t("commentFailed")}: {errorText(detailOf(add.error), app)}
            </p>
          )}
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!text.trim() || add.isPending}
            className="self-end"
          >
            {add.isPending && <Spinner />}
            {t("send")}
          </Button>
        </form>
      )}
    </section>
  );
}
