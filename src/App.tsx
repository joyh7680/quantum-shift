import { Component, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { MainMenu } from "./MainMenu";
import { ClearScreen } from "./ClearScreen";
import "./menu.css";
import { World } from "./World";
import { Player } from "./Player";
import { useGame } from "./store";
import { SIZE_NAMES } from "./rules";
import { LAB_MISSIONS, LAB_ZONES } from "./stages/lab/state";
import { CIRCUIT_MISSIONS, CIRCUIT_ZONES } from "./stages/circuit/state";
import { CITY_STAGES } from "./stages";
import { PausePanel } from "./Panels";
import { PowerPanel } from "./stages/lab/PowerPanel";
import { LabCamera } from "./stages/lab/LabCamera";
import { SuitPanel } from "./stages/circuit/SuitPanel";
import {
  CommandInventory,
  CommandAcquisition,
  commandBlockStyle,
} from "./stages/lab/CommandInventory";
import { labObjectiveStep } from "./stages/lab/objective";
import "./stages/lab/lab.css";
class AssetBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div className="fatal">
          <b>3D 리소스를 불러오지 못했습니다.</b>
          <p>{this.state.error.message}</p>
          <p>
            개발 서버와 public/codmos-glb-assets-2026-10-15 폴더를 확인해
            주세요. 캐릭터를 다른 모델로 대체하지 않았습니다.
          </p>
          <button onClick={() => location.reload()}>다시 로드</button>
        </div>
      );
    return this.props.children;
  }
}
function Logo() {
  return (
    <div className="brand">
      <svg viewBox="0 0 36 36" width="35" height="35">
        <path
          d="M18 3 32 11v15l-14 8L4 26V11Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m4 11 14 8 14-8M18 19v15M11 7l14 8v8l-7 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <div>
        QUANTUM CITY<small>A SMALL CHANGE. A BIG ESCAPE.</small>
      </div>
    </div>
  );
}
function Loading() {
  const { progress, active } = useProgress();
  return active ? (
    <div className="resource-loading">
      3D 리소스 로딩 {progress.toFixed(0)}%
    </div>
  ) : null;
}
function CaptureHint() {
  const captured = useGame((s) => s.cameraCaptured);
  const panel = useGame((s) => s.panel);
  const activeStage = useGame((s) => s.activeStage);
  const { active: loading } = useProgress();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    if (captured || panel || loading) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [captured, panel, loading, activeStage]);

  return visible && !captured && !panel && !loading ? (
    <div className="capture-hint" role="status">
      화면 클릭으로 둘러보기 시작 · 다시 클릭하면 해제
    </div>
  ) : null;
}
function HUD() {
  const lab = useGame((s) => s.lab);
  const activeStage = useGame((s) => s.activeStage),
    progress = useGame((s) => (s.activeStage === 1 ? s.lab : s.circuit)),
    size = useGame((s) => s.size),
    ability = useGame((s) => s.circuit.ability),
    equipped = useGame((s) => s.circuit.equipped),
    automatic = useGame((s) => s.circuit.automatic),
    pending = useGame((s) => s.circuit.pendingRestore),
    prompt = useGame((s) => s.prompt),
    hp = useGame((s) => s.circuit.bossHP),
    phase = useGame((s) => s.circuit.bossPhase),
    deaths = progress.deaths;
  const stage = progress.mission;
  const objectiveStep = activeStage === 1 ? labObjectiveStep(lab) : stage;
  const missions = activeStage === 1 ? LAB_MISSIONS : CIRCUIT_MISSIONS;
  const zones = activeStage === 1 ? LAB_ZONES : CIRCUIT_ZONES;
  const brief = CITY_STAGES[activeStage - 1];
  return (
    <div className="hud">
      <header className="game-top">
        <Logo />
        {activeStage !== 1 && (
          <button
            onClick={() => {
              useGame.getState().patch({ panel: "pause" });
              document.exitPointerLock?.();
            }}
            className="pause-button"
            aria-label="일시정지"
            aria-haspopup="dialog"
          >
            <svg
              className="pause-button-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="5" y="4" width="5" height="16" rx="1" />
              <rect x="14" y="4" width="5" height="16" rx="1" />
            </svg>
          </button>
        )}
      </header>
      <div className={activeStage === 1 ? "lab-sidebar" : undefined}>
        <aside className="mission-card">
          <div className="mission-label">
            <span className="mission-location">
              <span className="green-dot" aria-hidden="true" />
              {brief.name}
            </span>
            <span>
              {activeStage === 1 ? "STEP " : ""}
              {String(objectiveStep + 1).padStart(2, "0")} /{" "}
              {String(missions.length).padStart(2, "0")}
            </span>
          </div>
          <div
            key={objectiveStep}
            className={activeStage === 1 ? "lab-objective-copy" : undefined}
            aria-live="polite"
            aria-atomic="true"
          >
            <h2>
              STAGE {String(activeStage).padStart(2, "0")}.{" "}
              {missions[objectiveStep][0]}
            </h2>
            <p>{missions[objectiveStep][1]}</p>
          </div>
          <div className="mission-track">
            {missions.map((_, i) => (
              <span
                key={i}
                className={
                  i < objectiveStep
                    ? "done"
                    : i === objectiveStep
                      ? "active"
                      : ""
                }
                aria-label={
                  `${i + 1}단계 ` +
                  (i < objectiveStep
                    ? "완료"
                    : i === objectiveStep
                      ? "진행 중"
                      : "대기")
                }
              />
            ))}
          </div>
          <span className="checkpoint">
            ↻ 체크포인트 자동 저장 · 재시작 {deaths}회
          </span>
        </aside>
        {activeStage === 1 && <CommandInventory />}
      </div>
      <div className="zone-index">
        <b>{activeStage === 1 ? "LAB — 001" : "CIRCUIT — 002"}</b>
        <span>{zones[stage]}</span>
      </div>
      {activeStage === 2 && stage === 2 && hp > 0 && (
        <div className="boss-hud">
          <span>SENTINEL / 경비 로봇</span>
          <div>
            {[0, 1, 2].map((i) => (
              <b key={i} className={i < hp ? "" : "empty"} />
            ))}
          </div>
          <strong>
            {phase === "charge"
              ? "레이저 충전 중"
              : phase === "fire"
                ? "자동 축소로 회피!"
                : phase === "weak"
                  ? "약점 노출 · 3 → E"
                  : "보호막 활성"}
          </strong>
        </div>
      )}
      <div className="reticle">+</div>
      <CaptureHint />
      {prompt && <div className="interaction-prompt">{prompt}</div>}
      <div className="game-controls">
        <span>
          <kbd>WASD</kbd> 이동
        </span>
        <span>
          <kbd>SPACE</kbd> 점프
        </span>
        <span>
          <kbd>E</kbd> 상호작용
        </span>
        <span>
          <kbd>ESC</kbd> 일시정지
        </span>
      </div>
      <div className="size-control">
        <div className="size-label">
          QUANTUM SCALE{" "}
          <span>
            {activeStage === 2 && automatic ? "AUTO SHIFT" : "MANUAL SHIFT"}
          </span>
        </div>
        <div className="size-buttons">
          {([0.25, 1, 2.5] as const).map((scale, i) => (
            <div key={scale} className={size === scale ? "active" : ""}>
              <kbd>{i + 1}</kbd>
              <span className="scale-glyph" style={{ fontSize: 12 + i * 5 }}>
                ♙
              </span>
              <div>
                <strong>
                  {scale.toFixed(scale === 0.25 ? 2 : 1)}
                  <small>×</small>
                </strong>
                <span>{SIZE_NAMES[scale]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {activeStage === 2 && (
        <div className={"ability-card " + (ability ? "on" : "")}>
          <div>
            <span className="ability-icon">⌘</span>
            <div>
              <small>SUIT ABILITY</small>
              <b>자동 축소</b>
            </div>
            <kbd>Q</kbd>
          </div>
          <p>
            <span className="green-dot" />
            {!equipped
              ? "미장착 · 슈트 개발 필요"
              : pending
                ? "복귀 공간 대기 중"
                : automatic
                  ? "레이저 감지 · 초소형 회피"
                  : ability
                    ? "활성 · 레이저 감지 대기"
                    : "비활성"}
          </p>
        </div>
      )}
    </div>
  );
}
function Toast() {
  const toast = useGame((s) => s.toast),
    id = useGame((s) => s.toastId),
    [show, setShow] = useState(false);
  const activeStage = useGame((s) => s.activeStage);
  const chips = useGame((s) => s.lab.chips);
  const acquired =
    activeStage === 1 && toast.startsWith("명령 블록 획득!")
      ? chips[chips.length - 1]
      : undefined;
  const complete = !!acquired && chips.length === 3;
  const duration = acquired ? (complete ? 3000 : 2700) : 4500;
  useEffect(() => {
    setShow(true);
    const t = setTimeout(() => setShow(false), duration);
    return () => clearTimeout(t);
  }, [id, duration]);
  const message = show ? toast : "";
  return message ? (
    <div
      key={id}
      className={
        "toast" +
        (acquired ? " command-acquisition" : "") +
        (complete ? " collection-complete" : "")
      }
      style={acquired ? commandBlockStyle(acquired) : undefined}
      role="status"
      aria-atomic="true"
    >
      {acquired ? (
        <CommandAcquisition id={acquired} count={chips.length} />
      ) : (
        <>
          <span aria-hidden="true">✦</span>
          {message}
        </>
      )}
    </div>
  ) : null;
}
function ShiftFX() {
  const id = useGame((s) => s.flash);
  return id > 0 ? <div key={id} className="shift-fx" /> : null;
}
export default function App() {
  const screen = useGame((s) => s.screen),
    panel = useGame((s) => s.panel),
    activeStage = useGame((s) => s.activeStage);
  return (
    <AssetBoundary>
      <div
        className={
          "app " +
          (activeStage === 1 && screen !== "start" ? "lab-game " : "") +
          (activeStage === 1 && panel === "power" ? "coding-open" : "")
        }
      >
        <Loading />
        {screen !== "start" && (
          <div className="game-canvas">
            <Canvas
              shadows
              dpr={[1, 1.5]}
              camera={{
                position: [15, 18, -20],
                near: 0.05,
                far: 150,
                fov: 52,
              }}
              gl={{ antialias: true }}
              onCreated={({ gl }) => {
                gl.toneMapping = ACESFilmicToneMapping;
                gl.outputColorSpace = SRGBColorSpace;
                gl.toneMappingExposure = 1.12;
              }}
            >
              <Suspense fallback={null}>
                <Physics
                  key={activeStage}
                  paused={
                    screen !== "game" ||
                    (panel !== null &&
                      !(activeStage === 1 && panel === "power"))
                  }
                  timeStep={1 / 60}
                  gravity={[0, -18, 0]}
                >
                  <World />
                  <Player />
                </Physics>
                {screen === "game" &&
                  activeStage === 1 &&
                  panel === "power" && <LabCamera />}
              </Suspense>
            </Canvas>
          </div>
        )}
        {screen === "start" ? (
          <MainMenu />
        ) : screen === "clear" ? (
          <ClearScreen />
        ) : (
          <>
            <HUD />
            <Toast />
            <ShiftFX />
            {activeStage === 1 && panel === "power" && <PowerPanel />}
            {activeStage === 2 && panel === "suit" && <SuitPanel />}
            {panel === "pause" && <PausePanel />}
          </>
        )}
      </div>
    </AssetBoundary>
  );
}
