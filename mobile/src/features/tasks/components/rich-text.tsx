import type { Attachment, DescriptionPart } from "@mytask/core";
import { Text } from "@/components/ui/text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { toast } from "sonner-native";
import { openInSource } from "../api/open-in-source";
import { InlineImage } from "./attachment-images";

export const inlineImageIds = (parts: DescriptionPart[] | undefined) =>
  new Set(parts?.flatMap((p) => (p.type === "image" ? [p.attachmentId] : [])));

type Props = {
  text: string | undefined;
  parts: DescriptionPart[] | undefined;
  attachments: Attachment[] | undefined;
  connectionId: string;
  taskUrl: string;
  /** Folds long text behind "Show more" (comments); the description shows in full. */
  fold?: boolean;
  className?: string;
};

/**
 * A description or comment with links and images where the author put them. Text and links flow inline; an image
 * breaks the text into blocks around it.
 */
export function RichText({
  text = "",
  parts,
  attachments,
  connectionId,
  taskUrl,
  fold,
  className = "text-[15px] leading-[22px]",
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // shortcut: guesses "long" from length and line breaks, not rendered height; fine for comments.
  const long = !!fold && (text.length > 320 || text.split("\n").length > 6);
  const lines = long && !open ? 6 : undefined;
  const openLink = (url: string) =>
    void openInSource(connectionId, url).catch(() => toast.error(t("errors.openLink")));

  // Split into runs of inline text/links, separated by images.
  const blocks: (DescriptionPart[] | Attachment)[] = [];
  for (const p of parts ?? [{ text, type: "text" } as const]) {
    if (p.type === "image") {
      const a = attachments?.find((x) => x.id === p.attachmentId);
      if (a) blocks.push(a);
    } else {
      const last = blocks.at(-1);
      if (Array.isArray(last)) last.push(p);
      else blocks.push([p]);
    }
  }

  return (
    <View className="items-start gap-1">
      {blocks.map((b, i) =>
        Array.isArray(b) ? (
          <Text className={`text-ink-2 ${className}`} key={i} numberOfLines={lines} selectable>
            {b.map((p, j) =>
              p.type === "link" ? (
                <Text className="text-foreground underline" key={j} onPress={() => openLink(p.url)}>
                  {p.text}
                </Text>
              ) : p.type === "text" ? (
                p.text
              ) : null,
            )}
          </Text>
        ) : (
          <InlineImage attachment={b} connectionId={connectionId} key={i} taskUrl={taskUrl} />
        ),
      )}
      {long ? (
        <Pressable
          accessibilityRole="button"
          className="min-h-8 justify-center"
          onPress={() => setOpen((v) => !v)}
        >
          <Text className="text-sm font-medium">
            {open ? t("tasks.showLess") : t("tasks.showMore")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
