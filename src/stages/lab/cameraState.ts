import { create } from "zustand";

// Camera controls are independent of puzzle state and program execution.
export const useLabCamera = create<{
  revision: number;
  reset: () => void;
}>((set) => ({
  revision: 0,
  reset: () => set((state) => ({ revision: state.revision + 1 })),
}));
