import { CHIPS } from "./state.ts";
import type { LabState } from "./state.ts";

// Presentation only: assembling the collected actions does not validate their
// order or unlock execution. The existing runtime still decides success/failure.
export function labObjectiveStep(lab: LabState): 0 | 1 | 2 {
  if (!CHIPS.every(({ id }) => lab.chips.includes(id))) return 0;
  if (
    lab.mission === 2 ||
    lab.run !== "idle" ||
    CHIPS.every(({ id }) => lab.code.includes(id))
  )
    return 2;
  return 1;
}

export const LAB_TUTORIALS = {
  enter: "WASD로 이동하고, E를 눌러 명령 블록을 수집하세요!",
  first: "명령 블록 획득! 모은 블록으로 탈출 프로그램을 만들 수 있어요.",
  collected: "모든 블록을 모았어요! 탈출 콘솔로 이동하세요.",
  console: "블록을 드래그해 순서대로 배치하고 실행해보세요!",
  failed: "명령 블록의 순서를 확인하고 다시 실행해보세요!",
} as const;
