import { getProvider, type RelatedTask, type Task } from "@mytask/core";
import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useConnectionsStore, withSecrets } from "@/features/connections/api/connections";
import { ProviderLogo } from "@/features/connections/components/provider-logo";
import { providerErrorText } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, ArrowUpRight, Ban, Hash, Link2, MoreHorizontal } from "lucide-react-native";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, View } from "react-native";
import { toast } from "sonner-native";
import { copyText, openInSource } from "../api/open-in-source";
import { AttachmentImages } from "../components/attachment-images";
import { Comments } from "../components/comments";
import { inlineImageIds, RichText } from "../components/rich-text";
import { SourceHtml } from "../components/source-html";
import { Priority, StatusDot, TypeIcon } from "../components/task-bits";
import {
  AssigneeControl,
  openTask,
  StatusControl,
  SubtaskList,
  TimeControl,
} from "../components/task-row";
import { useBoardTasks } from "../hooks/use-board-tasks";
import { useCanLogWork } from "../hooks/use-worklog";

/** A task or sub-task of this board's list, by key; sub-tasks come back as tasks with their parent. */
function findInBoard(tasks: Task[] | undefined, connectionId: string, key: string) {
  for (const task of tasks ?? []) {
    if (task.key === key) return { task };
    const sub = task.subtasks?.find((s) => s.key === key);
    // A sub-task has no update time of its own, so that stays empty.
    if (sub) return { parent: task, task: { ...sub, connectionId, updatedAt: "" } as Task };
  }
  return undefined;
}

/** Everything about one task on its own page (desktop's detail page). */
export function TaskDetailScreen({
  connectionId,
  taskKey,
}: {
  connectionId: string;
  taskKey: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const connection = useConnectionsStore((s) => s.connections.find((c) => c.id === connectionId));
  const provider = getProvider(connection?.providerId ?? "");
  // The board's own query (same options as the list), so status, time and assignee stay fresh here.
  const [board] = useBoardTasks(connection ? [connection] : []);
  const inBoard = findInBoard(board?.data, connectionId, taskKey);
  // Not in your list (an epic, someone else's story, a linked issue): load it on its own.
  const single = useQuery({
    enabled: !inBoard && !!connection && !!provider?.getTask,
    queryFn: async () => provider!.getTask!(await withSecrets(connection!), taskKey, fetch),
    queryKey: ["task", connectionId, taskKey],
    staleTime: 60_000,
  });
  const task = inBoard?.task ?? single.data;
  const parent = inBoard?.parent;
  const isEpic = /epic/i.test(task?.type ?? "");
  const hasChildren = !!task && !!provider?.getChildren && (isEpic || (task.childCount ?? 0) > 0);
  const children = useQuery({
    enabled: hasChildren && !!connection,
    queryFn: async () => provider!.getChildren!(await withSecrets(connection!), task!, fetch),
    queryKey: ["children", connectionId, taskKey],
    staleTime: 60_000,
  });
  const html = useQuery({
    enabled: !!task && !!connection && !!provider?.getDescriptionHtml,
    queryFn: async () =>
      (await provider!.getDescriptionHtml!(await withSecrets(connection!), taskKey, fetch)) ?? null,
    queryKey: ["description-html", connectionId, taskKey],
    staleTime: 60_000,
  });
  const canLog = useCanLogWork(connectionId);
  const openLabel = provider
    ? t("tasks.openIn", { name: provider.appName })
    : t("tasks.openSource");
  const open = (url: string) =>
    void openInSource(connectionId, url).catch(() => toast.error(t("errors.openLink")));
  /** A related task opens here when it can be loaded; otherwise in its source. */
  const goTo = (r: RelatedTask) =>
    provider?.getTask || findInBoard(board?.data, connectionId, r.key)
      ? openTask({ connectionId, key: r.key })
      : open(r.url);
  const refreshing = !!board?.isRefetching || single.isRefetching;
  const refresh = () =>
    Promise.all([
      inBoard ? board?.refetch() : single.refetch(),
      qc.invalidateQueries({ queryKey: ["comments", connectionId, taskKey] }),
      qc.invalidateQueries({ queryKey: ["children", connectionId, taskKey] }),
      qc.invalidateQueries({ queryKey: ["description-html", connectionId, taskKey] }),
      qc.invalidateQueries({ queryKey: ["worklogs", connectionId, taskKey] }),
    ]);

  const header = (
    <AppHeader
      actions={
        task ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button accessibilityLabel={t("tasks.more")} size="icon" variant="ghost">
                <Icon as={MoreHorizontal} size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onPress={() => open(task.url)}>
                <Icon as={ArrowUpRight} size={16} />
                <Text>{openLabel}</Text>
              </DropdownMenuItem>
              <DropdownMenuItem onPress={() => copyText(task.url, t("tasks.linkCopied"))}>
                <Icon as={Link2} size={16} />
                <Text>{t("tasks.copyLink")}</Text>
              </DropdownMenuItem>
              <DropdownMenuItem onPress={() => copyText(task.key, t("tasks.idCopied"))}>
                <Icon as={Hash} size={16} />
                <Text>{t("tasks.copyId")}</Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null
      }
      leading={
        <Button
          accessibilityLabel={t("ui.back")}
          onPress={() => router.back()}
          size="icon"
          variant="ghost"
        >
          <Icon as={ArrowLeft} size={20} />
        </Button>
      }
      title={taskKey}
    />
  );

  if (!task)
    return (
      <Screen header={header}>
        {single.isError ? (
          <View className="gap-3 p-5">
            <ErrorState
              description={providerErrorText(single.error, t, provider?.appName)}
              title={t("detail.loadFailed")}
            />
            <Button
              className="self-start"
              onPress={() => void single.refetch()}
              variant="secondary"
            >
              <Text>{t("ui.retry")}</Text>
            </Button>
          </View>
        ) : (
          // The page's shape while a task outside your list loads, so nothing jumps when it arrives.
          <View className="gap-4 p-5">
            <Skeleton className="h-4 w-32 rounded-sm" />
            <Skeleton className="h-6 w-full rounded-sm" />
            <Skeleton className="h-6 w-3/5 rounded-sm" />
            <Skeleton className="mt-4 h-4 w-full rounded-sm" />
            <Skeleton className="h-4 w-4/5 rounded-sm" />
          </View>
        )}
      </Screen>
    );

  const parentTask: RelatedTask | undefined =
    task.parent ??
    (parent && { key: parent.key, title: parent.title, type: parent.type, url: parent.url });
  const blockers = (task.links ?? []).filter((l) => l.blocksThis && l.statusCategory !== "done");
  const subtasks = task.subtasks ?? [];
  const done = subtasks.filter((s) => s.statusCategory === "done").length;
  // Only a task of your own list leaves it when reassigned; a sub-task stays under its parent.
  const isSubtask = !!parent || !task.updatedAt;

  return (
    <Screen
      header={header}
      refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} />}
    >
      <View className="gap-6 p-5">
        <View className="gap-2.5">
          {/* A breadcrumb like the source tool's: project / parent / this task. The parent opens on tap. */}
          <View
            accessibilityLabel={t("detail.breadcrumb")}
            className="flex-row flex-wrap items-center gap-1.5"
          >
            {provider ? (
              <View className="size-4">
                <ProviderLogo bare provider={provider} />
              </View>
            ) : null}
            {task.project ? (
              <Text className="shrink text-sm" numberOfLines={1} variant="muted">
                {task.project}
              </Text>
            ) : null}
            {parentTask ? (
              <>
                {task.project ? <Text variant="muted">/</Text> : null}
                <Pressable
                  accessibilityLabel={t("detail.openParent", {
                    key: parentTask.key,
                    title: parentTask.title,
                  })}
                  accessibilityRole="link"
                  className="min-h-8 flex-row items-center gap-1"
                  onPress={() => goTo(parentTask)}
                >
                  <TypeIcon type={parentTask.type} />
                  <Text className="text-sm text-ink-2 underline">{parentTask.key}</Text>
                </Pressable>
              </>
            ) : null}
            {task.project || parentTask ? <Text variant="muted">/</Text> : null}
            <View className="flex-row items-center gap-1">
              <TypeIcon type={task.type} />
              <Text className="text-sm text-ink-2">{task.key}</Text>
            </View>
          </View>
          <Text accessibilityRole="header" className="text-xl font-semibold leading-7" selectable>
            {task.title}
          </Text>
          {blockers.length ? (
            // A blocker is the first thing to know about a task, so it sits right under the title.
            <View className="cut flex-row flex-wrap items-center gap-1.5 bg-error-wash px-3 py-2.5">
              <Icon as={Ban} className="text-error" size={14} />
              <Text className="text-sm font-medium text-error">{t("detail.blockedBy")}</Text>
              {blockers.map((b) => (
                <Pressable
                  accessibilityLabel={`${b.key} ${b.title ?? ""}`.trim()}
                  accessibilityRole="link"
                  className="min-h-8 justify-center px-1"
                  hitSlop={{ bottom: 6, top: 6 }}
                  key={b.key}
                  onPress={() => goTo(b)}
                >
                  <Text className="font-mono text-xs text-error underline">{b.key}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* The same controls as on the card, laid out as labelled fields. */}
        <View className="gap-3">
          {task.type ? (
            <Field label={t("detail.type")}>
              <View className="flex-row items-center gap-1.5">
                <TypeIcon type={task.type} />
                <Text className="text-sm">{task.type}</Text>
              </View>
            </Field>
          ) : null}
          <Field label={t("detail.status")}>
            <StatusControl connectionId={connectionId} task={task} />
          </Field>
          <Field label={t("detail.assignee")}>
            <AssigneeControl connectionId={connectionId} leavesList={!isSubtask} task={task} />
          </Field>
          {task.priority ? (
            <Field label={t("detail.priority")}>
              <Priority label={task.priority} level={task.priorityLevel} />
            </Field>
          ) : null}
          {canLog || task.loggedSeconds || task.estimateSeconds ? (
            <Field label={t("detail.time")}>
              <TimeControl connectionId={connectionId} task={task} />
            </Field>
          ) : null}
          {task.storyPoints != null ? (
            <Field label={t("detail.points")}>
              <Text className="text-sm">{task.storyPoints}</Text>
            </Field>
          ) : null}
          {task.sprint ? (
            <Field label={t("detail.sprint")}>
              <Text className="text-sm">{task.sprint}</Text>
            </Field>
          ) : null}
          {task.updatedAt ? (
            <Field label={t("detail.updatedLabel")}>
              <Text className="text-sm">{timeAgo(task.updatedAt)}</Text>
            </Field>
          ) : null}
        </View>

        {/* The source's own rendering (tables, panels, smart links) when it has one; our plain version only as a fallback. */}
        {html.isPending && html.fetchStatus !== "idle" ? (
          <Block title={t("detail.description")}>
            <View className="gap-2">
              <Skeleton className="h-4 w-full rounded-sm" />
              <Skeleton className="h-4 w-11/12 rounded-sm" />
              <Skeleton className="h-4 w-3/5 rounded-sm" />
            </View>
          </Block>
        ) : html.data ? (
          <Block title={t("detail.description")}>
            <SourceHtml
              base={siteOf(task.url)}
              connectionId={connectionId}
              html={html.data}
              taskUrl={task.url}
            />
          </Block>
        ) : task.description || task.descriptionParts ? (
          <Block title={t("detail.description")}>
            <RichText
              attachments={task.attachments}
              connectionId={connectionId}
              parts={task.descriptionParts}
              taskUrl={task.url}
              text={task.description}
            />
          </Block>
        ) : null}

        <AttachmentImages
          attachments={task.attachments}
          connectionId={connectionId}
          exclude={inlineImageIds(task.descriptionParts)}
          taskUrl={task.url}
        />

        {subtasks.length ? (
          <Block title={`${t("tasks.subtasks")} · ${done}/${subtasks.length}`}>
            <SubtaskList provider={provider} task={task} />
          </Block>
        ) : null}

        {hasChildren ? (
          <Block title={isEpic ? t("detail.epicIssues") : t("tasks.subtasks")}>
            {children.isPending ? (
              <View className="gap-2">
                <Skeleton className="h-11 w-full rounded-sm" />
                <Skeleton className="h-11 w-full rounded-sm" />
              </View>
            ) : children.isError ? (
              <ErrorState
                description={providerErrorText(children.error, t, provider?.appName)}
                title={t("detail.loadFailed")}
              />
            ) : !children.data.length ? (
              <Text className="text-sm" variant="muted">
                {t("detail.epicEmpty")}
              </Text>
            ) : (
              <RelatedList items={children.data} onPress={(r) => goTo(r)} />
            )}
          </Block>
        ) : null}

        {task.links?.length ? (
          <Block title={t("detail.links")}>
            {[...new Set(task.links.map((l) => l.relation))].map((relation) => (
              <View className="gap-1.5" key={relation}>
                <Text className="text-xs" variant="muted">
                  {relation}
                </Text>
                <RelatedList
                  items={task.links!.filter((l) => l.relation === relation)}
                  onPress={goTo}
                />
              </View>
            ))}
          </Block>
        ) : null}

        <Comments
          attachments={task.attachments}
          connectionId={connectionId}
          taskKey={task.key}
          url={task.url}
        />
      </View>
    </Screen>
  );
}

/** The site a task's URL belongs to (relative links and images in source HTML resolve against it). */
const siteOf = (url: string) =>
  url.slice(0, Math.max(0, url.indexOf("/browse/"))) || new URL(url).origin;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-row items-start gap-3">
      <Text className="w-24 pt-1.5 text-sm" variant="muted">
        {label}
      </Text>
      <View className="min-h-8 min-w-0 flex-1 justify-center">{children}</View>
    </View>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2.5">
      <Text accessibilityRole="header" className="text-sm font-semibold text-ink-2">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Related tasks (an epic's issues, linked issues): status, type, key and title; each opens its own page. */
function RelatedList({
  items,
  onPress,
}: {
  items: RelatedTask[];
  onPress: (r: RelatedTask) => void;
}) {
  return (
    <View className="cut overflow-hidden border border-rule">
      {items.map((r, i) => (
        <Pressable
          accessibilityRole="link"
          className={cn(
            "min-h-12 flex-row items-center gap-2 px-3 py-2.5 active:bg-paper-2",
            i > 0 && "border-t border-rule",
          )}
          key={r.key}
          onPress={() => onPress(r)}
        >
          {r.statusCategory ? <StatusDot category={r.statusCategory} /> : null}
          <TypeIcon type={r.type} />
          <Text className="font-mono text-xs" variant="muted">
            {r.key}
          </Text>
          <Text
            className={cn(
              "min-w-0 flex-1 text-sm",
              r.statusCategory === "done" && "text-muted-foreground line-through",
            )}
            numberOfLines={1}
          >
            {r.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
