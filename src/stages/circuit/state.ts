import type { SuitProgram } from "../../rules.ts";
import type { Progress } from "../shared.ts";
export type CircuitState = Progress & {
  suitRequest: string;
  program: SuitProgram | null;
  tested: boolean;
  equipped: boolean;
  ability: boolean;
  automatic: boolean;
  pendingRestore: boolean;
  bossHP: number;
  bossPhase: "idle" | "charge" | "fire" | "weak" | "shield" | "defeated";
  bossTime: number;
  bossDodged: boolean;
};
export const CIRCUIT_MISSIONS = [
  [
    "자동 축소 슈트 개발",
    "보라색 슈트 콘솔에서 E. 능력을 생성하고 테스트한 뒤 장착하세요.",
  ],
  ["레이저 통과", "Q로 자동 축소를 켜고 레이저 통로를 통과하세요."],
  [
    "수호자 전투",
    "레이저를 자동 축소로 피하면 약점이 열립니다. 거대화 후 가까이서 E로 3회 공격하고 열린 탈출문으로 이동하세요.",
  ],
] as const;
export const CIRCUIT_ZONES = ["SUIT DEVELOPMENT", "LASER ARRAY", "SENTINEL"];
export const LASER_Z = [44, 48, 52];
export function laserPosition(base: number, time: number) {
  return base + Math.sin(time * 1.1 + base) * 0.8;
}
export function createCircuitState(): CircuitState {
  return {
    mission: 0,
    cleared: false,
    checkpoint: [0, 0, 32],
    time: 0,
    deaths: 0,
    suitRequest: "",
    program: null,
    tested: false,
    equipped: false,
    ability: false,
    automatic: false,
    pendingRestore: false,
    bossHP: 3,
    bossPhase: "idle",
    bossTime: 0,
    bossDodged: false,
  };
}
