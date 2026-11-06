import {
  Bookmark,
  Bug,
  Circle,
  Layers,
  ListTree,
  SquareCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";

// Matched on the type's name in English or Turkish; unknown or custom types get a neutral dot. Mirrors desktop/mobile.
const kinds: [RegExp, LucideIcon, string][] = [
  [/epic/i, Zap, "text-warning"],
  [/sub-?task|alt (görev|iş)/i, ListTree, "text-progress"],
  [/story|hikaye/i, Bookmark, "text-success"],
  [/bug|defect|hata/i, Bug, "text-error"],
  [/task|görev|iş/i, SquareCheck, "text-progress"],
  [/initiative|feature/i, Layers, "text-ink-2"],
];

/** A small icon for an issue type (story, bug, epic, …), like the source tool shows next to keys. */
export function TypeIcon({ type, className }: { type: string | undefined; className?: string }) {
  const [, Icon, tone] = kinds.find(([match]) => type && match.test(type)) ?? [
    null,
    Circle,
    "text-muted",
  ];
  return <Icon className={cn("size-3.5 shrink-0", tone, className)} aria-hidden />;
}
