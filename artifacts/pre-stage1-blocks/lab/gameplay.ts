import { useGame } from "../../store.ts";
import { near } from "../shared.ts";
import type { StageFrame, Vec } from "../shared.ts";

export function interactLab() {
  const s = useGame.getState();
  if (s.activeStage !== 1) return;
  const lab = s.lab;
  if (
    lab.battery !== "installed" &&
    ((lab.battery === "floor" && near(s.pos, -5, 18)) ||
      lab.battery === "carried")
  ) {
    if (s.size !== 2.5) {
      s.notify("이 배터리는 무겁습니다. 3키로 거대화하세요.");
      return;
    }
    if (lab.battery === "floor") {
      s.patchLab({ battery: "carried" });
      s.notify("배터리를 들었습니다. 빛나는 발전기 소켓으로 이동해 E.");
    } else if (near(s.pos, 4, 21, 3.6)) {
      s.patchLab({ battery: "installed" });
      s.patch({ flash: s.flash + 1 });
      s.notify("배터리 연결 완료! 2키로 일반 크기 → 전원 콘솔에서 E.");
    } else {
      s.patchLab({ battery: "floor" });
      s.notify("배터리를 원래 위치에 내려놓았습니다.");
    }
    return;
  }
  if (near(s.pos, 4, 25) && !lab.power) {
    if (lab.battery !== "installed") {
      s.notify("먼저 배터리를 발전기에 연결하세요.");
      return;
    }
    if (s.size !== 1) {
      s.notify("콘솔은 일반 크기에서 조작할 수 있습니다. 2키를 누르세요.");
      return;
    }
    s.patch({ panel: "power" });
    document.exitPointerLock?.();
  }
}
export function labPrompt(pos: Vec) {
  const { lab } = useGame.getState();
  if (lab.battery === "carried")
    return near(pos, 4, 21, 3.6)
      ? "E  발전기에 배터리 연결"
      : "발전기로 배터리를 운반하세요 · E 내려놓기";
  if (lab.battery === "floor" && near(pos, -5, 18))
    return "E  배터리 들기 · 거대 크기";
  if (near(pos, 4, 25) && !lab.power) return "E  전원 명령 블록 · 일반 크기";
  return "";
}
export function updateLab({ pos, dt }: StageFrame) {
  const s = useGame.getState();
  if (s.activeStage !== 1) return;
  let mission = s.lab.mission;
  if (mission === 0 && (pos[2] > 2 || s.tutorial > 0)) mission = 1;
  if (mission < 2 && pos[2] > 12) {
    mission = 2;
    s.patchLab({ checkpoint: [0, 0, 14] });
    s.notify("환풍구 통과! 거대화해서 배터리를 옮기세요.");
  }
  s.patchLab({ mission, time: s.lab.time + dt });
}
