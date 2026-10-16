import { useEffect, useRef } from "react";
import { useGame } from "./store";
import { close } from "./stages/PanelParts";
import { CITY_STAGES } from "./stages";
import "./pause.css";

export function PausePanel() {
  const activeStage = useGame((s) => s.activeStage);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    resumeRef.current?.focus({ preventScroll: true });
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="scrim pause-scrim">
      <section
        className="pause-card"
        role="dialog"
        aria-modal="true"
        aria-label="일시정지"
        aria-describedby="pause-description"
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            (document.activeElement === resumeRef.current
              ? menuRef
              : resumeRef
            ).current?.focus();
          }
        }}
      >
        <header className="pause-system-bar">
          <span>
            QC <span aria-hidden="true">/</span> QUANTUM CITY
          </span>
          <span className="pause-hold">
            <i /> ON HOLD
          </span>
        </header>

        <div className="pause-core" aria-hidden="true">
          <svg viewBox="0 0 120 120" fill="none">
            <circle className="pause-orbit" cx="60" cy="60" r="53" />
            <circle className="pause-orbit-inner" cx="60" cy="60" r="43" />
            <path
              className="pause-orbit-accent"
              d="M60 7a53 53 0 0 1 53 53M60 113A53 53 0 0 1 7 60"
            />
            <path
              className="pause-core-ticks"
              d="M60 0v11m60 49h-11M60 120v-11M0 60h11"
            />
            <rect
              x="46"
              y="44"
              width="9"
              height="32"
              rx="1"
              fill="currentColor"
            />
            <rect
              x="65"
              y="44"
              width="9"
              height="32"
              rx="1"
              fill="currentColor"
            />
          </svg>
        </div>

        <div className="pause-copy">
          <span className="pause-eyebrow">EXPERIMENT PAUSED</span>
          <h2>잠깐, 숨을 고르세요.</h2>
          <p id="pause-description">진행 상황은 그대로 유지됩니다.</p>
        </div>

        <div className="pause-session">
          <span className="pause-stage">
            STAGE {String(activeStage).padStart(2, "0")}
          </span>
          <span>{CITY_STAGES[activeStage - 1].name}</span>
        </div>

        <div className="pause-actions">
          <button ref={resumeRef} className="pause-resume" onClick={close}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m7 4 9 6-9 6V4Z" fill="currentColor" />
            </svg>
            게임으로 돌아가기
          </button>
          <button
            ref={menuRef}
            className="pause-menu"
            onClick={() => {
              document.exitPointerLock?.();
              useGame.getState().reset();
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="m4 9 6-5 6 5v7h-4v-5H8v5H4V9Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
            메인 메뉴로
          </button>
        </div>

        <footer className="pause-footer" aria-hidden="true">
          <span>
            QUANTUM LINK <b>STABLE</b>
          </span>
          <span className="pause-signal">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </footer>
      </section>
    </div>
  );
}
