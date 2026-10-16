import { useEffect, useRef } from "react";
import { Html, useProgress } from "@react-three/drei";
import { useGame } from "../../store";
import { DeviceMarker } from "./DeviceMarker";
import "./tutorial.css";

const STEPS = [
  {
    title: "캐릭터를 움직여 봐요!",
    help: "WASD 키를 눌러 이동해 보세요.",
    success: "짝짝짝! 캐릭터 이동 성공이에요! 👏",
    target: "movement",
    icon: "✥",
  },
  {
    title: "이번엔 몸의 크기를 바꿔볼까요?",
    help: "숫자키 1, 2, 3을 눌러보세요!",
    success: "와! 크기 변환에 성공했어요! ✨",
    target: "scale",
    icon: "⬡",
  },
  {
    title: "저기 반짝이는 배터리가 보여요!",
    help: "배터리 가까이 이동해 보세요.",
    success: "배터리를 찾았어요! 잘했어요! 🎉",
    target: "battery",
    icon: "ϟ",
  },
] as const;

function TutorialLink({ target }: { target: string }) {
  const path = useRef<SVGPathElement>(null);
  const tip = useRef<SVGCircleElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const card = document.querySelector(".lab-tutorial");
      const destination = document.querySelector(
        `[data-tutorial-target="${target}"]`,
      );
      const svg = path.current?.ownerSVGElement;
      if (card && destination && path.current && tip.current && svg) {
        const from = card.getBoundingClientRect();
        const to = destination.getBoundingClientRect();
        const x = to.left + to.width / 2;
        const y = target === "scale" ? to.top - 6 : to.bottom + 6;
        const visible =
          destination.checkVisibility() &&
          x > 0 &&
          x < innerWidth &&
          y > 0 &&
          y < innerHeight;
        svg.style.opacity = visible ? "1" : "0";
        const outside = x < from.left || x > from.right;
        const startX = outside ? (x < from.left ? from.left : from.right) : x;
        const startY = outside
          ? Math.max(from.top + 16, Math.min(from.bottom - 16, y))
          : y < from.top
            ? from.top
            : from.bottom;
        // A quiet guide wire follows the projected object as the camera moves.
        path.current.setAttribute(
          "d",
          `M${startX},${startY} Q${startX},${(startY + y) / 2} ${x},${y}`,
        );
        tip.current.setAttribute("cx", String(x));
        tip.current.setAttribute("cy", String(y));
      } else if (svg) svg.style.opacity = "0";
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return (
    <svg className={`tutorial-link tutorial-link-${target}`} aria-hidden="true">
      <path ref={path} />
      <circle ref={tip} r="2" />
    </svg>
  );
}

export function LabTutorialCard() {
  const phase = useGame((s) => s.labTutorial.phase);
  const step = useGame((s) => s.labTutorial.step);
  const panel = useGame((s) => s.panel);
  const { active: loading } = useProgress();
  if (loading || panel || phase === "waiting" || phase === "done") return null;
  const copy = STEPS[step - 1];
  const complete = phase === "complete" || phase === "leaving";
  const success = phase === "success";
  return (
    <>
      {phase === "active" && <TutorialLink target={copy.target} />}
      <section
        key={`${step}-${complete}`}
        className={`lab-tutorial ${success ? "is-success" : ""} ${complete ? "is-complete" : ""} ${phase === "leaving" ? "is-leaving" : ""}`}
        aria-label="STAGE 1 튜토리얼"
      >
        <header>
          <span className="tutorial-eyebrow">
            TUTORIAL {String(step).padStart(2, "0")}
          </span>
          <span className="tutorial-count">{step}/3</span>
          <button
            type="button"
            onClick={() => {
              const s = useGame.getState();
              s.patch({
                labTutorial: { ...s.labTutorial, phase: "done", elapsed: 0 },
              });
            }}
          >
            건너뛰기 <span aria-hidden="true">›</span>
          </button>
        </header>
        <div
          className="tutorial-body"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="tutorial-symbol" aria-hidden="true">
            {success || complete ? "✓" : copy.icon}
          </span>
          <div>
            <h2>
              {complete
                ? "🎉 튜토리얼 완료!"
                : success
                  ? copy.success
                  : copy.title}
            </h2>
            <p>
              {complete
                ? "이제 첫 번째 미션을 시작해 볼까요?"
                : success
                  ? ""
                  : copy.help}
            </p>
            {complete && (
              <div className="tutorial-mission">
                <b>무거운 배터리를 연결해 주세요!</b>
                <span>3번 키를 눌러 거대 크기로 변신하세요.</span>
              </div>
            )}
          </div>
        </div>
        {(success || complete) && (
          <div
            key={`${step}-${phase}`}
            className="tutorial-sparkles"
            aria-hidden="true"
          >
            <i>✦</i>
            <i>✧</i>
            <i>✦</i>
          </div>
        )}
        <div className="tutorial-progress" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={
                n < step || (n === step && (success || complete))
                  ? "done"
                  : n === step
                    ? "current"
                    : ""
              }
            />
          ))}
        </div>
      </section>
    </>
  );
}

// Lives inside the existing battery group; Html projects the beacon into the
// same screen coordinates used by the card's guide wire.
export function TutorialBatteryBeacon() {
  return (
    <>
      <DeviceMarker
        device="battery"
        position={[0, 0.75, 0]}
        size={[1.85, 1.8, 1.45]}
        color="#ffe087"
        period={1}
      />
      <Html
        position={[0, 2.9, 0]}
        center
        zIndexRange={[4, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="tutorial-battery-beacon"
          data-tutorial-target="battery"
          aria-hidden="true"
        >
          !
        </div>
      </Html>
    </>
  );
}
