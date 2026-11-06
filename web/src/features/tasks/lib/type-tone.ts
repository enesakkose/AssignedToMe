import { taskTypeKind } from "@mytask/core";

// One tint per issue-type kind, from the shared categorizer; unknown types stay neutral. Sub-task shares the task tint.
const tones = {
  bug: "error",
  story: "success",
  epic: "warning",
  task: "progress",
  subtask: "progress",
} as const;

export const typeTone = (type: string | undefined) => {
  const kind = taskTypeKind(type);
  return kind ? tones[kind] : "neutral";
};
