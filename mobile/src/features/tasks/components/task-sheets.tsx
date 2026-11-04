import {
  parseDuration,
  type Person,
  type StatusCategory,
  type Transition,
  type TransitionInput,
} from "@mytask/core";
import { BottomSheetModal, type BottomSheetModalRef } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebounce } from "@/hooks/use-debounce";
import { providerErrorText } from "@/lib/errors";
import { duration } from "@/lib/format";
import { APP_FONT_FAMILY } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  BottomSheetFlatList,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { Check, ExternalLink, FileInput, Trash2, UserMinus } from "lucide-react-native";
import { cssInterop } from "nativewind";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { toast } from "sonner-native";
import { create } from "zustand";
import { openInSource } from "../api/open-in-source";
import { useAssign, useAssignees, useCurrentUser } from "../hooks/use-assignee";
import { useBoard } from "../hooks/use-board";
import { useChangeStatus, useFindTransitionBack, useTransitions } from "../hooks/use-transitions";
import { useLogWork, useWorkLogs } from "../hooks/use-worklog";
import { Avatar, StatusDot } from "./task-bits";

cssInterop(BottomSheetTextInput, { className: "style" });

/** The task (or sub-task) a sheet acts on: what its row already shows. */
export type SheetTarget = {
  connectionId: string;
  taskKey: string;
  url: string;
  status: string;
  category: StatusCategory;
  assignee?: Person;
  logged?: number;
  estimate?: number;
  /** Main list shows only my tasks: assigning away means it leaves the list on the next refresh. */
  leavesListWhenReassigned?: boolean;
};

type Kind = "status" | "assignee" | "log";

// One sheet for the whole app, opened by whichever row or detail field was tapped: a list of many tasks
// never mounts a sheet per row.
const useSheet = create<{ kind?: Kind; target?: SheetTarget }>(() => ({}));
export const openTaskSheet = (kind: Kind, target: SheetTarget) =>
  useSheet.setState({ kind, target });
const closeSheet = () => useSheet.setState({ kind: undefined, target: undefined });

/** Mounted once at the root; shows the status, assignee or log-time sheet for the chosen task. */
export function TaskSheets() {
  const ref = useRef<BottomSheetModalRef>(null);
  const { kind, target } = useSheet();

  useEffect(() => {
    if (kind) ref.current?.present();
  }, [kind, target]);

  const dismiss = () => ref.current?.dismiss();

  return (
    <BottomSheetModal
      enableDynamicSizing={kind !== "assignee"}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={closeSheet}
      ref={ref}
      snapPoints={kind === "assignee" ? ["75%"] : undefined}
    >
      {target && kind === "status" ? <StatusSheet onDone={dismiss} target={target} /> : null}
      {target && kind === "assignee" ? <AssigneeSheet onDone={dismiss} target={target} /> : null}
      {target && kind === "log" ? <LogWorkSheet onDone={dismiss} target={target} /> : null}
    </BottomSheetModal>
  );
}

function SheetTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="gap-0.5 pb-1">
      <Text className="text-[17px] font-semibold">{title}</Text>
      {subtitle ? (
        <Text className="font-mono text-xs" variant="muted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** A tappable line in a sheet list: at least 48pt tall, one fill on press. */
function SheetRow({
  icon,
  children,
  trailing,
  onPress,
  disabled,
}: {
  icon?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={cn(
        "min-h-12 flex-row items-center gap-3 rounded-md px-2 active:bg-paper-3",
        disabled && "opacity-50",
      )}
      disabled={disabled}
      onPress={onPress}
    >
      {icon}
      <View className="min-w-0 flex-1">{children}</View>
      {trailing}
    </Pressable>
  );
}

function SheetInput({ className, ...props }: React.ComponentProps<typeof BottomSheetTextInput>) {
  const theme = useAppTheme();
  return (
    <BottomSheetTextInput
      className={cn(
        "h-11 rounded-full border border-input bg-background px-4 text-base text-foreground",
        className,
      )}
      placeholderTextColor={theme.values.mutedInk}
      style={{ fontFamily: APP_FONT_FAMILY.regular }}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------------------------------------- Status */

function StatusSheet({ target, onDone }: { target: SheetTarget; onDone: () => void }) {
  const { t } = useTranslation();
  const { connectionId, taskKey, status } = target;
  const [formFor, setFormFor] = useState<Transition | null>(null);
  const transitions = useTransitions(connectionId, taskKey, true);
  const change = useChangeStatus(connectionId);
  const findBack = useFindTransitionBack(connectionId);
  const appName = useBoard(connectionId).provider?.appName;

  /** Success toast with undo back to the previous status (when the workflow allows it without a form). */
  const announce = (transition: Transition, undoable: boolean) =>
    toast.success(t("tasks.statusChanged", { key: taskKey, status: transition.to.name }), {
      action: undoable
        ? {
            label: t("ui.undo"),
            onClick: async () => {
              const back = await findBack(taskKey, status).catch(() => undefined);
              if (back && !back.fields.some((f) => f.required)) move(back, false);
              else toast.error(t("tasks.undoUnavailable", { app: appName, status }));
            },
          }
        : undefined,
    });

  const move = (transition: Transition, undoable = true, input?: TransitionInput) =>
    change.mutate(
      { input, taskKey, transition },
      {
        onSuccess: () => {
          onDone();
          announce(transition, undoable);
        },
        // A form shows its own error; a direct move reports in a toast.
        onError: input
          ? undefined
          : (error) =>
              toast.error(t("tasks.statusChangeFailed", { key: taskKey }), {
                description: providerErrorText(error, t, appName),
              }),
      },
    );

  if (formFor)
    return (
      <TransitionForm
        error={change.isError ? providerErrorText(change.error, t, appName) : undefined}
        onCancel={() => {
          setFormFor(null);
          change.reset();
        }}
        onSubmit={(input) => move(formFor, true, input)}
        pending={change.isPending}
        taskKey={taskKey}
        transition={formFor}
      />
    );

  const needsSource = transitions.isError || transitions.data?.some((tr) => tr.needsInput);

  return (
    <BottomSheetScrollView contentContainerClassName="gap-1 px-4 pb-10">
      <View className="px-2">
        <SheetTitle subtitle={taskKey} title={t("tasks.moveTo")} />
      </View>
      {transitions.isPending ? (
        <View className="gap-2 p-2">
          <Skeleton className="h-6 w-full rounded-sm" />
          <Skeleton className="h-6 w-4/5 rounded-sm" />
        </View>
      ) : transitions.isError ? (
        <Text className="px-2 text-sm text-error">
          {providerErrorText(transitions.error, t, appName)}
        </Text>
      ) : transitions.data.length === 0 ? (
        <Text className="px-2 text-sm" variant="muted">
          {t("tasks.noTransitions")}
        </Text>
      ) : (
        transitions.data.map((tr) => (
          <SheetRow
            disabled={tr.needsInput || change.isPending}
            icon={<StatusDot category={tr.to.category} />}
            key={tr.id}
            // Transitions with a screen (e.g. "Estimated Budget Effort") open a form first.
            onPress={() => (tr.fields.length ? setFormFor(tr) : move(tr))}
            trailing={
              change.isPending && change.variables?.transition.id === tr.id ? (
                <ActivityIndicator size="small" />
              ) : tr.needsInput ? (
                <Text className="text-xs" variant="muted">
                  {t("tasks.needsSource", { app: appName })}
                </Text>
              ) : tr.fields.length ? (
                <Icon as={FileInput} className="text-muted-foreground" size={16} />
              ) : null
            }
          >
            {/* Workflows often name the action ("Send Code Review"); show it like Jira does, with the target status. */}
            <Text numberOfLines={1}>{tr.name}</Text>
            {tr.name.trim().toLocaleLowerCase() !== tr.to.name.trim().toLocaleLowerCase() ? (
              <Text className="text-xs" variant="muted">
                → {tr.to.name}
              </Text>
            ) : null}
          </SheetRow>
        ))
      )}
      {needsSource ? (
        <SheetRow
          icon={<Icon as={ExternalLink} className="text-muted-foreground" size={16} />}
          onPress={() => {
            onDone();
            void openInSource(connectionId, target.url).catch(() =>
              toast.error(t("errors.openLink")),
            );
          }}
        >
          <Text>{t("tasks.openToChange", { app: appName })}</Text>
        </SheetRow>
      ) : null}
    </BottomSheetScrollView>
  );
}

/** A field's choices as a dropdown, so a long list (Jira projects, components) stays one row tall. */
function OptionSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value?: string;
  onChange: (id: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const picked = options.find((o) => o.id === value);
  return (
    <Select
      onValueChange={(o) => o && onChange(o.value)}
      value={picked ? { label: picked.name, value: picked.id } : undefined}
    >
      <SelectTrigger className="h-11 w-full rounded-full border-input bg-background px-4 shadow-none">
        <SelectValue className="text-base" placeholder={label} />
      </SelectTrigger>
      {/* Trigger width (the sheet's 20 pt sides); the list scrolls instead of running off screen. */}
      <SelectContent style={{ width: width - 40 }}>
        <ScrollView bounces={false} style={{ maxHeight: height * 0.4 }}>
          {options.map((o) => (
            <SelectItem key={o.id} label={o.name} value={o.id}>
              <Text>{o.name}</Text>
            </SelectItem>
          ))}
        </ScrollView>
      </SelectContent>
    </Select>
  );
}

/** The transition's screen (e.g. "Estimated Budget Effort"), built from the fields the source reports. */
function TransitionForm({
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
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const problems: Record<string, string> = {};
  for (const f of transition.fields) {
    const v = values[f.key]?.trim() ?? "";
    if (f.required && !v) problems[f.key] = t("connections.required");
    else if (v && f.kind === "number" && !Number.isFinite(Number(v.replace(",", "."))))
      problems[f.key] = t("tasks.mustBeNumber");
  }
  const submit = () => {
    setTouched(true);
    if (Object.keys(problems).length) return;
    onSubmit({ comment: comment.trim() || undefined, values });
  };

  return (
    <BottomSheetScrollView
      contentContainerClassName="gap-4 px-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-0.5">
        <Text className="text-[17px] font-semibold">{transition.name}</Text>
        <Text className="text-sm" variant="muted">
          {t("tasks.formMovesTo", { key: taskKey, status: transition.to.name })}
        </Text>
      </View>
      {transition.fields.map((f) => (
        <View className="gap-2" key={f.key}>
          <Text className="text-sm font-medium">
            {f.required ? f.name : t("tasks.optionalField", { name: f.name })}
          </Text>
          {f.kind === "select" ? (
            <OptionSelect
              label={f.name}
              onChange={(id) => set(f.key, id)}
              options={f.options ?? []}
              value={values[f.key]}
            />
          ) : (
            <SheetInput
              className={f.kind === "textarea" ? "h-24 rounded-md py-3" : undefined}
              keyboardType={f.kind === "number" ? "decimal-pad" : "default"}
              multiline={f.kind === "textarea"}
              onChangeText={(v) => set(f.key, v)}
              placeholder={f.kind === "number" ? "0" : undefined}
              textAlignVertical={f.kind === "textarea" ? "top" : undefined}
              value={values[f.key] ?? ""}
            />
          )}
          {touched && problems[f.key] ? (
            <Text className="text-sm text-error">{problems[f.key]}</Text>
          ) : null}
        </View>
      ))}
      {transition.allowsComment ? (
        <View className="gap-2">
          <Text className="text-sm font-medium">
            {t("tasks.optionalField", { name: t("tasks.workComment") })}
          </Text>
          <SheetInput
            className="h-24 rounded-md py-3"
            multiline
            onChangeText={setComment}
            textAlignVertical="top"
            value={comment}
          />
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-error">
          {error}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <Button className="flex-1" disabled={pending} onPress={onCancel} variant="secondary">
          <Text>{t("ui.cancel")}</Text>
        </Button>
        <Button className="flex-1" disabled={pending} onPress={submit}>
          {pending ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text numberOfLines={1}>{transition.name}</Text>
          )}
        </Button>
      </View>
    </BottomSheetScrollView>
  );
}

/* --------------------------------------------------------------------------------------------- Assignee */

function AssigneeSheet({ target, onDone }: { target: SheetTarget; onDone: () => void }) {
  const { t } = useTranslation();
  const { connectionId, taskKey, assignee } = target;
  const appName = useBoard(connectionId).provider?.appName;
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);
  const me = useCurrentUser(connectionId);
  const people = useAssignees(connectionId, taskKey, debounced, true);
  const assign = useAssign(connectionId);

  const pick = (person: Person | null, undo = true) => {
    onDone();
    const previous = assignee ?? null;
    assign.mutate(
      { person, taskKey },
      {
        onError: (error) =>
          toast.error(t("tasks.assignFailed", { key: taskKey }), {
            description: providerErrorText(error, t, appName),
          }),
        onSuccess: () => {
          const leaves = target.leavesListWhenReassigned && person?.id !== me.data?.id;
          toast.success(
            person
              ? t("tasks.assignedTo", { key: taskKey, name: person.name })
              : t("tasks.unassignedTask", { key: taskKey }),
            {
              action: undo
                ? { label: t("ui.undo"), onClick: () => pick(previous, false) }
                : undefined,
              description: leaves ? t("tasks.leavesList") : undefined,
            },
          );
        },
      },
    );
  };

  const showMe = me.data && me.data.id !== assignee?.id && !query.trim();
  // A person can show up on two pages if the list changes between requests; keep the first.
  const seen = new Set<string>();
  const results = (people.data?.pages.flatMap((page) => page.people) ?? []).filter(
    (p) => !(showMe && p.id === me.data?.id) && !seen.has(p.id) && !!seen.add(p.id),
  );

  const header = (
    <View className="gap-3 pb-2">
      <View className="px-2">
        <SheetTitle subtitle={taskKey} title={t("tasks.searchPeople")} />
      </View>
      <SheetInput
        accessibilityLabel={t("tasks.searchPeople")}
        autoCorrect={false}
        onChangeText={setQuery}
        placeholder={t("tasks.searchPeople")}
        value={query}
      />
      {showMe ? (
        <SheetRow icon={<Avatar name={me.data!.name} />} onPress={() => pick(me.data!)}>
          <Text>{t("tasks.assignToMe")}</Text>
        </SheetRow>
      ) : null}
      {assignee && !query.trim() ? (
        <SheetRow
          icon={<Icon as={UserMinus} className="text-muted-foreground" size={18} />}
          onPress={() => pick(null)}
        >
          <Text>{t("tasks.unassign")}</Text>
        </SheetRow>
      ) : null}
      {showMe || (assignee && !query.trim()) ? <View className="h-px bg-rule" /> : null}
    </View>
  );

  return (
    <BottomSheetFlatList
      ListEmptyComponent={
        people.isPending ? (
          <View className="gap-2 p-2">
            <Skeleton className="h-6 w-full rounded-sm" />
            <Skeleton className="h-6 w-4/5 rounded-sm" />
          </View>
        ) : people.isError ? (
          <Text className="px-2 text-sm text-error">
            {providerErrorText(people.error, t, appName)}
          </Text>
        ) : (
          <Text className="px-2 text-sm" variant="muted">
            {t("tasks.noPeople")}
          </Text>
        )
      }
      ListFooterComponent={
        people.isFetchingNextPage ? (
          <ActivityIndicator className="py-3" size="small" />
        ) : !query.trim() && people.isSuccess && !people.hasNextPage && results.length > 0 ? (
          <Text className="px-2 py-2 text-xs" variant="muted">
            {t("tasks.typeToFindMore")}
          </Text>
        ) : null
      }
      ListHeaderComponent={header}
      contentContainerClassName="px-4 pb-10"
      data={people.isPending || people.isError ? [] : results}
      keyExtractor={(p: Person) => p.id}
      keyboardShouldPersistTaps="handled"
      onEndReached={() => {
        if (people.hasNextPage && !people.isFetchingNextPage) void people.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      renderItem={({ item: p }: { item: Person }) => (
        <SheetRow
          icon={<Avatar name={p.name} />}
          onPress={() => pick(p)}
          trailing={
            p.id === assignee?.id ? <Icon as={Check} className="text-ink-2" size={16} /> : null
          }
        >
          <Text numberOfLines={1}>{p.name}</Text>
        </SheetRow>
      )}
    />
  );
}

/* ------------------------------------------------------------------------------------------- Log work */

const QUICK = ["15m", "30m", "1h", "2h", "4h", "8h"];

/** Today keeps the current time; another day starts at 09:00 local. */
function startedAt(date: Date) {
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return now;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9);
}

function LogWorkSheet({ target, onDone }: { target: SheetTarget; onDone: () => void }) {
  const { t } = useTranslation();
  const { connectionId, taskKey, logged = 0, estimate } = target;
  const appName = useBoard(connectionId).provider?.appName;
  const { log, unlog } = useLogWork(connectionId);
  const [text, setText] = useState("");
  const [date, setDate] = useState(() => new Date());
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const seconds = parseDuration(text);
  const invalid = touched && !seconds;

  const submit = () => {
    setTouched(true);
    if (!seconds) return;
    const entry = { comment: comment.trim() || undefined, seconds, started: startedAt(date) };
    // Stays open until the source answers: success closes, an error shows here so nothing typed is lost.
    log.mutate(
      { entry, taskKey },
      {
        onSuccess: (workLogId) => {
          onDone();
          toast.success(t("tasks.logged", { key: taskKey, time: duration(seconds) }), {
            action: {
              label: t("ui.undo"),
              onClick: () =>
                unlog.mutate(
                  { seconds, taskKey, workLogId },
                  {
                    onError: (error) =>
                      toast.error(t("tasks.unlogFailed"), {
                        description: providerErrorText(error, t, appName),
                      }),
                  },
                ),
            },
          });
        },
      },
    );
  };

  return (
    <BottomSheetScrollView
      contentContainerClassName="gap-4 px-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <SheetTitle subtitle={taskKey} title={t("tasks.logWork")} />

      <View className="gap-2">
        <Text className="text-sm font-medium">{t("tasks.timeSpent")}</Text>
        <SheetInput
          autoCapitalize="none"
          autoCorrect={false}
          onBlur={() => text && setTouched(true)}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="1h 30m"
          returnKeyType="done"
          value={text}
        />
        {invalid ? <Text className="text-sm text-error">{t("tasks.durationHint")}</Text> : null}
        <View className="flex-row flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <Pressable
              accessibilityRole="button"
              className={cn(
                "h-9 justify-center rounded-full px-3",
                text === q ? "bg-primary" : "bg-paper-3",
              )}
              key={q}
              onPress={() => setText(q)}
            >
              <Text className={cn("font-mono text-sm", text === q && "text-primary-foreground")}>
                {q}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium">{t("tasks.workDate")}</Text>
        {/* No future dates: work is logged for what was done. */}
        <DatePicker label={t("tasks.workDate")} max={new Date()} onChange={setDate} value={date} />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium">{t("tasks.workComment")}</Text>
        <SheetInput
          maxLength={500}
          onChangeText={setComment}
          placeholder={t("tasks.workCommentPlaceholder")}
          value={comment}
        />
      </View>

      {seconds ? (
        <Text className="text-sm" variant="muted">
          {t("tasks.afterLog", {
            estimate: estimate ? ` / ${duration(estimate)}` : "",
            total: duration(logged + seconds),
          })}
        </Text>
      ) : null}

      {log.isError ? (
        <Text accessibilityRole="alert" className="text-sm text-error">
          {t("tasks.logFailed", { key: taskKey })}: {providerErrorText(log.error, t, appName)}
        </Text>
      ) : null}

      <Button disabled={!text.trim() || log.isPending} onPress={submit}>
        {log.isPending ? <ActivityIndicator size="small" /> : <Text>{t("tasks.logIt")}</Text>}
      </Button>

      <WorkLogList connectionId={connectionId} onDeleted={onDone} taskKey={taskKey} />
    </BottomSheetScrollView>
  );
}

/** Logs already on the task, newest first; your own can be deleted (with undo). */
function WorkLogList({
  connectionId,
  taskKey,
  onDeleted,
}: {
  connectionId: string;
  taskKey: string;
  onDeleted: () => void;
}) {
  const { t, i18n } = useTranslation();
  const appName = useBoard(connectionId).provider?.appName;
  const logs = useWorkLogs(connectionId, taskKey, true);
  const { log, unlog } = useLogWork(connectionId);

  if (logs.isPending && !logs.isFetching) return null; // provider without a log list
  const deleting = unlog.isPending ? unlog.variables?.workLogId : undefined;
  const total = logs.data?.reduce((n, l) => n + l.seconds, 0) ?? 0;

  return (
    <View className="gap-2 border-t border-rule pt-4">
      <View className="flex-row items-center">
        <Text className="flex-1 text-sm font-semibold text-ink-2">{t("tasks.workLogs")}</Text>
        {logs.data?.length ? (
          <Text className="text-sm font-semibold">{duration(total)}</Text>
        ) : null}
      </View>
      {logs.isPending ? (
        <View className="gap-2">
          <Skeleton className="h-8 w-full rounded-sm" />
          <Skeleton className="h-8 w-full rounded-sm" />
        </View>
      ) : logs.isError ? (
        <Text className="text-sm text-error">{providerErrorText(logs.error, t, appName)}</Text>
      ) : logs.data.length === 0 ? (
        <Text className="text-sm" variant="muted">
          {t("tasks.noWorkLogs")}
        </Text>
      ) : (
        logs.data.map((w) => (
          <View className="min-h-11 flex-row items-center gap-2.5" key={w.id}>
            <Avatar name={w.author} />
            <View className="min-w-0 flex-1">
              <Text className="text-sm" numberOfLines={1}>
                {w.author ?? t("tasks.unknownAuthor")}
                {w.mine ? (
                  <Text className="text-sm" variant="muted">{` · ${t("tasks.you")}`}</Text>
                ) : null}
              </Text>
              <Text className="text-xs" numberOfLines={1} variant="muted">
                {new Date(w.started).toLocaleDateString(i18n.language, {
                  day: "numeric",
                  month: "short",
                })}
                {w.comment ? ` · ${w.comment}` : ""}
              </Text>
            </View>
            <Text className="text-sm text-ink-2">{duration(w.seconds)}</Text>
            {w.mine ? (
              <Pressable
                accessibilityLabel={t("tasks.deleteLog", { time: duration(w.seconds) })}
                accessibilityRole="button"
                className="size-11 items-center justify-center rounded-full active:bg-paper-3"
                disabled={unlog.isPending}
                onPress={() =>
                  unlog.mutate(
                    { seconds: w.seconds, taskKey, workLogId: w.id },
                    {
                      onError: (error) =>
                        toast.error(t("tasks.logDeleteFailed"), {
                          description: providerErrorText(error, t, appName),
                        }),
                      onSuccess: () => {
                        onDeleted();
                        toast.success(t("tasks.logDeleted", { time: duration(w.seconds) }), {
                          action: {
                            label: t("ui.undo"),
                            onClick: () =>
                              log.mutate(
                                {
                                  entry: {
                                    comment: w.comment,
                                    seconds: w.seconds,
                                    started: new Date(w.started),
                                  },
                                  taskKey,
                                },
                                {
                                  onError: (error) =>
                                    toast.error(t("tasks.logFailed", { key: taskKey }), {
                                      description: providerErrorText(error, t, appName),
                                    }),
                                },
                              ),
                          },
                        });
                      },
                    },
                  )
                }
              >
                {deleting === w.id ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Icon as={Trash2} className="text-muted-foreground" size={16} />
                )}
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}
