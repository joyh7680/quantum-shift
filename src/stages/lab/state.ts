import type { Progress, Vec } from "../shared.ts";
export type Chip = "battery" | "power" | "vent";
export type Command = Chip | "tiny" | "normal" | "giant";
export type LabState = Progress & {
  chips: Chip[];
  code: Command[];
  battery: "floor" | "carried" | "installed";
  power: boolean;
  fan: number;
  run: "idle" | "running" | "failed" | "success";
  index: number;
  step: number;
  elapsed: number;
  feedback: string;
  collectedAt: number;
};
export const COMMANDS: Record<
  Command,
  { label: string; icon: string; color: string }
> = {
  tiny: { label: "초소형으로 변환", icon: "◌", color: "#77ddff" },
  normal: { label: "일반 크기로 변환", icon: "◉", color: "#77ddff" },
  giant: { label: "거대화", icon: "⬡", color: "#77ddff" },
  battery: { label: "배터리 연결", icon: "ϟ", color: "#ffcb80" },
  power: { label: "전원 작동", icon: "⏻", color: "#bca5ff" },
  vent: { label: "환풍구 이동", icon: "✣", color: "#70f2cd" },
};
// Inventory order has no relationship to a program's execution order.
export const PALETTE: Command[] = [
  "tiny",
  "normal",
  "giant",
  "vent",
  "battery",
  "power",
];
export const CHIPS: { id: Chip; pos: Vec; checkpoint: Vec; hint: string }[] = [
  {
    id: "battery",
    pos: [-8, 3.5, 7],
    checkpoint: [-8, 0, -4],
    hint: "책과 연필 발판 위 · 3번 거대 크기로 획득",
  },
  {
    id: "power",
    pos: [8, 0.7, 8],
    checkpoint: [8, 0, -3],
    hint: "비상 전기 바닥 건너편",
  },
  {
    id: "vent",
    pos: [-8, 0.26, 22],
    checkpoint: [-8, 0, 13],
    hint: "장비 아래 좁은 통로",
  },
];
export const PROGRAM_START: Vec = [0, 0.03, 13];
export const LAB_MISSIONS = [
  ["명령 블록 모으기", "연구실을 탐험하며 명령 블록 3개를 모아보세요."],
  [
    "탈출 프로그램 만들기",
    "탈출 콘솔에서 E를 누르고, 모은 블록을 순서대로 배치해보세요.",
  ],
  [
    "실행하고 탈출하기",
    "프로그램을 실행해 장치를 작동시키고 환풍구로 탈출하세요.",
  ],
] as const;
export const LAB_ZONES = [
  "COMMAND CHIP EXPLORATION",
  "ESCAPE CONSOLE",
  "SEQUENTIAL EXECUTION",
];
export function puzzleReset() {
  return {
    battery: "floor" as const,
    power: false,
    fan: 1,
    index: -1,
    step: 0,
    elapsed: 0,
  };
}
export function createLabState(): LabState {
  return {
    mission: 0,
    cleared: false,
    checkpoint: [0, 0, -2],
    time: 0,
    deaths: 0,
    chips: [],
    code: [],
    ...puzzleReset(),
    run: "idle",
    feedback: "",
    collectedAt: 0,
  };
}
