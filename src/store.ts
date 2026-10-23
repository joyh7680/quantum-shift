import { create } from "zustand";
import { CITY_STAGES } from "./stages.ts";
import type { Scale } from "./rules.ts";
import { createLabState } from "./stages/lab/state.ts";
import type { LabState } from "./stages/lab/state.ts";
import { createCircuitState } from "./stages/circuit/state.ts";
import type { CircuitState } from "./stages/circuit/state.ts";
import type { StageId, Vec } from "./stages/shared.ts";
import {
  createLabTutorial,
  tickLabTutorial,
} from "./stages/lab/tutorialState.ts";
import type { LabTutorial } from "./stages/lab/tutorialState.ts";
export type { Vec } from "./stages/shared.ts";
export type Panel = "power" | "suit" | "pause" | null;
export type GameState = {
  screen: "start" | "game" | "clear";
  activeStage: StageId;
  lab: LabState;
  circuit: CircuitState;
  character: string;
  panel: Panel;
  size: Scale;
  pos: Vec;
  yaw: number;
  moving: boolean;
  airborne: boolean;
  prompt: string;
  respawn: number;
  toast: string;
  toastId: number;
  flash: number;
  labTutorial: LabTutorial;
  cameraCaptured: boolean;
  patch: (v: Partial<GameState>) => void;
  patchLab: (v: Partial<LabState>) => void;
  patchCircuit: (v: Partial<CircuitState>) => void;
  advanceLabTutorial: (dt: number, pos: Vec, size: Scale) => void;
  completeLab: () => void;
  completeCircuit: () => void;
  nextStage: () => void;
  notify: (v: string) => void;
  start: (id: string, stage?: StageId) => void;
  reset: () => void;
  die: (reason: string) => void;
};
const transient = () => ({
  panel: null,
  size: 1 as Scale,
  yaw: 0,
  moving: false,
  airborne: false,
  prompt: "",
  cameraCaptured: false,
});
const initial = () => ({
  ...transient(),
  screen: "start" as const,
  activeStage: 1 as StageId,
  character: "codmos_nova",
  lab: createLabState(),
  circuit: createCircuitState(),
  labTutorial: createLabTutorial(),
  pos: [0, 0, -2] as Vec,
  respawn: 0,
  toast: "",
  toastId: 0,
  flash: 0,
});
function releasePointer() {
  if (typeof document !== "undefined" && document.pointerLockElement)
    document.exitPointerLock?.();
}
export const useGame = create<GameState>((set, get) => ({
  ...initial(),
  patch: (v) => set(v),
  patchLab: (v) => set((s) => ({ lab: { ...s.lab, ...v } })),
  patchCircuit: (v) => set((s) => ({ circuit: { ...s.circuit, ...v } })),
  advanceLabTutorial: (dt, pos, size) => {
    const s = get();
    if (s.activeStage !== 1 || s.screen !== "game" || s.panel) return;
    // Normal pickup already proves a successful giant arrival. If the player
    // collected it during an earlier step, never ask them to repeat that task.
    const labTutorial =
      s.labTutorial.phase === "active" &&
      s.labTutorial.step === 3 &&
      s.lab.chips.includes("battery")
        ? { ...s.labTutorial, phase: "complete" as const, elapsed: 0 }
        : tickLabTutorial(s.labTutorial, dt, pos, size);
    if (labTutorial === s.labTutorial) return;
    // Arrival completes the first collection task in the same update as the
    // tutorial. Keep the remaining collection and program missions unchanged.
    if (labTutorial.phase === "complete" && !s.lab.chips.includes("battery")) {
      const chips: LabState["chips"] = [...s.lab.chips, "battery"];
      set({
        labTutorial,
        lab: {
          ...s.lab,
          chips,
          mission: chips.length === 3 ? 1 : s.lab.mission,
          collectedAt: Date.now(),
        },
      });
    } else set({ labTutorial });
  },
  notify: (toast) => set((s) => ({ toast, toastId: s.toastId + 1 })),
  start: (character, activeStage = 1) => {
    const s = get();
    if (!CITY_STAGES[activeStage - 1]?.available) return;
    if (activeStage === 2 && !s.lab.cleared) return;
    releasePointer();
    // Restart only the selected stage; its neighbour keeps its own progress.
    const lab = activeStage === 1 ? createLabState() : s.lab;
    const circuit = activeStage === 2 ? createCircuitState() : s.circuit;
    const progress = activeStage === 1 ? lab : circuit;
    set({
      ...transient(),
      character,
      activeStage,
      lab,
      circuit,
      screen: "game",
      labTutorial:
        activeStage === 1 && s.labTutorial.phase === "waiting"
          ? { ...s.labTutorial, phase: "active" }
          : activeStage === 1 &&
              s.labTutorial.step === 3 &&
              ["success", "complete", "handoff", "leaving"].includes(
                s.labTutorial.phase,
              )
            ? { ...s.labTutorial, phase: "done", elapsed: 0 }
            : s.labTutorial,
      pos: [...progress.checkpoint],
      respawn: s.respawn + 1,
      toast:
        activeStage === 1
          ? ""
          : "STAGE 2 · 슈트 콘솔에서 자동 축소 능력을 개발하세요.",
      toastId: s.toastId + 1,
    });
  },
  completeLab: () => {
    const s = get();
    if (
      s.activeStage !== 1 ||
      s.lab.run !== "success" ||
      s.lab.fan !== 0 ||
      s.size !== 0.25 ||
      s.pos[2] < 28 ||
      s.lab.cleared
    )
      return;
    set({
      lab: { ...s.lab, cleared: true },
      screen: "clear",
      panel: null,
      prompt: "",
    });
    releasePointer();
  },
  completeCircuit: () => {
    const s = get();
    if (
      s.activeStage !== 2 ||
      !s.circuit.equipped ||
      s.circuit.mission !== 2 ||
      s.circuit.bossHP !== 0 ||
      s.circuit.cleared
    )
      return;
    set({
      circuit: { ...s.circuit, cleared: true },
      screen: "clear",
      panel: null,
      prompt: "",
    });
    releasePointer();
  },
  nextStage: () => {
    const s = get();
    if (s.activeStage === 1 && s.screen === "clear" && s.lab.cleared)
      s.start(s.character, 2);
  },
  reset: () => {
    releasePointer();
    // Returning to the menu retains session progress; availability still gates entry.
    set({ ...transient(), screen: "start", toast: "" });
  },
  die: (reason) =>
    set((s) => ({
      ...(s.activeStage === 1
        ? {
            lab: {
              ...s.lab,
              deaths: s.lab.deaths + 1,
              battery:
                s.lab.battery === "carried"
                  ? ("floor" as const)
                  : s.lab.battery,
            },
          }
        : {
            circuit: {
              ...s.circuit,
              deaths: s.circuit.deaths + 1,
              automatic: false,
              pendingRestore: false,
              bossTime: 0,
              bossDodged: false,
            },
          }),
      respawn: s.respawn + 1,
      size: s.activeStage === 1 ? s.size : 1,
      prompt: "",
      toast: reason + " · 체크포인트에서 재시작합니다.",
      toastId: s.toastId + 1,
      flash: s.flash + 1,
    })),
}));
declare global {
  interface Window {
    __quantumGame?: typeof useGame;
  }
}
if (import.meta.env?.DEV && typeof window !== "undefined")
  window.__quantumGame = useGame;
