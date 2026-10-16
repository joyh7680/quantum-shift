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
    description: "거대 크기로 배터리를 정지 장치에 연결해 전력을 공급하세요.",
  },
  {
    id: "power",
    description:
      "일반 크기로 정지 장치의 버튼을 눌러 환풍기 전원을 차단하세요.",
  },
  {
    id: "vent",
    description: "전원이 차단되어 팬이 멈추면 초소형으로 환풍구를 통과하세요.",
  },
] as const;
