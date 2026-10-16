import type { LabState } from "./state.ts";

export const POWER_STAND: [number, number, number] = [5, 0, 22.75];
export const POWER_REACH_END = 0.45;
export const POWER_PUSH_END = 1.65;
export const POWER_RELEASE_END = 2.15;
export const POWER_FAN_STOP = POWER_PUSH_END + 2.5;

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

// One clock drives the hands, body and breaker, including the release.
export function powerPushPose(elapsed: number) {
  const reach = smooth(elapsed / POWER_REACH_END);
  const push = smooth(
    (elapsed - POWER_REACH_END) / (POWER_PUSH_END - POWER_REACH_END),
  );
  const release = smooth(
    (elapsed - POWER_PUSH_END - 0.15) /
      (POWER_RELEASE_END - POWER_PUSH_END - 0.15),
  );
  return { reach: reach * (1 - release), push };
}

export function powerActionElapsed(lab: LabState): number | undefined {
  return lab.run === "running" &&
    lab.code[lab.index] === "power" &&
    lab.step >= 3
    ? lab.elapsed
    : undefined;
}

export function breakerAngle(push: number) {
  return -0.7 + push * 1.35;
}
