import type { Attachment } from "@mytask/core";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm-sheet";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { providerErrorText } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { MessageSquare, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { toast } from "sonner-native";
import { useBoard } from "../hooks/use-board";
import { useAddComment, useCanComment, useComments, useDeleteComment } from "../hooks/use-comments";
import { RichText } from "./rich-text";
import { Avatar } from "./task-bits";

// The newest ten; older ones are one tap away so a long thread doesn't bury the composer.
const SHOWN = 10;

/** A task's comments, oldest to newest like a chat, with a box to add one at the bottom. */
export function Comments({
  connectionId,
  taskKey,
  url,
  attachments,
}: {
  connectionId: string;
  taskKey: string;
  url: string;
  attachments: Attachment[] | undefined;
}) {
  const { t } = useTranslation();
  const supported = useCanComment(connectionId);
  const appName = useBoard(connectionId).provider?.appName;
  const comments = useComments(connectionId, taskKey, attachments, supported);
  const [all, setAll] = useState(false);
  const remove = useDeleteComment(connectionId, taskKey);
  if (!supported) return null;
  const deleting = remove.mutation.isPending ? remove.mutation.variables : undefined;
  const list = comments.data ?? [];
  const hidden = all ? 0 : Math.max(0, list.length - SHOWN);

  return (
    <View className="gap-3 border-t border-rule pt-4">
      <View className="flex-row items-center gap-1.5">
        <Icon as={MessageSquare} className="text-muted-foreground" size={14} />
        <Text accessibilityRole="header" className="text-sm font-semibold text-ink-2">
          {t("comments.title")}
        </Text>
        {comments.isSuccess && list.length > 0 ? (
          <Text className="text-sm" variant="muted">
            {list.length}
          </Text>
        ) : null}
      </View>

      {comments.isPending ? (
        <View className="gap-2">
          <Skeleton className="h-10 w-full rounded-sm" />
          <Skeleton className="h-10 w-4/5 rounded-sm" />
        </View>
      ) : comments.isError ? (
        <Text className="text-sm text-error">{providerErrorText(comments.error, t, appName)}</Text>
      ) : (
        <>
          {hidden > 0 ? (
            <Pressable
              accessibilityRole="button"
              className="min-h-11 justify-center self-start"
              onPress={() => setAll(true)}
            >
              <Text className="text-sm font-medium">
                {t("comments.showEarlier", { count: hidden })}
              </Text>
            </Pressable>
          ) : null}
          {list.length === 0 ? (
            <Text className="text-sm" variant="muted">
              {t("comments.empty")}
            </Text>
          ) : (
            list.slice(hidden).map((c) => (
              <View className="flex-row gap-2.5" key={c.id}>
                <Avatar name={c.author} size={26} />
                <View className="min-w-0 flex-1 gap-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="shrink text-sm font-medium" numberOfLines={1}>
                      {c.author ?? t("tasks.unknownAuthor")}
                    </Text>
                    {c.mine ? (
                      <Text className="rounded-sm bg-paper-3 px-1.5 text-xs font-medium text-ink-2">
                        {t("tasks.you")}
                      </Text>
                    ) : null}
                    <Text className="text-xs" variant="muted">
                      {timeAgo(c.created)}
                    </Text>
                    {c.mine && remove.supported ? (
                      <Pressable
                        accessibilityLabel={t("comments.delete")}
                        accessibilityRole="button"
                        className="-my-2 ml-auto size-9 items-center justify-center rounded-full active:bg-paper-3"
                        hitSlop={4}
                        disabled={remove.mutation.isPending}
                        onPress={() =>
                          confirm({
                            title: t("comments.deleteTitle"),
                            description: t("comments.deleteDescription", { app: appName }),
                            confirmLabel: t("comments.delete"),
                            cancelLabel: t("ui.cancel"),
                            destructive: true,
                            onConfirm: () =>
                              remove.mutation.mutate(c.id, {
                                onError: (error) =>
                                  toast.error(t("comments.deleteFailed"), {
                                    description: providerErrorText(error, t, appName),
                                  }),
                                onSuccess: () => toast.success(t("comments.deleted")),
                              }),
                          })
                        }
                      >
                        {deleting === c.id ? (
                          <ActivityIndicator size="small" />
                        ) : (
                          <Icon as={Trash2} className="text-muted-foreground" size={15} />
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                  <RichText
                    attachments={attachments}
                    className="text-sm leading-5"
                    connectionId={connectionId}
                    fold
                    parts={c.parts}
                    taskUrl={url}
                    text={c.text}
                  />
                </View>
              </View>
            ))
          )}
          <Composer connectionId={connectionId} taskKey={taskKey} />
        </>
      )}
    </View>
  );
}

function Composer({ connectionId, taskKey }: { connectionId: string; taskKey: string }) {
  const { t } = useTranslation();
  const appName = useBoard(connectionId).provider?.appName;
  const add = useAddComment(connectionId, taskKey);
  const [text, setText] = useState("");
  const canSend = !!text.trim() && !add.isPending;
  // Text stays in the box until the source confirms, so a failure loses nothing.
  const send = () => canSend && add.mutate(text, { onSuccess: () => setText("") });

  return (
    <View className="gap-2">
      <Input
        accessibilityLabel={t("comments.placeholder")}
        className="h-auto max-h-36 min-h-11 rounded-[22px] py-3"
        multiline
        onChangeText={setText}
        placeholder={t("comments.placeholder")}
        textAlignVertical="top"
        value={text}
      />
      {add.isError ? (
        <Text className="text-sm text-error">{providerErrorText(add.error, t, appName)}</Text>
      ) : null}
      {/* Send appears once there's something to send. */}
      {text.trim() || add.isPending ? (
        <Button
          className="self-end"
          disabled={!canSend}
          loading={add.isPending}
          onPress={send}
          size="sm"
        >
          <Text>{t("comments.send")}</Text>
        </Button>
      ) : null}
    </View>
  );
}
