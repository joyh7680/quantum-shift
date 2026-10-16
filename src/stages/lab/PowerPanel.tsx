import { useEffect, useRef, useState } from "react";
import { useGame } from "../../store";
import { COMMANDS, PALETTE } from "./state";
import type { Command } from "./state";
import { editCode, resetPuzzle, startProgram } from "./gameplay";
import { CommandBlockIcon, commandBlockStyle } from "./CommandInventory";

function CommandIcon({ id }: { id: Command }) {
  return id === "tiny" || id === "normal" || id === "giant" ? (
    <>{COMMANDS[id].icon}</>
  ) : (
    <CommandBlockIcon id={id} />
  );
}
export function PowerPanel() {
  const lab = useGame((s) => s.lab);
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
      <section className="escape-editor" aria-label="탈출 블록 코딩">
        <header>
          <span>ESCAPE PROGRAM / 블록 코딩</span>
          <h2>탈출 프로그램 만들기</h2>
          <div className="escape-objective">
            <strong>배터리를 연결하고 전원을 작동시켜 환풍기를 멈추세요!</strong>
            <p>
              수집한 명령 블록을 올바른 순서로 배치하고 실행해 연구실을 탈출하세요.
            </p>
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
                  style={commandBlockStyle(id)}
                >
                  <span>
                    <CommandIcon id={id} />
                  </span>
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
                  "command-code-block",
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
                style={commandBlockStyle(id)}
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
                  <CommandIcon id={id} /> {COMMANDS[id].label}
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
