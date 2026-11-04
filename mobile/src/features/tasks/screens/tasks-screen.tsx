import {
  activeFilterCount,
  emptyFilters,
  filterOptions,
  getProvider,
  matchesFilters,
  matchesQuery,
  sortTasks,
} from "@mytask/core";
import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Text } from "@/components/ui/text";
import {
  renameConnection,
  useConnectionsStore,
  type StoredConnection,
} from "@/features/connections/api/connections";
import { ProviderLogo } from "@/features/connections/components/provider-logo";
import { providerErrorText } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { router } from "expo-router";
import { Plus, QrCode } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { ActiveFilters, FilterButton } from "../components/filter-sheet";
import { TaskRow } from "../components/task-row";
import { useBoardTasks } from "../hooks/use-board-tasks";
import { useBoardFilters } from "../hooks/use-filters";
import { useRemoteSearch } from "../hooks/use-remote-search";

const ALL = "all";

function Tab({
  label,
  count,
  selected,
  onPress,
  onLongPress,
  icon,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      className={cn(
        "h-9 flex-row items-center gap-1.5 rounded-full px-3.5 active:scale-[0.97]",
        selected ? "bg-primary" : "bg-paper-3",
      )}
      onLongPress={onLongPress}
      onPress={onPress}
    >
      {icon}
      <Text
        className={cn("text-sm font-medium", selected && "text-primary-foreground")}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count != null ? (
        <Text
          className={cn(
            "text-xs",
            selected ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

function RowSkeleton() {
  // Shaped like the rows it stands in for.
  return (
    <View className="flex-row gap-3 border-b border-rule px-5 py-3.5">
      <Skeleton className="size-9 rounded-md" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-3 w-24 rounded-sm" />
        <Skeleton className="h-4 w-4/5 rounded-sm" />
        <Skeleton className="h-3 w-32 rounded-sm" />
      </View>
    </View>
  );
}

export function TasksScreen() {
  const { t } = useTranslation();
  const boards = useConnectionsStore((s) => s.connections);
  const results = useBoardTasks(boards);
  const [board, setBoard] = useState(ALL);
  const [query, setQuery] = useState("");

  // With a single board there are no tabs, so that board is the one shown (and its source is searched too).
  const selected = boards.length === 1 ? boards[0]!.id : board;
  const isAll = selected === ALL || !boards.some((b) => b.id === selected);
  const visible = boards.flatMap((b, i) =>
    isAll || b.id === selected ? [{ board: b, result: results[i]! }] : [],
  );
  const allTasks = sortTasks(visible.flatMap((v) => v.result.data ?? []));
  const [filters, setFilters] = useBoardFilters(isAll ? ALL : selected);
  const options = filterOptions(allTasks);
  const filtering = activeFilterCount(filters) > 0;
  const tasks = allTasks.filter(
    (task) => matchesFilters(task, filters) && matchesQuery(task, query),
  );
  // "All" searches only my tasks; a single board also searches its source.
  const remote = useRemoteSearch(isAll ? [] : visible.map((v) => v.board), query, allTasks);
  const shownIds = new Set(tasks.map((task) => task.id));
  const remoteTasks = remote.tasks.filter(
    (task) => !shownIds.has(task.id) && matchesFilters(task, filters),
  );
  const activeBoard = isAll ? undefined : visible[0]?.board;
  const activeApp = getProvider(activeBoard?.providerId ?? "")?.appName;
  const sourceNames = [
    ...new Set(visible.map((v) => getProvider(v.board.providerId)?.name).filter(Boolean)),
  ].join(", ");
  const nothingFound =
    !!query.trim() && !tasks.length && (!remote.active || (!remote.pending && !remoteTasks.length));
  const filteredOut = filtering && !query.trim() && !tasks.length && allTasks.length > 0;
  const providerOf = (connectionId: string) =>
    getProvider(boards.find((b) => b.id === connectionId)?.providerId ?? "");
  const failed = visible.filter((v) => v.result.isError);
  const loading = visible.some((v) => v.result.isPending);
  const refreshing = visible.some((v) => v.result.isRefetching);
  const lastUpdated = Math.min(...visible.map((v) => v.result.dataUpdatedAt).filter(Boolean));
  const refresh = () => Promise.all(visible.map((v) => v.result.refetch()));
  // Long-press a tab to rename it (desktop: double-click). iOS asks in place; elsewhere the connection screen has the name.
  const rename = (b: StoredConnection) => {
    if (Platform.OS !== "ios")
      return router.push({ params: { id: b.id }, pathname: "/connection" });
    Alert.prompt(
      t("boards.rename"),
      undefined,
      [
        { style: "cancel", text: t("ui.cancel") },
        {
          onPress: (name?: string) =>
            name?.trim() && renameConnection(b.id, name.trim().slice(0, 60)),
          text: t("ui.save"),
        },
      ],
      "plain-text",
      b.name,
    );
  };

  if (!boards.length)
    return (
      <Screen header={<AppHeader title={t("tasks.title")} />}>
        <EmptyState
          action={
            <View className="items-center gap-2">
              <Button onPress={() => router.push("/connection")}>
                <Icon as={Plus} className="text-primary-foreground" size={16} />
                <Text>{t("connections.add")}</Text>
              </Button>
              {/* Already set up on the Mac: bring those boards over instead of making new keys. */}
              <Button onPress={() => router.push("/transfer-receive")} variant="ghost">
                <Icon as={QrCode} size={16} />
                <Text>{t("transfer.receive")}</Text>
              </Button>
            </View>
          }
          description={t("tasks.noBoardsDescription")}
          title={t("tasks.noBoardsTitle")}
        />
      </Screen>
    );

  const header = (
    <View className="border-b border-rule">
      <AppHeader
        actions={
          Number.isFinite(lastUpdated) ? (
            <Text className="pr-2 text-xs" variant="muted">
              {refreshing
                ? t("tasks.refreshing")
                : t("tasks.updated", { time: timeAgo(new Date(lastUpdated).toISOString()) })}
            </Text>
          ) : null
        }
        title={t("tasks.title")}
      />
      {boards.length > 1 ? (
        <ScrollView
          accessibilityRole="tablist"
          contentContainerClassName="gap-1.5 px-5 pt-3"
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <Tab
            count={results.reduce((n, r) => n + (r.data?.length ?? 0), 0)}
            label={t("tasks.all")}
            onPress={() => setBoard(ALL)}
            selected={isAll}
          />
          {boards.map((b, i) => {
            const provider = getProvider(b.providerId);
            return (
              <Tab
                count={results[i]?.data?.length}
                icon={provider ? <ProviderMark provider={provider} /> : null}
                key={b.id}
                label={b.name}
                onLongPress={() => rename(b)}
                onPress={() => setBoard(b.id)}
                selected={!isAll && board === b.id}
              />
            );
          })}
        </ScrollView>
      ) : null}
      <View className="flex-row items-center gap-2 px-5 py-3">
        <SearchField
          label={isAll ? t("tasks.searchAll") : t("tasks.searchBoard", { name: activeBoard?.name })}
          onChangeText={setQuery}
          value={query}
        />
        <FilterButton filters={filters} onChange={setFilters} options={options} />
      </View>
      <ActiveFilters filters={filters} onChange={setFilters} options={options} />
    </View>
  );

  return (
    <Screen
      header={header}
      refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} />}
    >
      {failed.map(({ board: b, result }) => (
        <ErrorState
          className="mx-5 mt-4"
          description={providerErrorText(result.error, t, getProvider(b.providerId)?.appName)}
          key={b.id}
          title={t("tasks.errorTitle", { name: b.name })}
        />
      ))}
      {loading && !allTasks.length ? (
        <>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </>
      ) : filteredOut ? (
        <EmptyState
          action={
            <Button onPress={() => setFilters(emptyFilters())} variant="secondary">
              <Text>{t("filters.clear")}</Text>
            </Button>
          }
          description={t("filters.noMatchHint")}
          title={t("filters.noMatch")}
        />
      ) : nothingFound ? (
        <EmptyState
          action={
            <Button onPress={() => setQuery("")} variant="secondary">
              <Text>{t("ui.clearSearch")}</Text>
            </Button>
          }
          description={
            remote.failed
              ? providerErrorText(remote.failed, t, activeApp)
              : t("tasks.noResultsHint")
          }
          title={t("tasks.noResults", { query: query.trim() })}
        />
      ) : tasks.length || remote.active ? (
        <>
          {tasks.map((task) => (
            <TaskRow
              key={`${task.connectionId}:${task.id}`}
              provider={providerOf(task.connectionId)}
              task={task}
            />
          ))}
          {remote.active ? (
            <>
              <View className="h-9 flex-row items-center gap-2 border-b border-rule bg-paper-2 px-5">
                <Text className="text-xs font-semibold" variant="muted">
                  {t("tasks.moreInSource", { name: sourceNames })}
                </Text>
                {remote.pending ? <ActivityIndicator size="small" /> : null}
              </View>
              {remoteTasks.length
                ? remoteTasks.map((task) => (
                    <TaskRow
                      key={`${task.connectionId}:${task.id}`}
                      provider={providerOf(task.connectionId)}
                      task={task}
                    />
                  ))
                : !remote.pending && (
                    <Text className="px-5 py-3 text-sm" variant="muted">
                      {remote.failed
                        ? providerErrorText(remote.failed, t, activeApp)
                        : t("tasks.noMoreInSource", { name: sourceNames })}
                    </Text>
                  )}
            </>
          ) : null}
        </>
      ) : (
        !failed.length && (
          <EmptyState description={t("settings.refreshHint")} title={t("tasks.emptyTitle")} />
        )
      )}
    </Screen>
  );
}

/** The provider's mark at tab size, without the tile. */
function ProviderMark({ provider }: { provider: NonNullable<ReturnType<typeof getProvider>> }) {
  return (
    <View className="size-4">
      <ProviderLogo bare provider={provider} />
    </View>
  );
}
