import {
  activeFilterCount,
  emptyFilters,
  NO_SPRINT,
  type FilterGroup,
  type TaskFilters,
} from "@mytask/core";
import { BottomSheetModal, type BottomSheetModalRef } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ListFilter, X } from "lucide-react-native";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

type Option = { value: string; label: string };
type Props = {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  /** Types and sprints present in the list. */
  options: { type: string[]; sprint: string[] };
};

function useGroups(options: Props["options"], filters: TaskFilters) {
  const { t } = useTranslation();
  // Keep a selected value listed even if no task has it any more, so it can still be turned off.
  const present = (values: string[], selected: string[]) => [
    ...values,
    ...selected.filter((v) => !values.includes(v)),
  ];
  const groups: { key: FilterGroup; title: string; options: Option[] }[] = [
    {
      key: "status",
      options: [
        { label: t("filters.inProgress"), value: "in_progress" },
        { label: t("filters.todo"), value: "todo" },
      ],
      title: t("filters.status"),
    },
    {
      key: "priority",
      options: [
        { label: t("filters.high"), value: "high" },
        { label: t("filters.medium"), value: "medium" },
        { label: t("filters.low"), value: "low" },
      ],
      title: t("filters.priority"),
    },
    {
      key: "type",
      options: present(options.type, filters.type).map((v) => ({ label: v, value: v })),
      title: t("filters.type"),
    },
    {
      key: "sprint",
      options: present(options.sprint, filters.sprint).map((v) => ({
        label: v === NO_SPRINT ? t("filters.noSprint") : v,
        value: v,
      })),
      title: t("filters.sprint"),
    },
    {
      key: "time",
      options: [
        { label: t("filters.unlogged"), value: "unlogged" },
        { label: t("filters.over"), value: "over" },
        { label: t("filters.unestimated"), value: "unestimated" },
      ],
      title: t("filters.time"),
    },
  ];
  return groups.filter((g) => g.options.length > 0);
}

const toggle = (filters: TaskFilters, key: FilterGroup, value: string): TaskFilters => {
  const current = filters[key] as string[];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return { ...filters, [key]: next };
};

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      className={cn(
        "h-9 justify-center rounded-full px-3.5 active:scale-[0.97]",
        on ? "bg-primary" : "bg-paper-3",
      )}
      hitSlop={{ bottom: 4, top: 4 }}
      onPress={onPress}
    >
      <Text className={cn("text-sm font-medium", on && "text-primary-foreground")}>{label}</Text>
    </Pressable>
  );
}

/** The filter button beside search; opens a sheet of toggle chips grouped by field. */
export function FilterButton({ filters, onChange, options }: Props) {
  const { t } = useTranslation();
  const ref = useRef<BottomSheetModalRef>(null);
  const groups = useGroups(options, filters);
  const count = activeFilterCount(filters);

  return (
    <>
      <Pressable
        accessibilityLabel={count ? t("filters.buttonActive", { count }) : t("filters.button")}
        accessibilityRole="button"
        className={cn(
          "size-11 items-center justify-center rounded-full active:scale-[0.97]",
          count ? "bg-primary" : "bg-paper-3",
        )}
        onPress={() => ref.current?.present()}
      >
        <Icon
          as={ListFilter}
          className={count ? "text-primary-foreground" : "text-ink-2"}
          size={18}
        />
      </Pressable>
      <BottomSheetModal enableDynamicSizing ref={ref}>
        <BottomSheetScrollView contentContainerClassName="gap-5 px-5 pb-10">
          <View className="flex-row items-center justify-between">
            <Text className="text-[17px] font-semibold">{t("filters.title")}</Text>
            {count ? (
              <Button onPress={() => onChange(emptyFilters())} size="sm" variant="ghost">
                <Text>{t("filters.clear")}</Text>
              </Button>
            ) : null}
          </View>
          {groups.map((g) => (
            <View className="gap-2" key={g.key}>
              <Text className="text-sm font-semibold text-ink-2">{g.title}</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {g.options.map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    on={(filters[g.key] as string[]).includes(o.value)}
                    onPress={() => onChange(toggle(filters, g.key, o.value))}
                  />
                ))}
              </View>
            </View>
          ))}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}

/** The filters in use, as chips that remove themselves on tap. Renders nothing when none are on. */
export function ActiveFilters({ filters, onChange, options }: Props) {
  const { t } = useTranslation();
  const groups = useGroups(options, filters);
  const active = groups.flatMap((g) =>
    g.options
      .filter((o) => (filters[g.key] as string[]).includes(o.value))
      .map((o) => ({ group: g.key, ...o })),
  );
  if (!active.length) return null;
  return (
    <ScrollView
      contentContainerClassName="gap-1.5 px-5 pb-2"
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {active.map((a) => (
        <Pressable
          accessibilityLabel={t("filters.remove", { name: a.label })}
          accessibilityRole="button"
          className="h-8 flex-row items-center gap-1 rounded-full bg-paper-3 pl-3 pr-2"
          hitSlop={{ bottom: 6, top: 6 }}
          key={`${a.group}:${a.value}`}
          onPress={() => onChange(toggle(filters, a.group, a.value))}
        >
          <Text className="text-sm font-medium">{a.label}</Text>
          <Icon as={X} className="text-muted-foreground" size={14} />
        </Pressable>
      ))}
    </ScrollView>
  );
}
