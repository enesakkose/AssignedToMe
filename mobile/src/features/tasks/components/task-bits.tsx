import { type PriorityLevel, type StatusCategory } from "@mytask/core";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { duration } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  Bug,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Circle,
  Clock3,
  Equal,
  Layers,
  ListTree,
  SquareCheck,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

/** Initials in a small circle (desktop's Avatar). */
export function Avatar({ name, size = 22 }: { name?: string; size?: number }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase())
    .join("");
  return (
    <View
      className="items-center justify-center rounded-full bg-paper-3"
      style={{ height: size, width: size }}
      accessibilityElementsHidden
    >
      <Text
        className="font-semibold text-ink-2"
        style={{ fontSize: size * 0.42, lineHeight: size * 0.6 }}
      >
        {initials}
      </Text>
    </View>
  );
}

// Matched on the type's name in English or Turkish; unknown or custom types get a neutral dot.
const kinds: [RegExp, LucideIcon, string][] = [
  [/epic/i, Zap, "text-warning"],
  [/sub-?task|alt (görev|iş)/i, ListTree, "text-progress"],
  [/story|hikaye/i, Bookmark, "text-success"],
  [/bug|defect|hata/i, Bug, "text-error"],
  [/task|görev|iş/i, SquareCheck, "text-progress"],
  [/initiative|feature/i, Layers, "text-ink-2"],
];

/** A small icon for an issue type, like the source tool shows next to keys. */
export function TypeIcon({ type }: { type: string | undefined }) {
  const [, as, tone] = kinds.find(([match]) => type && match.test(type)) ?? [
    null,
    Circle,
    "text-muted-foreground",
  ];
  return <Icon as={as} className={tone} size={14} />;
}

const dots = {
  done: "bg-success",
  in_progress: "bg-progress",
  todo: "bg-muted-foreground",
} as const;

/** A status as a small coloured dot (for sub-tasks and related tasks). */
export function StatusDot({ category }: { category: StatusCategory }) {
  return <View className={cn("size-2 rounded-full", dots[category])} />;
}

const priorities = {
  1: { icon: ChevronsDown, tone: "text-muted-foreground" },
  2: { icon: ChevronDown, tone: "text-muted-foreground" },
  3: { icon: Equal, tone: "text-warning" },
  4: { icon: ChevronUp, tone: "text-error" },
  5: { icon: ChevronsUp, tone: "text-error" },
} satisfies Record<PriorityLevel, unknown>;

/** Priority name with a level icon; unknown levels show the name only. */
export function Priority({ level, label }: { level?: PriorityLevel; label: string }) {
  const p = level ? priorities[level] : undefined;
  return (
    <View className="min-w-0 flex-row items-center gap-0.5">
      {p ? <Icon as={p.icon} className={p.tone} size={15} /> : null}
      <Text className="shrink text-sm text-ink-2" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Logged time against the estimate, with a small meter when an estimate exists (desktop's TimeTracking). */
export function TimeTracking({
  logged = 0,
  estimate,
  empty,
}: {
  logged?: number;
  estimate?: number;
  empty?: string;
}) {
  const { t } = useTranslation();
  if (!logged && !estimate) {
    return empty ? (
      <View className="flex-row items-center gap-1">
        <Icon as={Clock3} className="text-muted-foreground" size={13} />
        <Text className="text-sm" variant="muted">
          {empty}
        </Text>
      </View>
    ) : null;
  }
  const over = !!estimate && logged > estimate;
  const label = estimate
    ? t("tasks.timeOfEstimate", { estimate: duration(estimate), logged: duration(logged) })
    : t("tasks.timeLogged", { logged: duration(logged) });
  return (
    <View accessibilityLabel={label} className="flex-row items-center gap-1.5">
      <Icon as={Clock3} className="text-muted-foreground" size={13} />
      {estimate ? (
        <Text className={cn("text-sm", over ? "text-error" : "text-ink-2")}>
          {logged ? duration(logged) : "–"}
          <Text className="text-sm" variant="muted">
            {" "}
            / {duration(estimate)}
          </Text>
        </Text>
      ) : (
        <Text className="text-sm text-ink-2">{label}</Text>
      )}
      {estimate ? (
        <View className="h-1 w-10 overflow-hidden rounded-full bg-paper-3">
          <View
            className={cn("h-full rounded-full", over ? "bg-error" : "bg-progress")}
            style={{ width: `${Math.min(logged / estimate, 1) * 100}%` }}
          />
        </View>
      ) : null}
    </View>
  );
}
