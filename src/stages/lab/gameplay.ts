import { useGame } from "../../store.ts";
import { near } from "../shared.ts";
import type { StageFrame, Vec } from "../shared.ts";
import { CHIPS, COMMANDS, PROGRAM_START, puzzleReset } from "./state.ts";
import type { Chip, Command, LabState } from "./state.ts";
import type { Scale } from "../../rules.ts";

export function resetPuzzle(message = "", leave = false) {
  const s = useGame.getState();
  s.patchLab({
    ...puzzleReset(),
    run: "idle",
    feedback: message,
    checkpoint: [...PROGRAM_START],
  });
  s.patch({
    panel: leave ? null : "power",
    size: 1,
    pos: [...PROGRAM_START],
    respawn: s.respawn + 1,
    moving: false,
    airborne: false,
    prompt: "",
  });
}
export function startProgram() {
  const s = useGame.getState();
  if (s.lab.run === "running" || s.lab.chips.length !== 3 || !s.lab.code.length)
    return;
  resetPuzzle();
  useGame.getState().patchLab({
    run: "running",
    index: 0,
    mission: 2,
    feedback: "프로그램 실행 중",
  });
}
export function editCode(code: Command[]) {
  if (useGame.getState().lab.run !== "running")
    useGame.getState().patchLab({ code });
}
export function commandFailure(
  command: Command,
  size: Scale,
  lab: Pick<LabState, "battery" | "power" | "fan">,
) {
  if (command === "battery" && size !== 2.5) return "배터리가 너무 무거워요.";
  if (command === "power") {
    if (lab.battery !== "installed") return "배터리가 연결되지 않았어요.";
    if (size === 2.5) return "손이 너무 커서 정밀 조작대를 누를 수 없어요.";
    if (size === 0.25) return "너무 작아서 조작대에 손이 닿지 않아요.";
  }
  if (command === "vent") {
    if (!lab.power || lab.fan > 0)
      return "팬이 돌아가고 있어 통과할 수 없어요.";
    if (size !== 0.25) return "입구가 좁아 현재 크기로는 들어갈 수 없어요.";
  }
  return "";
}
export function electricPhase(time: number, lane = 0) {
  const phase = (time + lane * 0.6) % 5.5;
  return phase < 2.6 ? "safe" : phase < 3.4 ? "warning" : "live";
}
function chipSound() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      1320,
      context.currentTime + 0.16,
    );
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.23);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.25);
    oscillator.onended = () => void context.close();
  } catch {
    /* Audio may be unavailable until a browser gesture. */
  }
}
export function interactLab() {
  const s = useGame.getState();
  if (s.activeStage !== 1 || s.panel) return;
  if (near(s.pos, 0, 10, 3)) {
    resetPuzzle();
    document.exitPointerLock?.();
  } else if (near(s.pos, -4, 18))
    s.notify(
      "고밀도 배터리 · 매우 무거움. 탈출 콘솔의 프로그램으로 운반하는 장치입니다.",
    );
  else if (near(s.pos, 5, 24))
    s.notify(
      "정밀 조작대 · 정비 전원 OFF. 배터리 소켓과 팬에 연결되어 있습니다.",
    );
  else if (near(s.pos, 0, 26))
    s.notify("회전 중인 정비 팬. 탈출 프로그램으로만 진입할 수 있습니다.");
}
export function labPrompt(pos: Vec) {
  const s = useGame.getState();
  if (near(pos, 0, 10, 3)) return "E  탈출 콘솔 · 블록 코딩";
  const chip = CHIPS.find(
    (c) => !s.lab.chips.includes(c.id) && near(pos, c.pos[0], c.pos[2], 3),
  );
  if (chip)
    return `${COMMANDS[chip.id].icon} ${COMMANDS[chip.id].label} 칩 · ${chip.hint}`;
  if (near(pos, -4, 18) || near(pos, 5, 24) || near(pos, 0, 26))
    return "E  장치 관찰 · 프로그램 전용";
  return "";
}
export function updateLab({ pos, size, dt, die }: StageFrame) {
  const s = useGame.getState();
  if (s.activeStage !== 1) return;
  s.patchLab({ time: s.lab.time + dt });
  let checkpoint: Vec | undefined;
  if (pos[0] < -5 && pos[2] < 11) checkpoint = [-8, 0, -4];
  else if (pos[0] > 5 && pos[2] < 10) checkpoint = [8, 0, -3];
  else if (pos[0] < -5 && pos[2] >= 11) checkpoint = [-8, 0, 13];
  if (checkpoint && checkpoint.some((n, i) => n !== s.lab.checkpoint[i]))
    s.patchLab({ checkpoint });
  if (pos[0] > 6 && pos[0] < 10 && pos[1] < 0.28) {
    for (let i = 0; i < 3; i++)
      if (
        Math.abs(pos[2] - (i * 2 + 0.5)) < 0.63 &&
        electricPhase(s.lab.time, i) === "live"
      ) {
        die("비상 전기 바닥에 닿았어요");
        return false;
      }
  }
  if (
    pos[0] < -5.8 &&
    pos[0] > -10.3 &&
    pos[2] > 0 &&
    pos[2] < 8.8 &&
    pos[1] < -1
  ) {
    die("발판 아래로 떨어졌어요");
    return false;
  }
  for (const chip of CHIPS) {
    if (
      s.lab.chips.includes(chip.id) ||
      (chip.id === "battery" && size !== 2.5) ||
      (chip.id === "vent" && size !== 0.25)
    )
      continue;
    // A giant's body reaches the battery on the book even when its centre
    // is above the item. Measure reach along its height, not just its centre.
    const verticalDistance =
      chip.id === "battery"
        ? Math.max(pos[1] - chip.pos[1], chip.pos[1] - (pos[1] + 1.5 * size), 0)
        : Math.abs(pos[1] + 0.75 * size - chip.pos[1]);
    if (
      Math.hypot(pos[0] - chip.pos[0], pos[2] - chip.pos[2]) < 0.85 &&
      verticalDistance < (chip.id === "battery" ? 0.55 : 0.85)
    ) {
      const chips = [...useGame.getState().lab.chips, chip.id] as Chip[];
      s.patchLab({
        chips,
        mission: chips.length === 3 ? 1 : 0,
        collectedAt: Date.now(),
      });
      s.notify(
        `명령 블록 획득! ${COMMANDS[chip.id].label} (${chips.length}/3)`,
      );
      chipSound();
    }
  }
}

type ProgramFrame = StageFrame & { moveTo: (target: Vec) => boolean };
// Waypoints stay in the central aisle, clear even at 2.5x.
const batteryRoute: Vec[] = [
  [0, 0, 15],
  [-4, 0, 15],
  [-4, 0, 16],
  [0, 0, 16],
  [3, 0, 16],
  [3, 0, 18],
];
const powerRoute: Vec[] = [
  [3, 0, 18],
  [3, 0, 21],
  [5, 0, 22],
];
const ventRoute: Vec[] = [
  [3, 0, 22],
  [0, 0, 22],
  [0, 0, 26],
  [0, 0, 29],
];
export function tickProgram(frame: ProgramFrame) {
  const s = useGame.getState(),
    lab = s.lab;
  if (lab.run !== "running") return;
  const fail = (feedback: string) => {
    s.patchLab({ run: "failed", feedback });
    s.patch({ moving: false });
  };
  const command = lab.code[lab.index];
  if (!command) {
    fail("명령이 끝났지만 출구에 도착하지 못했어요.");
    return;
  }
  if (lab.step === 0 && lab.elapsed === 0) {
    const error = commandFailure(command, frame.size, lab);
    if (error) {
      fail(error);
      return;
    }
  }
  const next = () =>
    s.patchLab({
      index: lab.index + 1,
      step: 0,
      elapsed: 0,
      feedback: "프로그램 실행 중",
    });
  if (command === "tiny" || command === "normal" || command === "giant") {
    const scale = { tiny: 0.25, normal: 1, giant: 2.5 }[command] as Scale;
    if (lab.elapsed === 0 && !frame.changeSize(scale)) {
      fail("확대할 공간이 부족해요.");
      return;
    }
    s.patch({ moving: false });
    if (lab.elapsed > 0.8) next();
    else s.patchLab({ elapsed: lab.elapsed + frame.dt });
    return;
  }
  if (command === "battery" && lab.battery === "installed" && lab.step === 0) {
    next();
    return;
  }
  if (command === "power" && lab.power && lab.fan === 0) {
    next();
    return;
  }
  const route =
    command === "battery"
      ? batteryRoute
      : command === "power"
        ? powerRoute
        : ventRoute;
  if (lab.step < route.length) {
    s.patchLab({ elapsed: lab.elapsed + frame.dt });
    if (lab.elapsed > 18) {
      fail("안전 경로가 막혀 이동할 수 없어요.");
      return;
    }
    if (frame.moveTo(route[lab.step])) {
      if (command === "battery" && lab.step === 2)
        s.patchLab({ battery: "carried" });
      s.patchLab({ step: lab.step + 1, elapsed: 0 });
    }
    return;
  }
  s.patch({ moving: false });
  if (command === "battery") {
    if (lab.elapsed > 0.8) {
      s.patchLab({ battery: "installed" });
      next();
    } else
      s.patchLab({
        elapsed: lab.elapsed + frame.dt,
        feedback: "배터리를 소켓에 연결하고 있어요.",
      });
  } else if (command === "power") {
    const elapsed = lab.elapsed + frame.dt;
    s.patchLab({
      elapsed,
      power: elapsed > 0.7,
      fan: Math.max(0, 1 - Math.max(0, elapsed - 0.7) / 2.5),
      feedback:
        elapsed < 0.7
          ? "정밀 조작대를 누르고 있어요."
          : "정비 모드 · 팬이 감속하고 있어요.",
    });
    if (elapsed >= 3.2) {
      s.patchLab({ fan: 0 });
      next();
    }
  } else {
    s.patchLab({ run: "success", feedback: "환풍구 탈출 성공!" });
    s.completeLab();
  }
}
