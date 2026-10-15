import type { Scale } from "../rules.ts";
export type StageId = 1 | 2;
export type Vec = [number, number, number];
export type Progress = {
  mission: number;
  cleared: boolean;
  checkpoint: Vec;
  time: number;
  deaths: number;
};
export type StageRuntime = { previous: Scale; clearTime: number };
export type StageFrame = {
  pos: Vec;
  size: Scale;
  dt: number;
  runtime: StageRuntime;
  changeSize: (size: Scale, automatic?: boolean) => boolean;
  fits: (size: Scale) => boolean;
  die: (reason: string) => void;
};
export function near(pos: Vec, x: number, z: number, distance = 3) {
  return Math.hypot(pos[0] - x, pos[2] - z) < distance;
}
