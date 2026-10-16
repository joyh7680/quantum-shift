import { useGame } from "./store";
import { close } from "./stages/PanelParts";
export function PausePanel() {
  return (
    <div className="scrim">
      <section className="pause-card" role="dialog" aria-label="일시정지">
        <span className="eyebrow">EXPERIMENT PAUSED</span>
        <h2>잠깐, 숨을 고르세요.</h2>
        <p>진행 상황은 그대로 유지됩니다.</p>
        <button className="primary" onClick={close}>
          게임으로 돌아가기 →
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
      </section>
    </div>
  );
}
