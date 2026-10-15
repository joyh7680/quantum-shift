import { create } from "zustand";
import type { Scale, SuitProgram } from "./rules";
export type Panel = "power" | "suit" | "pause" | null;
export type Vec = [number, number, number];
type GameState = {
  screen: "start" | "game" | "clear";
  character: string;
  panel: Panel;
  stage: number;
  size: Scale;
  pos: Vec;
  yaw: number;
  moving: boolean;
  airborne: boolean;
  prompt: string;
  battery: "floor" | "carried" | "installed";
  power: boolean;
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
  time: number;
  deaths: number;
  checkpoint: Vec;
  respawn: number;
  toast: string;
  toastId: number;
  flash: number;
  startedAt: number;
  tutorial: number;
  cameraCaptured: boolean;
  patch: (v: Partial<GameState>) => void;
  notify: (v: string) => void;
  start: (id: string) => void;
  reset: () => void;
  die: (reason: string) => void;
};
const initial = {
  screen: "start" as const,
  character: "codmos_nova",
  panel: null,
  stage: 0,
  size: 1 as Scale,
  pos: [0, 0, -2] as Vec,
  yaw: 0,
  moving: false,
  airborne: false,
  prompt: "",
  battery: "floor" as const,
  power: false,
  suitRequest: "",
  program: null,
  tested: false,
  equipped: false,
  ability: false,
  automatic: false,
  pendingRestore: false,
  bossHP: 3,
  bossPhase: "idle" as const,
  bossTime: 0,
  bossDodged: false,
  time: 0,
  deaths: 0,
  checkpoint: [0, 0, -2] as Vec,
  respawn: 0,
  toast: "",
  toastId: 0,
  flash: 0,
  startedAt: 0,
  tutorial: 0,
  cameraCaptured: false,
};
export const useGame = create<GameState>((set, get) => ({
  ...initial,
  patch: (v) => set(v),
  notify: (toast) => set((s) => ({ toast, toastId: s.toastId + 1 })),
  start: (character) =>
    set({
      ...initial,
      screen: "game",
      character,
      startedAt: Date.now(),
      toast: "실험 시작! 크기를 바꾸면 새로운 길이 보입니다.",
      toastId: get().toastId + 1,
    }),
  reset: () => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    set({ ...initial, character: get().character });
  },
  die: (reason) =>
    set((s) => ({
      deaths: s.deaths + 1,
      respawn: s.respawn + 1,
      size: 1,
      automatic: false,
      pendingRestore: false,
      battery: s.battery === "carried" ? "floor" : s.battery,
      bossTime: 0,
      bossDodged: false,
      toast: reason + " · 체크포인트에서 재시작합니다.",
      toastId: s.toastId + 1,
      flash: s.flash + 1,
    })),
}));
// Read-only browser QA observes the same store used by the rendered app.
// Vite removes this development-only hook from production builds.
declare global {
  interface Window {
    __quantumGame?: typeof useGame;
  }
}
if (import.meta.env.DEV) window.__quantumGame = useGame;
