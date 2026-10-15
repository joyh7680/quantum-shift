import { Component, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { Character, CHARACTERS } from "./Character";
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
        QUANTUM SHIFT<small>A SMALL CHANGE. A BIG ESCAPE.</small>
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
function CharacterPreview({ id }: { id: string }) {
  return (
    <Canvas
      camera={{ position: [2.8, 1.7, -4.5], fov: 32 }}
      dpr={[1, 1.5]}
      onCreated={({ camera }) => camera.lookAt(0, 0.75, 0)}
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[3, 5, -3]} intensity={2.7} />
      <directionalLight position={[-3, 2, 2]} color="#9ce4d7" intensity={2} />
      <Suspense fallback={null}>
        <group rotation={[0, Math.PI, 0]}>
          <Character id={id} preview />
        </group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <circleGeometry args={[1.25, 64]} />
          <meshStandardMaterial color="#2b4852" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.12, 64]} />
          <meshBasicMaterial color="#80e8c2" />
        </mesh>
      </Suspense>
    </Canvas>
  );
}
function Start() {
  const [id, setId] = useState("codmos_nova"),
    [all, setAll] = useState(false);
  const featured = [
    "codmos_nova",
    "codmos_jet",
    "codmos_bora",
    "codmos_poby",
    "codmos_remy",
    "codmos_teo",
    "alien",
    "armstrong",
  ];
  const asset = CHARACTERS.find((a) => a.id === id)!;
  return (
    <div className="start-screen">
      <div className="start-tint" />
      <header className="topbar">
        <Logo />
        <div className="top-label">
          <span className="green-dot" /> EXPERIMENT 001 <b>STAGE 1</b>
        </div>
      </header>
      <main className="start-content">
        <section className="intro">
          <span className="eyebrow mint">SIZE IS YOUR SUPERPOWER</span>
          <h1>
            작은 변화,
            <br />
            <span>거대한 탈출.</span>
          </h1>
          <div className="stage-title">
            <span>01</span>
            <div>
              거인의 연구실<small>THE GIANT'S LABORATORY</small>
            </div>
          </div>
          <p>
            모든 것이 거대한 연구실에 갇혔습니다.
            <br />
            크기를 바꾸고, 나만의 능력을 코딩하고,
            <br />
            당신만의 방법으로 출구를 찾아보세요.
          </p>
          <div className="intro-tags">
            <span>3D 어드벤처</span>
            <span>크기 변환 퍼즐</span>
            <span>코딩 미션</span>
          </div>
          <div className="experiment-note">
            <span>↗</span>
            <p>
              몸이 작아지면, 가능성은 커집니다.
              <small>7개의 미션 · 하나의 연구실 · 무한한 호기심</small>
            </p>
          </div>
        </section>
        <section className="character-card">
          <div className="character-header">
            <span className="eyebrow">SELECT YOUR EXPLORER</span>
            <span>01 / 47</span>
          </div>
          <div className="avatar-preview" key={id}>
            <AssetBoundary>
              <CharacterPreview id={id} />
            </AssetBoundary>
            <span className="orbit-label">CODMOS ORIGINAL / 3D</span>
            <span className="avatar-number">Q—01</span>
          </div>
          <div className="character-name">
            <div>
              <span>YOUR EXPLORER</span>
              <h2>{asset.name}</h2>
            </div>
            <span className="pill">탐사 준비 완료</span>
          </div>
          <div className="character-options">
            {CHARACTERS.filter((c) => featured.includes(c.id))
              .sort((a, b) => featured.indexOf(a.id) - featured.indexOf(b.id))
              .map((c, i) => (
                <button
                  key={c.id}
                  className={id === c.id ? "selected" : ""}
                  onClick={() => setId(c.id)}
                  aria-label={`${c.name} 선택`}
                >
                  <span className={"char-dot dot-" + i} />
                  {c.name}
                </button>
              ))}
          </div>
          <button className="all-characters" onClick={() => setAll(!all)}>
            전체 캐릭터 47종 {all ? "−" : "＋"}
          </button>
          {all && (
            <select
              aria-label="전체 캐릭터 선택"
              value={id}
              onChange={(e) => setId(e.target.value)}
            >
              {CHARACTERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="primary start-button"
            onClick={() => useGame.getState().start(id)}
          >
            연구실에 들어가기 <span>→</span>
          </button>
          <p className="asset-note">
            제공된 실제 GLB 캐릭터 · 동일한 조작과 충돌 규칙
          </p>
        </section>
      </main>
      <footer className="start-footer">
        <div>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
          <span>이동</span>
        </div>
        <div>
          <kbd>SPACE</kbd>
          <span>점프</span>
        </div>
        <div>
          <kbd>1</kbd>
          <kbd>2</kbd>
          <kbd>3</kbd>
          <span>크기 변환</span>
        </div>
        <div>
          <kbd>E</kbd>
          <span>상호작용</span>
        </div>
        <div>
          <span className="mouse-icon">↔</span>
          <span>마우스 카메라</span>
        </div>
        <span className="footer-build">QUANTUM RESEARCH / 001</span>
      </footer>
    </div>
  );
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
        다시 탐험하기 <span>↻</span>
      </button>
      <span className="clear-foot">QUANTUM SHIFT / STAGE 1 CLEARED</span>
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
        <div className="game-canvas">
          <Canvas
            shadows
            dpr={[1, 1.5]}
            camera={{ position: [15, 18, -20], near: 0.05, far: 150, fov: 52 }}
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
        {screen === "start" ? (
          <Start />
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
