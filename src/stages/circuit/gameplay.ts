import { suitDecision } from "../../rules.ts";
import { useGame } from "../../store.ts";
import { near } from "../shared.ts";
import type { StageFrame, Vec } from "../shared.ts";
import { LASER_Z, laserPosition } from "./state.ts";

export function interactCircuit() {
  const s = useGame.getState();
  if (s.activeStage !== 2) return;
  const c = s.circuit;
  if (near(s.pos, -4, 35)) {
    if (s.size !== 1) {
      s.notify("슈트 콘솔은 일반 크기에서 조작할 수 있습니다.");
      return;
    }
    s.patch({ panel: "suit" });
    document.exitPointerLock?.();
    return;
  }
  if (c.mission === 2 && c.bossHP > 0 && near(s.pos, 0, 66, 4.7)) {
    if (c.bossPhase !== "weak" || !c.bossDodged) {
      s.notify("보호막이 활성화되어 있습니다. 레이저를 자동 축소로 피하세요.");
      return;
    }
    if (s.size !== 2.5) {
      s.notify("약점 노출! 3키로 거대화한 뒤 E로 공격하세요.");
      return;
    }
    const hp = c.bossHP - 1;
    s.patchCircuit({
      bossHP: hp,
      bossTime: 0,
      bossPhase: hp === 0 ? "defeated" : "charge",
      bossDodged: false,
    });
    s.patch({ flash: s.flash + 1 });
    s.notify(
      hp === 0
        ? "수호자 정지! 탈출문이 열렸습니다."
        : `약점 공격 성공! 남은 코어 ${hp}개`,
    );
  }
}
export function circuitPrompt(pos: Vec) {
  const { circuit: c } = useGame.getState();
  if (near(pos, -4, 35)) return "E  슈트 개발 콘솔 · 일반 크기";
  if (c.mission === 2 && c.bossHP > 0 && near(pos, 0, 66, 4.7))
    return c.bossPhase === "weak"
      ? "3 거대화 → E 약점 공격"
      : "자동 축소로 레이저를 피하면 약점 노출";
  if (c.bossHP === 0) return "열린 민트색 탈출문으로 이동하세요.";
  return "";
}
// Runs only in Stage 2. Movement, collision fitting and size changes stay in Player.
export function updateCircuit(frame: StageFrame) {
  const s = useGame.getState();
  if (s.activeStage !== 2) return;
  const c = s.circuit;
  const { pos: p, dt, runtime, changeSize, fits, die } = frame;
  const time = c.time + dt;
  let bossTime = c.bossTime,
    phase = c.bossPhase,
    bossDodged = c.bossDodged;
  if (c.mission === 2 && c.bossHP > 0) {
    bossTime += dt;
    const cycle = bossTime % 9;
    if (cycle < dt * 1.5 && bossTime > 1) bossDodged = false;
    phase =
      cycle < 2
        ? "charge"
        : cycle < 4
          ? "fire"
          : cycle < 8
            ? bossDodged
              ? "weak"
              : "shield"
            : "idle";
  }
  const lasers =
    c.equipped && p[2] > 40 && p[2] < 56
      ? LASER_Z.map((z) => laserPosition(z, time))
      : [];
  if (c.mission === 2 && phase === "fire")
    lasers.push(60 + ((bossTime % 9) - 2) * 4);
  const nearLaser =
    lasers.some((z) => Math.abs(p[2] - z) < (c.program?.range || 2.4)) &&
    Math.abs(p[0]) < (c.mission === 2 ? 11 : 3.8);
  let size = frame.size;
  if (c.equipped && c.ability && nearLaser) {
    runtime.clearTime = 0;
    if (!c.automatic && c.program) {
      runtime.previous = size;
      const next = suitDecision(c.program, true, size, runtime.previous, true);
      if (changeSize(next.size, true)) size = next.size;
      s.patchCircuit({ automatic: true, pendingRestore: false });
    }
    if (
      c.mission === 2 &&
      phase === "fire" &&
      lasers.some((z) => Math.abs(z - p[2]) < 0.6) &&
      size === 0.25
    )
      bossDodged = true;
  } else if (c.automatic) {
    runtime.clearTime += dt;
    if (runtime.clearTime > 0.3 && c.program) {
      const next = suitDecision(
        c.program,
        false,
        size,
        runtime.previous,
        fits(runtime.previous),
      );
      if (!next.waiting && changeSize(next.size, true)) {
        size = next.size;
        s.patchCircuit({ automatic: false, pendingRestore: false });
      } else if (!c.pendingRestore) {
        s.patchCircuit({ pendingRestore: true });
        s.notify("복귀 공간이 부족합니다. 안전한 곳으로 이동하면 복귀합니다.");
      }
    }
  }
  if (
    lasers.some((z) => Math.abs(p[2] - z) < 0.34 * size + 0.12) &&
    p[1] < 0.92 &&
    p[1] + 1.5 * size > 0.65 &&
    Math.abs(p[0]) < (c.mission === 2 ? 11 : 3.6)
  ) {
    die("레이저에 맞았습니다");
    return false;
  }
  let mission = c.mission;
  if (c.equipped && mission === 1 && p[2] > 56) {
    mission = 2;
    bossTime = 0;
    bossDodged = false;
    s.patchCircuit({ checkpoint: [0, 0, 58] });
    s.notify("수호자 작동! 자동 축소로 레이저를 피한 뒤 코어를 공격하세요.");
  }
  s.patchCircuit({ time, mission, bossTime, bossPhase: phase, bossDodged });
  if (c.equipped && c.bossHP === 0 && p[2] > 75.5) s.completeCircuit();
  return true;
}
