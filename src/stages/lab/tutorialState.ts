import type { Vec } from "../shared.ts";
import type { Scale } from "../../rules.ts";
import { CHIPS } from "./state.ts";

export type LabTutorial = {
  step: 1 | 2 | 3;
  phase:
    | "waiting"
    | "active"
    | "success"
    | "complete"
    | "handoff"
    | "leaving"
    | "done";
  elapsed: number;
  distance: number;
};

// Share the collectible's position so guidance and arrival detection always
// follow the battery on top of the book stairs, rather than the heavy device.
export const TUTORIAL_BATTERY_POSITION: Vec = CHIPS.find(
  (chip) => chip.id === "battery",
)!.pos;
export const TUTORIAL_SUCCESS_SECONDS = 1.5;
export const TUTORIAL_COMPLETE_SECONDS = 2;
export const TUTORIAL_HANDOFF_SECONDS = 3;
export const createLabTutorial = (): LabTutorial => ({
  step: 1,
  phase: "waiting",
  elapsed: 0,
  distance: 0,
});

export function tutorialVisible(tutorial: LabTutorial) {
  return !["waiting", "done"].includes(tutorial.phase);
}

export function tutorialMovement(
  t: LabTutorial,
  distance: number,
): LabTutorial {
  if (t.phase !== "active" || t.step !== 1 || distance <= 0) return t;
  const travelled = t.distance + distance;
  return travelled >= 0.25
    ? { ...t, phase: "success", elapsed: 0, distance: travelled }
    : { ...t, distance: travelled };
}

export function tutorialSizeChanged(t: LabTutorial): LabTutorial {
  return t.phase === "active" && t.step === 2
    ? { ...t, phase: "success", elapsed: 0 }
    : t;
}

// Called by the playable physics loop, so pause, loading and coding never
// consume tutorial time or count program-driven actions as player practice.
export function tickLabTutorial(
  t: LabTutorial,
  dt: number,
  pos: Vec,
  size: Scale = 1,
): LabTutorial {
  if (t.phase === "active") {
    if (
      t.step === 3 &&
      size === 2.5 &&
      Math.hypot(
        pos[0] - TUTORIAL_BATTERY_POSITION[0],
        pos[2] - TUTORIAL_BATTERY_POSITION[2],
      ) < 2.8 &&
      Math.abs(pos[1] - TUTORIAL_BATTERY_POSITION[1]) < 1.3
    )
      return { ...t, phase: "complete", elapsed: 0 };
    return t;
  }
  if (!["success", "complete", "handoff", "leaving"].includes(t.phase))
    return t;
  const elapsed = t.elapsed + dt;
  if (t.phase === "success" && elapsed >= TUTORIAL_SUCCESS_SECONDS)
    return t.step === 3
      ? { ...t, phase: "complete", elapsed: 0 }
      : { ...t, step: (t.step + 1) as 2 | 3, phase: "active", elapsed: 0 };
  if (t.phase === "complete" && elapsed >= TUTORIAL_COMPLETE_SECONDS)
    return { ...t, phase: "handoff", elapsed: 0 };
  if (t.phase === "handoff" && elapsed >= TUTORIAL_HANDOFF_SECONDS)
    return { ...t, phase: "leaving", elapsed: 0 };
  if (t.phase === "leaving" && elapsed >= 0.35)
    return { ...t, phase: "done", elapsed: 0 };
  return { ...t, elapsed };
}
