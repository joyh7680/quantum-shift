import { Component, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { MainMenu } from "./MainMenu";
import "./menu.css";
import { World } from "./World";
import { Player } from "./Player";
import { useGame } from "./store";
import { MISSIONS, SIZE_NAMES } from "./rules";
import { PausePanel, PowerPanel, SuitPanel } from "./Panels";
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
function HUD() {
  const stage = useGame((s) => s.stage),
    size = useGame((s) => s.size),
    ability = useGame((s) => s.ability),
    equipped = useGame((s) => s.equipped),
    automatic = useGame((s) => s.automatic),
    pending = useGame((s) => s.pendingRestore),
    prompt = useGame((s) => s.prompt),
    hp = useGame((s) => s.bossHP),
    phase = useGame((s) => s.bossPhase),
    captured = useGame((s) => s.cameraCaptured),
    deaths = useGame((s) => s.deaths);
  return (
    <div className="hud">
      <header className="game-top">
        <Logo />
        <div className="game-location">
          <span className="green-dot" />
          거인의 연구실 <small>STAGE 01</small>
        </div>
        <button
          onClick={() => {
            useGame.getState().patch({ panel: "pause" });
            document.exitPointerLock?.();
          }}
          className="pause-button"
          aria-label="일시정지"
        >
          Ⅱ
        </button>
      </header>
      <aside className="mission-card">
        <div className="mission-label">
          <span>CURRENT OBJECTIVE</span>
          <span>{String(stage + 1).padStart(2, "0")} / 07</span>
        </div>
        <h2>{MISSIONS[stage][0]}</h2>
        <p>{MISSIONS[stage][1]}</p>
        <div className="mission-track">
          {MISSIONS.map((_, i) => (
            <span
              key={i}
              className={i < stage ? "done" : i === stage ? "active" : ""}
            />
          ))}
        </div>
        <span className="checkpoint">
          ↻ 체크포인트 자동 저장 · 재시작 {deaths}회
        </span>
      </aside>
      <div className="zone-index">
        <b>LAB — 001</b>
        <span>
          {
            [
              "EXPLORATION",
              "VENTILATION",
              "POWER SYSTEM",
              "SUIT DEVELOPMENT",
              "LASER ARRAY",
              "SENTINEL",
              "EXIT",
            ][stage]
          }
        </span>
      </div>
      {stage === 5 && (
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
      {!captured && (
        <div className="capture-hint">
          화면을 클릭하면 마우스로 둘러볼 수 있습니다
        </div>
      )}
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
          QUANTUM SCALE <span>{automatic ? "AUTO SHIFT" : "MANUAL SHIFT"}</span>
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
    </div>
  );
}
function Toast() {
  const toast = useGame((s) => s.toast),
    id = useGame((s) => s.toastId),
    [show, setShow] = useState(false);
  useEffect(() => {
    setShow(true);
    const t = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(t);
  }, [id]);
  return show && toast ? (
    <div className="toast" role="status">
      <span>✦</span>
      {toast}
    </div>
  ) : null;
}
function ShiftFX() {
  const id = useGame((s) => s.flash);
  return id > 0 ? <div key={id} className="shift-fx" /> : null;
}
function Clear() {
  const time = useGame((s) => s.time),
    deaths = useGame((s) => s.deaths);
  return (
    <div className="clear-screen">
      <div className="clear-orbit">✧</div>
      <span className="eyebrow mint">EXPERIMENT COMPLETE</span>
      <h1>
        작은 당신의
        <br />
        <span>거대한 성공.</span>
      </h1>
      <p>
        거인의 연구실을 탈출했습니다.
        <br />
        크기를 바꾸고, 코드를 만들고, 불가능을 통과했습니다.
      </p>
      <div className="clear-stats">
        <div>
          <strong>07 / 07</strong>
          <span>미션 완료</span>
        </div>
        <div>
          <strong>
            {Math.floor(time / 60)}:
            {String(Math.floor(time % 60)).padStart(2, "0")}
          </strong>
          <span>탐사 시간</span>
        </div>
        <div>
          <strong>{deaths}</strong>
          <span>체크포인트 재시작</span>
        </div>
      </div>
      <button className="primary" onClick={() => useGame.getState().reset()}>
        메인 메뉴로 <span>↻</span>
      </button>
      <span className="clear-foot">QUANTUM CITY / STAGE 1 CLEARED</span>
    </div>
  );
}
export default function App() {
  const screen = useGame((s) => s.screen),
    panel = useGame((s) => s.panel);
  return (
    <AssetBoundary>
      <div className="app">
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
                  paused={screen !== "game" || panel !== null}
                  timeStep={1 / 60}
                  gravity={[0, -18, 0]}
                >
                  <World />
                  <Player />
                </Physics>
              </Suspense>
            </Canvas>
          </div>
        )}
        {screen === "start" ? (
          <MainMenu />
        ) : screen === "clear" ? (
          <Clear />
        ) : (
          <>
            <HUD />
            <Toast />
            <ShiftFX />
            {panel === "power" && <PowerPanel />}
            {panel === "suit" && <SuitPanel />}
            {panel === "pause" && <PausePanel />}
          </>
        )}
      </div>
    </AssetBoundary>
  );
}
