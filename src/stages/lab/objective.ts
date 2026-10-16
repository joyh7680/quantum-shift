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
