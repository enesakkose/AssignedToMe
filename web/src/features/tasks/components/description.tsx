"use client";

import type { Attachment, Task } from "@mytask/core";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

import { getDescription } from "../actions";
import { unwrap } from "./actions/unwrap";

const attachmentSrc = (board: string, url: string) =>
  `/api/boards/${board}/attachment?url=${encodeURIComponent(url)}`;

/**
 * The description as the source renders it (tables, lists, inline images), when the source offers that. The HTML is
 * sanitized on the server before it gets here; without it, or while it loads, the plain text stands in.
 */
export function Description({ task, rich }: { task: Task; rich: boolean }) {
  const t = useTranslations("detail");
  const html = useQuery({
    queryKey: ["description-html", task.connectionId, task.key],
    queryFn: () => unwrap(getDescription(task.connectionId, task.key, task.url)),
    enabled: rich,
    staleTime: 60_000,
  });
  const loading = rich && html.isPending && !task.description;
  // Like desktop/mobile: no "Description" heading at all when the task simply has none.
  if (!html.data && !task.description && !loading) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-title">{t("description")}</h3>
      {html.data ? (
        // Sanitized on the server (src/server/sanitize.ts): plain markup only, images through our attachment route.
        <div className="source-html" dangerouslySetInnerHTML={{ __html: html.data }} />
      ) : loading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <p className="text-md leading-relaxed whitespace-pre-line text-ink-2">{task.description}</p>
      )}
    </section>
  );
}

const isImage = (a: Attachment) => /^image\/(png|jpeg|gif|webp)$/.test(a.mimeType ?? "");

/** The task's attached images, loaded through the board (credentials only to its own site); a click opens it full size. */
export function Images({ task }: { task: Task }) {
  const t = useTranslations("detail");
  const images = (task.attachments ?? []).filter((a) => isImage(a) && a.url.startsWith("https://"));
  if (images.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-title">{t("images")}</h3>
      <ul className="grid grid-cols-3 gap-2">
        {images.map((a) => {
          const src = attachmentSrc(task.connectionId, a.url);
          return (
            <li key={a.id}>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                title={a.name}
                className="block aspect-[4/3] overflow-hidden rounded-[6px] border border-rule bg-paper"
              >
                {/* oxlint-disable-next-line nextjs/no-img-element -- private, per-board images; next/image can't proxy them */}
                <img
                  src={attachmentSrc(
                    task.connectionId,
                    a.thumbnailUrl?.startsWith("https://") ? a.thumbnailUrl : a.url,
                  )}
                  alt={a.name}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
