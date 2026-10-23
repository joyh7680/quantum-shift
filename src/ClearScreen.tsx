import { useState } from "react";
import { MenuDialog } from "./MenuDialog";
import { useGame } from "./store";
import { CITY_STAGES } from "./stages";
import { LAB_MISSIONS } from "./stages/lab/state";
import { CIRCUIT_MISSIONS } from "./stages/circuit/state";
import "./clear.css";

export function ClearScreen() {
  const activeStage = useGame((s) => s.activeStage);
  const progress = useGame((s) => (s.activeStage === 1 ? s.lab : s.circuit));
  const count = (activeStage === 1 ? LAB_MISSIONS : CIRCUIT_MISSIONS).length;
  const stageNumber = String(activeStage).padStart(2, "0");
  const [showStageNotice, setShowStageNotice] = useState(activeStage === 1);

  return (
    <main className="clear-screen" aria-labelledby="clear-title">
      <div className="clear-grid" aria-hidden="true" />
      <div className="clear-shell">
        <header className="clear-topline">
          <span>
            QUANTUM CITY <span className="clear-topline-slash">/</span> MISSION
            REPORT
          </span>
          <span className="clear-signal">
            <i /> 연결 안정
          </span>
        </header>

        <section
          className="clear-console"
          aria-label={`스테이지 ${activeStage} 클리어 결과`}
        >
          <div className="clear-console-top">
            <span>SECTOR {stageNumber}</span>
            <span>
              탐사 기록 <b>저장 완료</b>
            </span>
          </div>

          <div className="clear-emblem" aria-hidden="true">
            <svg viewBox="0 0 160 160" fill="none">
              <circle className="clear-emblem-track" cx="80" cy="80" r="68" />
              <circle className="clear-emblem-arc" cx="80" cy="80" r="68" />
              <circle className="clear-emblem-inner" cx="80" cy="80" r="53" />
              <path
                className="clear-emblem-ticks"
                d="M80 3v10M80 147v10M3 80h10M147 80h10"
              />
              <path
                className="clear-emblem-diamond"
                d="m80 39 36 41-36 41-36-41Z"
              />
              <path className="clear-emblem-check" d="m65 80 10 10 22-23" />
              <circle className="clear-emblem-node" cx="80" cy="12" r="3" />
              <circle className="clear-emblem-node" cx="80" cy="148" r="3" />
            </svg>
          </div>

          <div className="clear-heading">
            <span className="clear-eyebrow">STAGE {activeStage} COMPLETE</span>
            <h1 id="clear-title">
              {CITY_STAGES[activeStage - 1].name}
              <span>
                클리어<span className="clear-title-dot">.</span>
              </span>
            </h1>
            <p className="clear-description">
              {activeStage === 1 ? (
                <>
                  직접 만든 블록 프로그램으로 환풍구를 탈출했습니다.
                  <br />
                  거인의 연구실 탐험을 완료했습니다. 함께해 주셔서 감사합니다!
                </>
              ) : (
                <>
                  자동 축소 슈트로 레이저를 통과하고 수호자를 정지시켰습니다.
                  <br />
                  마이크로 회로의 탐사를 완료했습니다.
                </>
              )}
            </p>
          </div>

          <dl className="clear-stats">
            <div>
              <dt>미션 완료</dt>
              <dd>
                {String(count).padStart(2, "0")}
                <span> / {String(count).padStart(2, "0")}</span>
              </dd>
              <span className="clear-stat-track" aria-hidden="true" />
            </div>
            <div>
              <dt>탐사 시간</dt>
              <dd>
                {Math.floor(progress.time / 60)}:
                {String(Math.floor(progress.time % 60)).padStart(2, "0")}
              </dd>
              <span className="clear-stat-caption">경과 시간</span>
            </div>
            <div>
              <dt>체크포인트 재시작</dt>
              <dd>
                {progress.deaths}
                <span> 회</span>
              </dd>
              <span className="clear-stat-caption">탐사 기록</span>
            </div>
          </dl>

          <div
            className={`clear-actions${activeStage === 2 ? " clear-actions-single" : ""}`}
          >
            {activeStage === 1 && (
              <button
                className="clear-action clear-action-primary"
                aria-haspopup="dialog"
                onClick={() => setShowStageNotice(true)}
              >
                다음 스테이지 안내 <span aria-hidden="true">→</span>
              </button>
            )}
            <button
              className={`clear-action ${activeStage === 1 ? "clear-action-secondary" : "clear-action-primary"}`}
              onClick={() => useGame.getState().reset()}
            >
              메인 메뉴로 <span aria-hidden="true">↻</span>
            </button>
          </div>

          <footer className="clear-console-foot">
            <span className="clear-foot-line" />
            EXPLORATION COMPLETE
            <span className="clear-foot-line" />
          </footer>
        </section>

        <footer className="clear-foot">
          <span>QC / EXPLORATION LOG</span>
          <span>STAGE {stageNumber} — CLEARED</span>
        </footer>
      </div>
      {showStageNotice && (
        <MenuDialog
          title="다음 탐험을 기다려 주세요"
          className="stage-notice-dialog"
          onClose={() => setShowStageNotice(false)}
        >
          <p className="stage-notice-message">
            스테이지 1이 재밌었다면,
            <br />
            스테이지 2도 개발해 볼게요!
          </p>
          <p className="dialog-lead">
            스테이지 2 ‘마이크로 회로’는 아직 준비 중입니다.
          </p>
          <footer className="dialog-footer">
            <button
              className="city-secondary"
              onClick={() => setShowStageNotice(false)}
            >
              클리어 기록 보기
            </button>
            <button
              className="city-launch"
              onClick={() => useGame.getState().reset()}
            >
              메인 메뉴로 <span aria-hidden="true">→</span>
            </button>
          </footer>
        </MenuDialog>
      )}
    </main>
  );
}
