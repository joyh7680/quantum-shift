import { useEffect, useRef, useState } from "react";
import { useGame } from "../../store";
import { COMMANDS, PALETTE } from "./state";
import type { Command } from "./state";
import { editCode, resetPuzzle, startProgram } from "./gameplay";
import { DeviceGuide } from "./DeviceGuide.tsx";
import { useLabCamera } from "./cameraState";
export function PowerPanel() {
  const lab = useGame((s) => s.lab);
  const [help, setHelp] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const codeList = useRef<HTMLOListElement>(null);
  const running = lab.run === "running";
  useEffect(() => {
    if ((lab.run === "running" || lab.run === "failed") && lab.index >= 0)
      codeList.current?.children[lab.index]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
  }, [lab.index, lab.run]);
  function clearDrag() {
    setDragging(null);
    setDropSlot(null);
  }
  function insertionSlot(event: React.DragEvent<HTMLElement>, index: number) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return index + (event.clientY >= bounds.top + bounds.height / 2 ? 1 : 0);
  }
  function dragOver(event: React.DragEvent, index: number) {
    if (running) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = dragging === null ? "copy" : "move";
    setDropSlot(index);
    // Keep long programs reachable while the block is held near an edge.
    const scroll = codeList.current?.closest(".editor-scroll");
    if (scroll) {
      const bounds = scroll.getBoundingClientRect();
      if (event.clientY < bounds.top + 40) scroll.scrollTop -= 14;
      else if (event.clientY > bounds.bottom - 40) scroll.scrollTop += 14;
    }
  }
  function drop(event: React.DragEvent, index: number) {
    event.preventDefault();
    clearDrag();
    if (running) return;
    const source = event.dataTransfer.getData("text/plain");
    const code = [...lab.code];
    if (source.startsWith("code:")) {
      if (!/^code:\d+$/.test(source)) return;
      const from = Number(source.slice(5));
      if (!Number.isInteger(from) || from < 0 || from >= code.length) return;
      const [command] = code.splice(from, 1);
      if (command) code.splice(index > from ? index - 1 : index, 0, command);
    } else if (
      PALETTE.includes(source as Command) &&
      (source === "tiny" ||
        source === "normal" ||
        source === "giant" ||
        lab.chips.includes(source as "battery" | "power" | "vent"))
    )
      code.splice(index, 0, source as Command);
    else return;
    editCode(code);
  }
  function move(index: number, direction: number) {
    const code = [...lab.code];
    [code[index], code[index + direction]] = [
      code[index + direction],
      code[index],
    ];
    editCode(code);
  }
  return (
    <>
      <div className="lab-live-caption">
        <span>LIVE / 실제 3D 실행</span>
        <b>거인의 연구실</b>
        <div className="stage-coding-tags">
          <span>알고리즘</span>
          <span>순차 실행</span>
        </div>
        <div className="lab-camera-tools">
          <p>드래그로 시점 회전 · 휠로 확대/축소</p>
          <button onClick={() => useLabCamera.getState().reset()}>
            ↻ 시점 초기화
          </button>
        </div>
      </div>
      <DeviceGuide />
      <section className="escape-editor" aria-label="탈출 블록 코딩">
        <header>
          <span>ESCAPE PROGRAM / 블록 코딩</span>
          <h2>탈출 프로그램</h2>
          <div className="escape-objective">
            <strong>팬을 멈추고, 작은 환풍구로 탈출하세요.</strong>
            <p>블록으로 캐릭터의 크기와 행동 순서를 정해보세요.</p>
          </div>
        </header>
        <div className="editor-scroll">
          <div className="lab-section-label">
            <h3>블록 보관함</h3>
            <span>반복 사용 가능</span>
          </div>
          <div className="escape-palette">
            {PALETTE.map((id) => {
              const available =
                ["tiny", "normal", "giant"].includes(id) ||
                lab.chips.includes(id as "battery" | "power" | "vent");
              return (
                <button
                  key={id}
                  draggable={available && !running}
                  disabled={!available || running}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onDragEnd={clearDrag}
                  onClick={() => editCode([...lab.code, id])}
                  style={
                    {
                      "--block-color": COMMANDS[id].color,
                    } as React.CSSProperties
                  }
                >
                  <span>{COMMANDS[id].icon}</span>
                  {COMMANDS[id].label}
                  {!available && <small>미수집</small>}
                </button>
              );
            })}
          </div>
          <div className="lab-section-label">
            <h3>
              내 코드 <small>{lab.code.length} 블록</small>
            </h3>
            <button
              disabled={running || !lab.code.length}
              onClick={() => editCode([])}
            >
              초기화
            </button>
          </div>
          <p className="editor-instruction">
            클릭·드래그로 추가 · 드래그 또는 ↑↓로 순서 변경
          </p>
          <ol
            ref={codeList}
            className="escape-code"
            onDragOver={(e) => {
              if (e.target === e.currentTarget) dragOver(e, lab.code.length);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                setDropSlot(null);
            }}
            onDrop={(e) => {
              if (e.target === e.currentTarget) drop(e, lab.code.length);
            }}
          >
            {lab.code.map((id, index) => (
              <li
                key={index}
                className={[
                  index === lab.index
                    ? lab.run === "failed"
                      ? "failed"
                      : "executing"
                    : "",
                  dragging === index ? "code-dragging" : "",
                  dropSlot === index ? "drop-before" : "",
                  dropSlot === lab.code.length && index === lab.code.length - 1
                    ? "drop-after"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                draggable={!running}
                onDragStart={(e) => {
                  if (running || (e.target as HTMLElement).closest("button")) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData("text/plain", `code:${index}`);
                  e.dataTransfer.effectAllowed = "move";
                  setDragging(index);
                }}
                onDragEnd={clearDrag}
                onDragOver={(e) => {
                  e.stopPropagation();
                  dragOver(e, insertionSlot(e, index));
                }}
                onDrop={(e) => {
                  e.stopPropagation();
                  drop(e, insertionSlot(e, index));
                }}
                aria-current={index === lab.index ? "step" : undefined}
              >
                <span
                  className="code-grip"
                  aria-hidden="true"
                  title="드래그로 순서 변경"
                >
                  ⠿
                </span>
                <span className="code-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <b>
                  {COMMANDS[id].icon} {COMMANDS[id].label}
                </b>
                <button
                  aria-label={`${index + 1}번 블록 위로`}
                  disabled={running || index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  aria-label={`${index + 1}번 블록 아래로`}
                  disabled={running || index === lab.code.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  aria-label={`${index + 1}번 블록 삭제`}
                  disabled={running}
                  onClick={() =>
                    editCode(lab.code.filter((_, i) => i !== index))
                  }
                >
                  ×
                </button>
              </li>
            ))}
            <li
              className="code-drop"
              onDragOver={(e) => {
                e.stopPropagation();
                dragOver(e, lab.code.length);
              }}
              onDrop={(e) => {
                e.stopPropagation();
                drop(e, lab.code.length);
              }}
            >
              {lab.code.length
                ? "여기에 블록 추가"
                : "아직 코드가 없어요. 보관함에서 블록을 골라보세요."}
            </li>
          </ol>
          <button
            className="lab-help"
            aria-expanded={help}
            aria-controls="escape-hints"
            onClick={() => setHelp(!help)}
          >
            탈출 힌트 {help ? "−" : "+"}
          </button>
          {help && (
            <div className="observation-help" id="escape-hints">
              <p>
                행동 블록마다 필요한 조건이 있어요. 내 코드에서 크기와 장치
                상태를 확인해보세요.
              </p>
              <dl>
                <div>
                  <dt>환풍구에 들어가려면?</dt>
                  <dd>
                    <strong>팬이 멈춰 있어야</strong> 하고, 캐릭터는{" "}
                    <strong>초소형</strong>이어야 해요. 두 조건이 모두 맞을 때
                    ‘환풍구 이동’을 사용할 수 있어요.
                  </dd>
                </div>
                <div>
                  <dt>배터리가 너무 무거워요</dt>
                  <dd>
                    배터리는 <strong>거대 크기</strong>일 때만 들 수 있어요.
                    ‘배터리 연결’ 블록을 실행할 때 캐릭터의 크기를 확인하세요.
                  </dd>
                </div>
                <div>
                  <dt>전원 버튼과 팬은 어떤 관계일까요?</dt>
                  <dd>
                    <strong>배터리가 연결된 상태</strong>에서{" "}
                    <strong>일반 크기</strong>로 ‘전원 작동’을 실행하면 정비
                    모드가 켜져요. 팬이 천천히 돌다가 완전히 멈출 때까지
                    프로그램이 자동으로 기다려요.
                  </dd>
                </div>
              </dl>
              <p>
                실패하면 이유를 읽고, 필요한 조건을 준비하는 블록이 있는지
                살펴본 뒤 다시 실행해보세요.
              </p>
            </div>
          )}
        </div>
        <footer>
          <p
            className={"run-feedback " + (lab.run === "failed" ? "error" : "")}
            role={lab.run === "failed" ? "alert" : "status"}
          >
            {lab.chips.length < 3
              ? `실행하려면 명령 칩 ${3 - lab.chips.length}개가 더 필요해요.`
              : lab.feedback || "블록을 배치하고 실행 결과를 관찰해보세요."}
          </p>
          <div className="run-actions">
            <button
              className="secondary"
              disabled={!running}
              onClick={() => resetPuzzle("실행을 중단하고 장치를 복원했어요.")}
            >
              실행 중단
            </button>
            <button
              className="primary"
              disabled={running || lab.chips.length !== 3 || !lab.code.length}
              onClick={startProgram}
            >
              {lab.run === "failed" ? "재실행" : "실행"} ▶
            </button>
          </div>
          <button
            className="explore-return"
            onClick={() => resetPuzzle("", true)}
          >
            ← 탐험으로 돌아가기
          </button>
        </footer>
      </section>
    </>
  );
}
