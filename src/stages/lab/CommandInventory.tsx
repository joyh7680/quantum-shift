import type { CSSProperties } from "react";
import { useGame } from "../../store";
import { COMMANDS } from "./state";
import type { Chip } from "./state";

// HUD colors are independent of the existing 3D item materials.
const BLOCK_COLORS: Record<Chip, string> = {
  battery: "#ffda75",
  power: "#ff94c7",
  vent: "#70f2cd",
};
const BLOCK_ORDER: Chip[] = ["battery", "power", "vent"];
export function commandBlockStyle(id: Chip): CSSProperties {
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
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
        </>
      )}
    </svg>
  );
}

export function CommandInventory() {
  const chips = useGame((s) => s.lab.chips);
  const panel = useGame((s) => s.panel);
  return (
    <aside
      className="chip-hud"
      hidden={panel === "power"}
      aria-label="명령 블록 수집함"
    >
      <span>COMMAND BLOCK INVENTORY</span>
      <b aria-live="polite" aria-atomic="true">
        명령 블록 수집함 {chips.length}/3
      </b>
      <ul>
        {BLOCK_ORDER.map((id) => {
          const collected = chips.includes(id);
          return (
            <li
              key={`${id}-${collected}`}
              data-command={id}
              className={collected ? "found" : "locked"}
              style={commandBlockStyle(id)}
              aria-label={`${COMMANDS[id].label}: ${collected ? "수집 완료" : "미수집"}`}
            >
              <CommandBlockIcon id={id} />
              <span>{COMMANDS[id].label}</span>
              <CollectionStatusIcon collected={collected} />
            </li>
          );
        })}
      </ul>
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
