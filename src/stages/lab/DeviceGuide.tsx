import { useEffect } from "react";
import { COMMANDS } from "./state";
import { DEVICE_GUIDES, useDeviceGuide } from "./guideState";

export function DeviceGuide() {
  const active = useDeviceGuide((s) => s.active);
  const inspect = useDeviceGuide((s) => s.inspect);
  useEffect(() => () => inspect(null), [inspect]);
  return (
    <nav
      className="device-guide"
      aria-label="장치 안내"
      onMouseLeave={() => inspect(null)}
    >
      {DEVICE_GUIDES.map(({ id, description }) => (
        <div className="device-guide-row" key={id}>
          <button
            className={
              "device-guide-card" + (active === id ? " inspecting" : "")
            }
            onMouseEnter={() => inspect(id)}
            onMouseLeave={() => inspect(null)}
            onFocus={() => inspect(id)}
            onBlur={() => inspect(null)}
            onClick={() => inspect(id)}
            onKeyDown={(e) => {
              if (e.key === "Escape") inspect(null);
            }}
            aria-describedby={active === id ? `device-hint-${id}` : undefined}
          >
            <span aria-hidden="true">{COMMANDS[id].icon}</span>
            {COMMANDS[id].label}
          </button>
          {active === id && (
            <p
              className="device-guide-tooltip"
              role="tooltip"
              id={`device-hint-${id}`}
            >
              {description}
            </p>
          )}
        </div>
      ))}
    </nav>
  );
}
