import { create } from "zustand";
import type { Chip } from "./state";

// Inspection is UI state only; it never changes the puzzle or collected chips.
export const useDeviceGuide = create<{
  active: Chip | null;
  inspect: (device: Chip | null) => void;
}>((set) => ({ active: null, inspect: (active) => set({ active }) }));

export const DEVICE_GUIDES = [
  {
    id: "battery",
    description: "무거운 배터리를 들려면 거대 크기가 필요해요.",
  },
  {
    id: "power",
    description: "배터리를 연결한 뒤 일반 크기로 버튼을 누르세요.",
  },
  { id: "vent", description: "팬이 멈추면 초소형으로 통과할 수 있어요." },
] as const;
