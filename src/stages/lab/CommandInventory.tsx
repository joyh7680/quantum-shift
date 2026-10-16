import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useGame } from "../../store";
import { COMMANDS } from "./state";
import type { Chip, Command } from "./state";

// HUD colors are independent of the existing 3D item materials.
const BLOCK_COLORS: Record<Command, string> = {
  tiny: COMMANDS.tiny.color,
  normal: COMMANDS.normal.color,
  giant: COMMANDS.giant.color,
  battery: "#ffda75",
  power: "#ff94c7",
  vent: "#70f2cd",
};
const BLOCK_ORDER: Chip[] = ["battery", "power", "vent"];
const BLOCK_HINTS: Record<Chip, string> = {
  battery: "무거운 배터리를 옮기려면 어떤 크기가 필요할까요?",
  power: "전원 버튼은 어떤 크기에서 누르기 쉬울까요?",
  vent: "좁은 환풍구를 지나가려면 어떻게 해야 할까요?",
};
export function commandBlockStyle(id: Command): CSSProperties {
  return { "--block-color": BLOCK_COLORS[id] } as CSSProperties;
}

export function CommandBlockIcon({ id }: { id: Chip }) {
  return (
    <svg
      className="command-block-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {id === "battery" ? (
        <>
          <rect x="6" y="5" width="12" height="16" rx="2" />
          <path d="M10 5V3h4v2m-2 4-3 5h4l-1 4 4-6h-4l1-3" />
        </>
      ) : id === "power" ? (
        <>
          <path d="M12 3v9M7 5.5a8 8 0 1 0 10 0" />
        </>
      ) : (
        <>
          <rect x="2" y="2" width="20" height="20" rx="4" />
          {[0, 90, 180, 270].map((angle) => (
            <path
              key={angle}
              transform={`rotate(${angle} 12 12)`}
              d="M12 10C9 7 12 3 15 6c2 2 0 4-2 5"
              fill="currentColor"
              stroke="none"
            />
          ))}
          <circle cx="12" cy="12" r="2" />
        </>
      )}
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="command-block-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
    </svg>
  );
}

function CollectionStatusIcon({ collected }: { collected: boolean }) {
  return (
    <svg
      className="chip-status-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {collected ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2.5m0 3h.01" />
        </>
      )}
    </svg>
  );
}

function CommandHint({
  id,
  anchor,
  tooltipId,
}: {
  id: Chip;
  anchor: HTMLLIElement;
  tooltipId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    const tooltip = ref.current;
    if (!tooltip) return;
    const updatePosition = () => {
      const row = anchor.getBoundingClientRect();
      const { width, height } = tooltip.getBoundingClientRect();
      const margin = 12;
      const gap = 10;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const beside = row.right + gap + width <= viewportWidth - margin;
      const left = beside ? row.right + gap : row.left;
      const top = beside
        ? row.top + (row.height - height) / 2
        : row.top - gap - height;
      setPosition({
        left: Math.max(margin, Math.min(left, viewportWidth - width - margin)),
        top: Math.max(margin, Math.min(top, viewportHeight - height - margin)),
      });
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(anchor);
    observer.observe(tooltip);
    // The sidebar also moves when objective text or viewport dimensions change.
    const sidebar = anchor.closest(".lab-sidebar");
    if (sidebar) observer.observe(sidebar);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor]);

  // A portal keeps the hint outside HUD clipping and stacking contexts.
  return createPortal(
    <div
      ref={ref}
      id={tooltipId}
      role="tooltip"
      className="command-hint"
      style={position}
    >
      <div className="command-hint-label">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 18h6m-5 3h4M8.5 14.5a6 6 0 1 1 7 0c-1 .7-1 1.5-1 2.5h-5c0-1 0-1.8-1-2.5Z" />
        </svg>
        <strong>힌트</strong>
      </div>
      <p>{BLOCK_HINTS[id]}</p>
    </div>,
    document.body,
  );
}

export function CommandInventory() {
  const chips = useGame((s) => s.lab.chips);
  const panel = useGame((s) => s.panel);
  const [hovered, setHovered] = useState<Chip | null>(null);
  const [focused, setFocused] = useState<Chip | null>(null);
  const rows = useRef<Partial<Record<Chip, HTMLLIElement>>>({});
  const tooltipId = useId();
  const active = hovered ?? focused;

  useEffect(() => {
    setHovered(null);
    setFocused(null);
  }, [panel]);

  return (
    <aside className="chip-hud" aria-label="명령 블록 수집함">
      <span>COMMAND BLOCK INVENTORY</span>
      <b aria-live="polite" aria-atomic="true">
        명령 블록 수집함 {chips.length}/3
      </b>
      <p className="chip-hud-help">
        각 블록에 마우스를 올리면 힌트를 볼 수 있어요.
      </p>
      <ul>
        {BLOCK_ORDER.map((id) => {
          const collected = chips.includes(id);
          return (
            <li
              key={id}
              ref={(element) => {
                rows.current[id] = element ?? undefined;
              }}
              data-command={id}
              className={collected ? "found" : "locked"}
              style={commandBlockStyle(id)}
              aria-label={`${COMMANDS[id].label}: ${collected ? "수집 완료" : "미수집"}`}
              aria-describedby={active === id ? tooltipId : undefined}
              tabIndex={0}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible"))
                  setFocused(id);
              }}
              onBlur={() => setFocused(null)}
            >
              {collected ? <CommandBlockIcon id={id} /> : <LockIcon />}
              <span>{COMMANDS[id].label}</span>
              <CollectionStatusIcon collected={collected} />
            </li>
          );
        })}
      </ul>
      {active && rows.current[active] && (
        <CommandHint
          key={active}
          id={active}
          anchor={rows.current[active]}
          tooltipId={tooltipId}
        />
      )}
    </aside>
  );
}

export function CommandAcquisition({ id, count }: { id: Chip; count: number }) {
  return (
    <>
      <span className="acquisition-icon">
        <CommandBlockIcon id={id} />
      </span>
      <div className="acquisition-copy">
        <span>명령 블록 획득!</span>
        <strong>
          {COMMANDS[id].label} <small>({count}/3)</small>
        </strong>
        {count === 3 && (
          <b className="acquisition-complete">
            3/3 완료! 탈출 콘솔로 이동하세요.
          </b>
        )}
      </div>
    </>
  );
}
