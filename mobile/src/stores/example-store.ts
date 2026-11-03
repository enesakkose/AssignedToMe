import { create } from "zustand";

type ExampleDensity = "compact" | "comfortable" | "roomy";

type ExampleState = {
  density: ExampleDensity;
  isInspectorOpen: boolean;
  setDensity: (density: ExampleDensity) => void;
  setInspectorOpen: (isInspectorOpen: boolean) => void;
  toggleInspector: () => void;
};

export const useExampleStore = create<ExampleState>((set) => ({
  density: "comfortable",
  isInspectorOpen: false,
  setDensity: (density) => set({ density }),
  setInspectorOpen: (isInspectorOpen) => set({ isInspectorOpen }),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
}));

export type { ExampleDensity };
