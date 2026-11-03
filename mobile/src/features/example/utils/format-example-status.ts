import type { ExampleItemStatus } from "@/features/example/types";

const statusLabels: Record<ExampleItemStatus, string> = {
  archived: "Archived",
  draft: "Draft",
  ready: "Ready",
};

export function formatExampleStatus(status: ExampleItemStatus) {
  return statusLabels[status];
}
