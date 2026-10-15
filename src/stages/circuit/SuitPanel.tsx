import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Group } from "three";
import { Character } from "../../Character";
import { useGame } from "../../store";
import { codeFor, compileRequest, testSuit } from "../../rules";
import type { SuitProgram } from "../../rules";
import { PanelHeader } from "../PanelParts";
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
  const saved = useGame((s) => s.circuit.program),
    savedInput = useGame((s) => s.circuit.suitRequest),
    alreadyTested = useGame((s) => s.circuit.tested),
    equipped = useGame((s) => s.circuit.equipped);
  const [input, setInput] = useState(savedInput);
  const [program, setProgram] = useState<SuitProgram | null>(saved),
    [error, setError] = useState(""),
    [running, setRunning] = useState(false),
    [progress, setProgress] = useState(alreadyTested ? 5 : 0),
    [tested, setTested] = useState(alreadyTested);
  const [revision, setRevision] = useState(false),
    [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    if (!running || !program) return;
    const timer = setTimeout(() => {
      if (progress >= 4) {
        const passed = testSuit(program).every(Boolean);
        setRunning(false);
        setTested(passed);
        setProgress(passed ? 5 : 0);
        useGame.getState().patchCircuit({ tested: passed });
        if (!passed)
          setError(
            "테스트에 실패했습니다. 지원되는 조건과 명령으로 수정하세요.",
          );
        return;
      }
      setProgress(progress + 1);
    }, 850);
    return () => clearTimeout(timer);
  }, [running, program, progress]);
  const invalidate = () => {
    setProgram(null);
    setTested(false);
    setProgress(0);
    setError("");
    useGame.getState().patchCircuit({ tested: false, program: null });
  };
  const generate = () => {
    if (!input.trim() || running || equipped) return;
    const result = compileRequest(input);
    invalidate();
    if (result.error) {
      setError(result.error);
      setProgram(null);
      return;
    }
    setProgram(result.program!);
    useGame.getState().patchCircuit({ program: result.program! });
    setError("");
    setRevision(false);
  };
  const equip = () => {
    if (!program || !tested || running || equipped) return;
    const s = useGame.getState();
    if (s.activeStage !== 2) return;
    s.patchCircuit({
      program,
      tested: true,
      equipped: true,
      ability: true,
      mission: 1,
      checkpoint: [0, 0, 38],
    });
    s.patch({ panel: null, flash: s.flash + 1 });
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
          number="01"
          title="생각을 능력으로."
          sub="SUIT STUDIO / AI SIMULATION"
        />
        <div className="studio-grid">
          <div className="studio-input">
            <span className="pill purple">✦ AI 시뮬레이션 · API 키 불필요</span>
            <h3>
              위험한 레이저 구역을
              <br />
              안전하게 통과하세요.
            </h3>
            <p>레이저 구역을 안전하게 통과할 슈트 기능을 만들어보세요.</p>
            <label htmlFor="ability-input">
              {revision
                ? "수정할 능력을 다시 설명하세요"
                : "어떤 능력을 만들까요?"}
            </label>
            <textarea
              id="ability-input"
              value={input}
              placeholder="명령어를 입력해보세요"
              disabled={running || equipped}
              onChange={(e) => {
                setInput(e.target.value);
                useGame
                  .getState()
                  .patchCircuit({ suitRequest: e.target.value });
                invalidate();
              }}
            />
            <button
              className="primary"
              disabled={!input.trim() || running || equipped}
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
              <button
                className="secondary"
                aria-expanded={helpOpen}
                aria-controls="suit-help"
                onClick={() => setHelpOpen(!helpOpen)}
              >
                도움말 <span aria-hidden="true">{helpOpen ? "−" : "+"}</span>
              </button>
              <div id="suit-help" className="studio-help" hidden={!helpOpen}>
                <b>지원되는 능력</b>
                <p>
                  레이저 감지 · 초소형 변환 · 이전 크기 기억 · 공간 확인 후 복귀
                </p>
                <span>입력을 허용된 슈트 명령으로만 변환합니다.</span>
              </div>
            </div>
          </div>
          <div className="studio-code">
            <div className="editor-label">
              <span>GENERATED / SUIT.LOGIC</span>
              <span className="compile-status">
                {program ? "COMPILED" : "WAITING"}
              </span>
            </div>
            <pre>
              {program
                ? codeFor(program)
                : "명령어를 입력하면 생성된 코드가 여기에 표시됩니다."}
            </pre>
            <div className="code-footer">
              <span>READ ONLY · 직접 실행하지 않음</span>
              <button
                disabled={!program || running || equipped}
                onClick={() => {
                  setRevision(true);
                  invalidate();
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
                    : program
                      ? "READY TO TEST"
                      : "WAITING FOR CODE"}
              </span>
            </div>
            <ol className="test-checks">
              {(program
                ? [
                    "레이저 감지 → 0.25× 축소",
                    "공간 부족 → 복귀 보류",
                    "안전 확인 → 이전 크기 복귀",
                  ]
                : [
                    "명령어 입력 및 코드 생성",
                    "생성한 능력 테스트",
                    "결과 확인 후 수정 또는 장착",
                  ]
              ).map((t, i) => (
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
                setError("");
                useGame.getState().patchCircuit({ tested: false });
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
              명령어 입력 → 코드 생성 → 테스트 → 수정 → 능력 장착
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
