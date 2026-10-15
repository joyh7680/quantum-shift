import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Group } from "three";
import { Character } from "./Character";
import { useGame } from "./store";
import {
  checkOrder,
  codeFor,
  compileRequest,
  testSuit,
  VALID_ORDER,
} from "./rules";
import type { SuitProgram } from "./rules";
function close() {
  useGame.getState().patch({ panel: null });
}
export function PowerPanel() {
  const [order, setOrder] = useState<string[]>(["", "", "", ""]),
    [message, setMessage] = useState(
      "출력 전류가 흐를 순서대로 명령 블록을 배치하세요.",
    ),
    [drag, setDrag] = useState<string | null>(null);
  const add = (item: string, index = order.indexOf("")) => {
    if (!order.includes(item) && index >= 0 && !order[index])
      setOrder(order.map((value, i) => (i === index ? item : value)));
  };
  const run = () => {
    if (!checkOrder(order)) {
      setMessage(
        "연결 실패 · 메인 전원을 먼저 켜고 A → B → C 순서로 신호를 보내세요.",
      );
      return;
    }
    useGame
      .getState()
      .patch({
        power: true,
        stage: 3,
        checkpoint: [0, 0, 32],
        flash: useGame.getState().flash + 1,
        panel: null,
      });
    useGame
      .getState()
      .notify("전력 복구 완료! 조명과 장치가 켜지고 문이 열렸습니다.");
  };
  return (
    <div className="scrim">
      <section
        className="panel power-panel"
        role="dialog"
        aria-label="전원 알고리즘"
      >
        <PanelHeader
          number="02"
          title="잠든 연구실 깨우기"
          sub="ALGORITHM / POWER SEQUENCE"
        />
        <div className="power-grid">
          <div>
            <span className="eyebrow">YOUR MISSION</span>
            <h3>
              올바른 순서가
              <br />
              에너지를 만듭니다.
            </h3>
            <p>
              배터리 연결 완료. 발전기가 안전하게 시작되도록 명령 블록 4개를
              실행 순서에 배치하세요.
            </p>
            <div className="hint">
              <span>↳</span> 메인 전원 → A → B → C
            </div>
            <p className="muted">
              클릭하거나 빈 슬롯으로 드래그하세요.
              <br />
              배치된 블록을 클릭하면 되돌릴 수 있습니다.
            </p>
          </div>
          <div className="sequence-workspace">
            <div className="editor-label">
              <span>COMMAND BLOCKS</span>
              <span>01—04</span>
            </div>
            <div className="block-palette">
              {["B", "메인 전원", "C", "A"].map((item) => (
                <button
                  key={item}
                  draggable={!order.includes(item)}
                  onDragStart={() => setDrag(item)}
                  disabled={order.includes(item)}
                  onClick={() => add(item)}
                  className={"command " + (item === "메인 전원" ? "main" : "")}
                >
                  {item === "메인 전원" ? "⏻ " : "↳ "}
                  {item}
                </button>
              ))}
            </div>
            <div className="slots">
              {VALID_ORDER.map((_, i) => (
                <div
                  key={i}
                  className={"slot " + (order[i] ? "filled" : "")}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag) add(drag, i);
                    setDrag(null);
                  }}
                >
                  <span className="slot-index">0{i + 1}</span>
                  {order[i] ? (
                    <button
                      onClick={() =>
                        setOrder(
                          order.map((value, n) => (n === i ? "" : value)),
                        )
                      }
                    >
                      {order[i]} <span>×</span>
                    </button>
                  ) : (
                    <span>명령 블록 놓기</span>
                  )}
                  {i < 3 && <b>↓</b>}
                </div>
              ))}
            </div>
            <p
              className={
                "feedback " + (message.startsWith("연결 실패") ? "error" : "")
              }
            >
              {message}
            </p>
            <div className="button-row">
              <button
                className="secondary"
                onClick={() => {
                  setOrder(["", "", "", ""]);
                  setMessage("순서를 초기화했습니다.");
                }}
              >
                초기화
              </button>
              <button
                className="primary"
                disabled={order.some((x) => !x)}
                onClick={run}
              >
                순서 실행 <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
function PanelHeader({
  number,
  title,
  sub,
}: {
  number: string;
  title: string;
  sub: string;
}) {
  return (
    <header className="panel-header">
      <div className="panel-number">{number}</div>
      <div>
        <span className="eyebrow">{sub}</span>
        <h2>{title}</h2>
      </div>
      <button className="close" aria-label="패널 닫기" onClick={close}>
        ×
      </button>
    </header>
  );
}
function TestScene({ progress }: { progress: number }) {
  const ref = useRef<Group>(null),
    beam = useRef<Group>(null);
  const character = useGame((s) => s.character);
  useFrame((_, dt) => {
    if (ref.current) {
      const size = progress >= 1 && progress < 4 ? 0.25 : 1;
      const v =
        ref.current.scale.x +
        (size - ref.current.scale.x) * Math.min(1, dt * 12);
      ref.current.scale.setScalar(v);
    }
    if (beam.current) {
      beam.current.visible = progress > 0 && progress < 3;
      beam.current.position.z = 3 - progress * 1.5;
    }
  });
  return (
    <>
      <color attach="background" args={["#1b303d"]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[2, 5, -2]} intensity={3} />
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[7, 0.2, 7]} />
        <meshStandardMaterial color="#42625e" />
      </mesh>
      <gridHelper
        args={[7, 14, "#71968b", "#4f756a"]}
        position={[0, 0.015, 0]}
      />
      <group ref={ref}>
        <Character id={character} />
      </group>
      <group ref={beam}>
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[5, 0.06, 0.08]} />
          <meshBasicMaterial color="#ff776e" />
        </mesh>
      </group>
      {progress === 3 && (
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[2, 0.15, 2]} />
          <meshStandardMaterial color="#b3a0df" transparent opacity={0.55} />
        </mesh>
      )}
    </>
  );
}
export function SuitPanel() {
  const saved = useGame((s) => s.program),
    alreadyTested = useGame((s) => s.tested),
    equipped = useGame((s) => s.equipped);
  const [input, setInput] = useState(
    "레이저가 접근하면 작아지고, 지나가면 이전 크기로 복귀해줘.",
  );
  const [program, setProgram] = useState<SuitProgram | null>(saved),
    [error, setError] = useState(""),
    [running, setRunning] = useState(false),
    [progress, setProgress] = useState(0),
    [tested, setTested] = useState(alreadyTested);
  const [revision, setRevision] = useState(false);
  useEffect(() => {
    if (!running || !program) return;
    const timer = setInterval(
      () =>
        setProgress((p) => {
          if (p >= 4) {
            const passed = testSuit(program).every(Boolean);
            setRunning(false);
            setTested(passed);
            useGame.getState().patch({ tested: passed });
            if (!passed)
              setError(
                "테스트에 실패했습니다. 지원되는 조건과 명령으로 수정하세요.",
              );
            return passed ? 5 : 0;
          }
          return p + 1;
        }),
      850,
    );
    return () => clearInterval(timer);
  }, [running, program]);
  const generate = () => {
    const result = compileRequest(input);
    setTested(false);
    setProgress(0);
    useGame.getState().patch({ tested: false, program: null });
    if (result.error) {
      setError(result.error);
      setProgram(null);
      return;
    }
    setProgram(result.program!);
    useGame.getState().patch({ program: result.program! });
    setError("");
    setRevision(false);
  };
  const equip = () => {
    if (!program || !tested) return;
    useGame
      .getState()
      .patch({
        program,
        tested: true,
        equipped: true,
        ability: true,
        stage: 4,
        panel: null,
        checkpoint: [0, 0, 38],
        flash: useGame.getState().flash + 1,
      });
    useGame
      .getState()
      .notify("자동 축소 슈트 장착! Q로 ON/OFF · 레이저 구역이 열렸습니다.");
  };
  return (
    <div className="scrim">
      <section
        className="panel suit-panel"
        role="dialog"
        aria-label="슈트 개발"
      >
        <PanelHeader
          number="03"
          title="생각을 능력으로."
          sub="SUIT STUDIO / AI SIMULATION"
        />
        <div className="studio-grid">
          <div className="studio-input">
            <span className="pill purple">✦ AI 시뮬레이션 · API 키 불필요</span>
            <h3>
              레이저보다
              <br />
              한발 먼저 작아지세요.
            </h3>
            <p>
              레이저가 접근하면 초소형으로 변하고, 지나가면 이전 크기로 돌아오는
              능력을 요청하세요.
            </p>
            <label htmlFor="ability-input">
              {revision
                ? "수정할 능력을 다시 설명하세요"
                : "어떤 능력을 만들까요?"}
            </label>
            <textarea
              id="ability-input"
              value={input}
              disabled={running || equipped}
              onChange={(e) => {
                setInput(e.target.value);
                setTested(false);
                setProgram(null);
                useGame.getState().patch({ tested: false, program: null });
              }}
            />
            <button
              className="primary"
              disabled={running || equipped}
              onClick={generate}
            >
              ✦ {revision ? "능력 수정하기" : "능력 생성하기"} <span>↗</span>
            </button>
            {error && (
              <p className="feedback error" role="alert">
                {error}
              </p>
            )}
            <div className="studio-note">
              <b>지원되는 능력</b>
              <p>
                레이저 감지 · 초소형 변환 · 이전 크기 기억 · 공간 확인 후 복귀
              </p>
              <span>입력을 허용된 슈트 명령으로만 변환합니다.</span>
            </div>
          </div>
          <div className="studio-code">
            <div className="editor-label">
              <span>GENERATED / SUIT.LOGIC</span>
              <span className="status-dot">
                {program ? "COMPILED" : "WAITING"}
              </span>
            </div>
            <pre>
              {program
                ? codeFor(program)
                : "// 능력을 설명하면 여기에\n// 허용된 명령 코드가 생성됩니다.\n\n// 1. 레이저를 감지하기\n// 2. 초소형으로 변환하기\n// 3. 안전하게 복귀하기"}
            </pre>
            <div className="code-footer">
              <span>READ ONLY · 직접 실행하지 않음</span>
              <button
                disabled={!program || running || equipped}
                onClick={() => {
                  setRevision(true);
                  setTested(false);
                  document.getElementById("ability-input")?.focus();
                }}
              >
                수정 요청 ↗
              </button>
            </div>
          </div>
          <div className="studio-test">
            <div className="editor-label">
              <span>LIVE SANDBOX</span>
              <span>본 게임 일시정지</span>
            </div>
            <div className="test-viewport">
              <Canvas
                camera={{ position: [4, 3.2, -5], fov: 42 }}
                onCreated={({ camera }) => camera.lookAt(0, 0.5, 0)}
              >
                <Suspense fallback={null}>
                  <TestScene progress={progress} />
                </Suspense>
              </Canvas>
              <span className="test-badge">
                {running
                  ? "TEST RUNNING"
                  : tested
                    ? "ALL CHECKS PASSED"
                    : "READY TO TEST"}
              </span>
            </div>
            <ol className="test-checks">
              {[
                "레이저 감지 → 0.25× 축소",
                "공간 부족 → 복귀 보류",
                "안전 확인 → 이전 크기 복귀",
              ].map((t, i) => (
                <li
                  className={progress >= [2, 4, 5][i] ? "passed" : ""}
                  key={t}
                >
                  <span>{progress >= [2, 4, 5][i] ? "✓" : "○"}</span>
                  {t}
                </li>
              ))}
            </ol>
            <button
              className="secondary"
              disabled={!program || running || equipped}
              onClick={() => {
                setProgress(0);
                setRunning(true);
                setTested(false);
              }}
            >
              ▷ {running ? "테스트 실행 중…" : "능력 테스트"}
            </button>
            <button
              className="primary"
              disabled={!tested || !program || running || equipped}
              onClick={equip}
            >
              {equipped ? "장착 완료" : "슈트에 장착"} <span>→</span>
            </button>
            <p className="muted">
              생성 → 테스트 통과 → 장착 순서로 진행합니다.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
export function PausePanel() {
  return (
    <div className="scrim">
      <section className="pause-card" role="dialog" aria-label="일시정지">
        <span className="eyebrow">EXPERIMENT PAUSED</span>
        <h2>잠깐, 숨을 고르세요.</h2>
        <p>진행 상황은 그대로 유지됩니다.</p>
        <button className="primary" onClick={close}>
          연구실로 돌아가기 →
        </button>
        <button
          className="secondary"
          onClick={() => {
            document.exitPointerLock?.();
            useGame.getState().reset();
          }}
        >
          메인 메뉴로
        </button>
        <div className="pause-controls">
          WASD 이동 · SPACE 점프 · E 상호작용
          <br />1 / 2 / 3 크기 변환 · Q 능력 ON/OFF
          <br />
          화면 클릭 후 마우스로 카메라 회전
        </div>
      </section>
    </div>
  );
}
