import type { Progress } from "../shared.ts";
export type LabState = Progress & {
  battery: "floor" | "carried" | "installed";
  power: boolean;
};
export const LAB_MISSIONS = [
  [
    "연구실 탐험",
    "WASD로 이동하고 Space로 점프하세요. 1·2·3으로 크기를 바꿔보세요.",
  ],
  [
    "작아져야 보이는 길",
    "1키로 초소형이 되어 앞쪽의 낮은 환풍구를 통과하세요.",
  ],
  [
    "잠든 연구실 깨우기",
    "3키로 거대화 → 배터리에서 E → 발전기에 운반 후 E. 일반 크기로 전원 콘솔을 조작하세요.",
  ],
] as const;
export const LAB_ZONES = ["EXPLORATION", "VENTILATION", "POWER SYSTEM"];
export function createLabState(): LabState {
  return {
    mission: 0,
    cleared: false,
    checkpoint: [0, 0, -2],
    time: 0,
    deaths: 0,
    battery: "floor",
    power: false,
  };
}
