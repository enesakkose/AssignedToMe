import type { Attachment } from "@mytask/core";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ExternalLink, ImageOff, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Modal, Pressable, View } from "react-native";
import { toast } from "sonner-native";
import { openInSource } from "../api/open-in-source";
import { useAttachmentImage, useCanShowAttachments } from "../hooks/use-attachment";

const IMAGE = /\.(png|jpe?g|gif|webp|bmp)$/i;
export const isImage = (a: Attachment) =>
  (a.mimeType?.startsWith("image/") && !a.mimeType.includes("svg")) || IMAGE.test(a.name);

/** Downloaded with the connection's credentials (the URLs need them), shown as a data: URL. */
function AttachmentImage({
  connectionId,
  attachment,
  className,
  contain,
}: {
  connectionId: string;
  attachment: Attachment;
  className: string;
  contain?: boolean;
}) {
  const image = useAttachmentImage(connectionId, attachment.url);
  if (image.isPending) return <Skeleton className={className} />;
  if (!image.data)
    return (
      <View className={`items-center justify-center bg-paper-3 ${className}`}>
        <Icon as={ImageOff} className="text-muted-foreground" size={18} />
      </View>
    );
  return (
    <Image
      accessibilityLabel={attachment.name}
      className={className}
      resizeMode={contain ? "contain" : "cover"}
      source={{ uri: image.data }}
    />
  );
}

/** A larger look at one image, with a way to open the task's file in its source. */
export function ImagePreview({
  connectionId,
  attachment,
  taskUrl,
  onClose,
}: {
  connectionId: string;
  attachment: Attachment;
  taskUrl: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    // iOS's page sheet: it sits below the status bar, and swiping it down closes it (onRequestClose), like Photos.
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible>
      <View className="flex-1 bg-background pb-8">
        <View className="h-14 flex-row items-center gap-2 border-b border-rule px-3">
          <Button accessibilityLabel={t("ui.close")} onPress={onClose} size="icon" variant="ghost">
            <Icon as={X} size={20} />
          </Button>
          <Text className="min-w-0 flex-1" numberOfLines={1}>
            {attachment.name}
          </Text>
          <Button
            onPress={() =>
              void openInSource(connectionId, taskUrl).catch(() =>
                toast.error(t("errors.openLink")),
              )
            }
            size="sm"
            variant="secondary"
          >
            <Icon as={ExternalLink} size={14} />
            <Text>{t("tasks.openInSource")}</Text>
          </Button>
        </View>
        <AttachmentImage
          attachment={attachment}
          className="flex-1"
          connectionId={connectionId}
          contain
        />
      </View>
    </Modal>
  );
}

/** Image attachments as a 3-column thumbnail grid; tap for a larger preview. `exclude` skips images shown in the description. */
export function AttachmentImages({
  connectionId,
  attachments,
  exclude,
  taskUrl,
}: {
  connectionId: string;
  attachments: Attachment[] | undefined;
  exclude?: Set<string>;
  taskUrl: string;
}) {
  const { t } = useTranslation();
  const supported = useCanShowAttachments(connectionId);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const images = (attachments ?? []).filter((a) => isImage(a) && !exclude?.has(a.id));
  if (!supported || !images.length) return null;
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink-2">
        {t("tasks.images", { count: images.length })}
      </Text>
      <View className="flex-row flex-wrap gap-1.5">
        {images.map((a) => (
          <Pressable
            accessibilityRole="imagebutton"
            className="w-[32%] active:opacity-80"
            key={a.id}
            onPress={() => setPreview(a)}
          >
            <AttachmentImage
              attachment={a}
              className="cut aspect-square w-full"
              connectionId={connectionId}
            />
          </Pressable>
        ))}
      </View>
      {preview ? (
        <ImagePreview
          attachment={preview}
          connectionId={connectionId}
          onClose={() => setPreview(null)}
          taskUrl={taskUrl}
        />
      ) : null}
    </View>
  );
}

/** An image inside a description or comment, where the author placed it; tap for a larger preview. */
export function InlineImage({
  connectionId,
  attachment,
  taskUrl,
}: {
  connectionId: string;
  attachment: Attachment;
  taskUrl: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        className="my-1 w-full active:opacity-80"
        onPress={() => setOpen(true)}
      >
        <AttachmentImage
          attachment={attachment}
          className="cut aspect-video w-full"
          connectionId={connectionId}
        />
      </Pressable>
      {open ? (
        <ImagePreview
          attachment={attachment}
          connectionId={connectionId}
          onClose={() => setOpen(false)}
          taskUrl={taskUrl}
        />
      ) : null}
    </>
  );
}
