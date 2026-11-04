import type { Provider, Subtask, Task } from "@mytask/core";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ProviderLogo } from "@/features/connections/components/provider-logo";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { router } from "expo-router";
import {
  ArrowUpRight,
  ChevronDown,
  Gauge,
  Hash,
  IterationCw,
  Link2,
  ListTree,
} from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { toast } from "sonner-native";
import { copyText, openInSource } from "../api/open-in-source";
import { useCanAssign, useCurrentUser } from "../hooks/use-assignee";
import { useCanChangeStatus } from "../hooks/use-transitions";
import { useCanLogWork } from "../hooks/use-worklog";
import { Status } from "./status";
import { Avatar, Priority, StatusDot, TimeTracking } from "./task-bits";
import { openTaskSheet, type SheetTarget } from "./task-sheets";

/** Opens a task's detail page; the page finds it in its board (or loads it) by key. */
export const openTask = (task: Pick<Task, "connectionId" | "key">) =>
  router.push({ params: { connectionId: task.connectionId, key: task.key }, pathname: "/task" });

const sheetTarget = (
  task: Task | Subtask,
  connectionId: string,
  leavesList?: boolean,
): SheetTarget => ({
  assignee: task.assignee,
  category: task.statusCategory,
  connectionId,
  estimate: task.estimateSeconds,
  leavesListWhenReassigned: leavesList,
  logged: task.loggedSeconds,
  status: task.status,
  taskKey: task.key,
  url: task.url,
});

/** A control inside a row (status, assignee, time): its own press target above the row's, with a ⌄ when it opens something. */
export function RowControl({
  label,
  onPress,
  children,
  chevron = true,
}: {
  label: string;
  onPress?: () => void;
  children: ReactNode;
  chevron?: boolean;
}) {
  if (!onPress) return <View className="min-w-0 flex-row items-center">{children}</View>;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="-mx-1.5 min-h-8 min-w-0 flex-row items-center gap-0.5 rounded-sm px-1.5 active:bg-paper-3"
      hitSlop={{ bottom: 6, top: 6 }}
      onPress={onPress}
    >
      {children}
      {chevron ? <Icon as={ChevronDown} className="text-muted-foreground" size={13} /> : null}
    </Pressable>
  );
}

/** A task's status; opens the status sheet where the board supports status changes. */
export function StatusControl({
  task,
  connectionId,
}: {
  task: Task | Subtask;
  connectionId: string;
}) {
  const { t } = useTranslation();
  const canStatus = useCanChangeStatus(connectionId);
  return (
    <RowControl
      label={t("tasks.changeStatus", { status: task.status })}
      onPress={
        canStatus ? () => openTaskSheet("status", sheetTarget(task, connectionId)) : undefined
      }
    >
      <Status category={task.statusCategory} label={task.status} />
    </RowControl>
  );
}

/** Who has the task; opens the assignee sheet where the board supports assignment. */
export function AssigneeControl({
  task,
  connectionId,
  leavesList,
}: {
  task: Task | Subtask;
  connectionId: string;
  leavesList?: boolean;
}) {
  const { t } = useTranslation();
  const canAssign = useCanAssign(connectionId);
  return (
    <RowControl
      label={t("tasks.changeAssignee", { name: task.assignee?.name ?? t("tasks.unassigned") })}
      onPress={
        canAssign
          ? () => openTaskSheet("assignee", sheetTarget(task, connectionId, leavesList))
          : undefined
      }
    >
      <View className="min-w-0 flex-row items-center gap-1.5">
        <Avatar name={task.assignee?.name} size={20} />
        <Text
          className={cn("shrink text-sm", task.assignee ? "text-ink-2" : "text-muted-foreground")}
          numberOfLines={1}
        >
          {task.assignee?.name ?? t("tasks.unassigned")}
        </Text>
      </View>
    </RowControl>
  );
}

/** Status, priority and assignee on one line, as on a card. */
export function TaskControls({
  task,
  connectionId,
  leavesList,
}: {
  task: Task | Subtask;
  connectionId: string;
  leavesList?: boolean;
}) {
  return (
    <View className="min-w-0 flex-row flex-wrap items-center gap-x-3">
      <StatusControl connectionId={connectionId} task={task} />
      {/* Medium is the default on almost every task; only an unusual priority is worth the space. */}
      {"priority" in task && task.priority && task.priorityLevel !== 3 ? (
        <Priority label={task.priority} level={task.priorityLevel} />
      ) : null}
      <AssigneeControl connectionId={connectionId} leavesList={leavesList} task={task} />
    </View>
  );
}

/** Logged time against the estimate; opens the log sheet where the board supports time tracking. */
export function TimeControl({
  task,
  connectionId,
}: {
  task: Task | Subtask;
  connectionId: string;
}) {
  const { t } = useTranslation();
  const canLog = useCanLogWork(connectionId);
  const time = (
    <TimeTracking
      empty={canLog ? t("tasks.addTime") : undefined}
      estimate={task.estimateSeconds}
      logged={task.loggedSeconds}
    />
  );
  return (
    <RowControl
      chevron={false}
      label={t("tasks.logWorkOn", { key: task.key })}
      onPress={canLog ? () => openTaskSheet("log", sheetTarget(task, connectionId)) : undefined}
    >
      {time}
    </RowControl>
  );
}

/** Long-press a task to open it in its source, or copy its link or id (for a branch name). */
function TaskMenu({
  task,
  connectionId,
  openLabel,
  children,
}: {
  task: Task | Subtask;
  connectionId: string;
  openLabel: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <ContextMenu>
      {/* asChild: the row's own Pressable takes the long press, so taps still open the task. */}
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-52">
        <ContextMenuItem
          onPress={() =>
            void openInSource(connectionId, task.url).catch(() => toast.error(t("errors.openLink")))
          }
        >
          <Icon as={ArrowUpRight} size={16} />
          <Text>{openLabel}</Text>
        </ContextMenuItem>
        <ContextMenuItem onPress={() => copyText(task.url, t("tasks.linkCopied"))}>
          <Icon as={Link2} size={16} />
          <Text>{t("tasks.copyLink")}</Text>
        </ContextMenuItem>
        <ContextMenuItem onPress={() => copyText(task.key, t("tasks.idCopied"))}>
          <Icon as={Hash} size={16} />
          <Text>{t("tasks.copyId")}</Text>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Desktop's queue row: provider, key, sprint, type and age; the title; status, priority, assignee; points, time, sub-tasks. */
export function TaskRow({ task, provider }: { task: Task; provider?: Provider }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter((s) => s.statusCategory === "done").length;
  const canLog = useCanLogWork(task.connectionId);
  const hasPlanning =
    canLog ||
    task.storyPoints != null ||
    !!task.estimateSeconds ||
    !!task.loggedSeconds ||
    subtasks.length > 0;
  const blocked = task.links?.some((l) => l.blocksThis && l.statusCategory !== "done");
  const openLabel = provider
    ? t("tasks.openIn", { name: provider.appName })
    : t("tasks.openSource");

  return (
    <View className="border-b border-rule">
      <TaskMenu connectionId={task.connectionId} openLabel={openLabel} task={task}>
        <Pressable
          accessibilityHint={t("tasks.viewDetails")}
          className="flex-row gap-3 px-5 py-3.5 active:bg-paper-2"
          onPress={() => openTask(task)}
        >
          {provider ? <ProviderLogo provider={provider} /> : null}
          <View className="min-w-0 flex-1 gap-1.5">
            <View className="flex-row items-center gap-2">
              <Text className="shrink-0 font-mono text-xs text-ink-2">{task.key}</Text>
              {task.sprint ? (
                <View className="min-w-0 shrink flex-row items-center gap-1">
                  <Icon as={IterationCw} className="text-muted-foreground" size={11} />
                  <Text className="shrink text-xs text-ink-2" numberOfLines={1}>
                    {task.sprint}
                  </Text>
                </View>
              ) : null}
              {task.type ? (
                <Text
                  className="rounded-sm bg-paper-3 px-1.5 py-px text-xs font-medium text-ink-2"
                  numberOfLines={1}
                >
                  {task.type}
                </Text>
              ) : null}
              {/* Worth seeing from the list: something unfinished is blocking this task. */}
              {blocked ? (
                <Text className="rounded-sm bg-error-wash px-1.5 py-px text-xs font-medium text-error">
                  {t("tasks.blocked")}
                </Text>
              ) : null}
              <Text className="ml-auto shrink-0 text-xs" variant="muted">
                {timeAgo(task.updatedAt)}
              </Text>
            </View>
            <Text className="font-semibold leading-[21px]" numberOfLines={2}>
              {task.title}
            </Text>
            <TaskControls connectionId={task.connectionId} leavesList task={task} />
            {hasPlanning ? (
              <View className="min-w-0 flex-row flex-wrap items-center gap-x-3">
                {task.storyPoints != null ? (
                  <View className="flex-row items-center gap-1">
                    <Icon as={Gauge} className="text-muted-foreground" size={13} />
                    <Text className="text-sm text-ink-2">
                      {t("tasks.points", { count: task.storyPoints })}
                    </Text>
                  </View>
                ) : null}
                <TimeControl connectionId={task.connectionId} task={task} />
                {subtasks.length > 0 ? (
                  // The sub-task count is also the toggle that opens them under the card.
                  <Pressable
                    accessibilityLabel={`${t("tasks.subtasksDone", { done: doneSubtasks, total: subtasks.length })}. ${expanded ? t("tasks.hideSubtasks") : t("tasks.showSubtasks")}`}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    className={cn(
                      "-mx-1.5 min-h-8 flex-row items-center gap-1 rounded-sm px-1.5 active:bg-paper-3",
                      expanded && "bg-paper-3",
                    )}
                    hitSlop={{ bottom: 6, top: 6 }}
                    onPress={() => setExpanded((v) => !v)}
                  >
                    <Icon as={ListTree} className="text-muted-foreground" size={13} />
                    <Text className="text-sm text-ink-2">
                      {doneSubtasks}/{subtasks.length}
                    </Text>
                    <Icon
                      as={ChevronDown}
                      className="text-muted-foreground"
                      size={13}
                      style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
                    />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </Pressable>
      </TaskMenu>
      {expanded && subtasks.length > 0 ? (
        <View className="bg-paper-2 py-3 pl-[68px] pr-5">
          <SubtaskList provider={provider} task={task} />
        </View>
      ) : null}
    </View>
  );
}

/** A task's sub-tasks: yours first, then in progress before to do; done always last. */
export function SubtaskList({ task, provider }: { task: Task; provider?: Provider }) {
  const { t } = useTranslation();
  const subtasks = task.subtasks ?? [];
  const me = useCurrentUser(task.connectionId, subtasks.length > 0).data?.id;
  // sort is stable, so the source's order breaks ties.
  const rank = (s: Subtask) =>
    (s.statusCategory === "done" ? 4 : 0) +
    (me && s.assignee?.id === me ? 0 : 2) +
    (s.statusCategory === "in_progress" ? 0 : 1);
  const openLabel = provider
    ? t("tasks.openIn", { name: provider.appName })
    : t("tasks.openSource");
  return (
    <View className="cut overflow-hidden border border-rule bg-background">
      {[...subtasks]
        .sort((a, b) => rank(a) - rank(b))
        .map((s, i) => {
          const mine = !!me && s.assignee?.id === me;
          return (
            <View className={cn(i > 0 && "border-t border-rule")} key={s.id}>
              <TaskMenu connectionId={task.connectionId} openLabel={openLabel} task={s}>
                {/* Your own sub-tasks carry an accent edge. */}
                <Pressable
                  className={cn(
                    "gap-1.5 px-3 py-2.5 active:bg-paper-2",
                    mine && "border-l-2 border-progress bg-paper-2",
                  )}
                  onPress={() => openTask({ connectionId: task.connectionId, key: s.key })}
                >
                  <View className="flex-row items-center gap-2">
                    <StatusDot category={s.statusCategory} />
                    <Text className="font-mono text-xs" variant="muted">
                      {s.key}
                    </Text>
                  </View>
                  <Text
                    className={cn(
                      "leading-5",
                      s.statusCategory === "done" && "text-muted-foreground line-through",
                    )}
                    numberOfLines={2}
                  >
                    {s.title}
                  </Text>
                  <TaskControls connectionId={task.connectionId} task={s} />
                  <TimeControl connectionId={task.connectionId} task={s} />
                </Pressable>
              </TaskMenu>
            </View>
          );
        })}
    </View>
  );
}
