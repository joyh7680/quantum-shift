import { useState } from "react";
import { useGame } from "../../store";
import { checkOrder, VALID_ORDER } from "../../rules";
import { PanelHeader } from "../PanelParts";
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
    const s = useGame.getState();
    if (s.activeStage !== 1 || s.lab.battery !== "installed") return;
    s.patchLab({ power: true, mission: 2 });
    s.patch({ flash: s.flash + 1, panel: null });
    s.completeLab();
  };
  return (
    <div className="scrim">
      <section
        className="panel power-panel"
        role="dialog"
        aria-label="전원 알고리즘"
      >
        <PanelHeader
          number="03"
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
