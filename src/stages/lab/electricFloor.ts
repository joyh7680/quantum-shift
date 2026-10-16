import type { Scale } from "../../rules.ts";
import type { Vec } from "../shared.ts";

export const ELECTRIC_TILES = [0.5, 2.5, 4.5];
export const ELECTRIC_TILE_WIDTH = 3.7;
export const ELECTRIC_TILE_DEPTH = 1.2;

export function electricPhase(time: number, lane = 0) {
  const phase = (time + lane * 0.6) % 5.5;
  return phase < 2.6 ? "safe" : phase < 3.4 ? "waiting" : "live";
}

// Test the whole move and the character's footprint, including jumps. The
// discharge fills the corridor up to its walls, but leaves the workbench above safe.
export function crossesLiveElectricFloor(
  from: Vec,
  to: Vec,
  size: Scale,
  time: number,
) {
  const radius = 0.34 * size;
  return ELECTRIC_TILES.some((z, lane) => {
    const phase = electricPhase(time, lane);
    // Mint and yellow waiting tiles both allow passage. Only purple discharges.
    if (phase === "safe" || phase === "waiting") return false;
    const lower = [
      8 - ELECTRIC_TILE_WIDTH / 2 - radius,
      0.0025 - 1.5 * size,
      z - ELECTRIC_TILE_DEPTH / 2 - radius,
    ];
    const upper = [
      8 + ELECTRIC_TILE_WIDTH / 2 + radius,
      5.4,
      z + ELECTRIC_TILE_DEPTH / 2 + radius,
    ];
    let enter = 0,
      exit = 1;
    for (let axis = 0; axis < 3; axis++) {
      const delta = to[axis] - from[axis];
      if (Math.abs(delta) < 1e-9) {
        if (from[axis] < lower[axis] || from[axis] > upper[axis]) return false;
      } else {
        const a = (lower[axis] - from[axis]) / delta,
          b = (upper[axis] - from[axis]) / delta;
        enter = Math.max(enter, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
        if (enter > exit) return false;
      }
    }
    return true;
  });
}
