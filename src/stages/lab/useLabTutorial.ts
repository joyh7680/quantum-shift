import { useEffect, useState } from "react";
import { useGame } from "../../store";
import { LAB_TUTORIALS } from "./objective";

export function useLabTutorial() {
  const activeStage = useGame((s) => s.activeStage);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeStage !== 1) return;
    const seen = new Set<keyof typeof LAB_TUTORIALS>();
    let timer: ReturnType<typeof setTimeout>;
    const show = (id: keyof typeof LAB_TUTORIALS) => {
      if (seen.has(id)) return;
      seen.add(id);
      clearTimeout(timer);
      setMessage(LAB_TUTORIALS[id]);
      timer = setTimeout(() => setMessage(null), 5200);
    };
    // The world can take longer than a toast's lifetime to load. Start the
    // movement hint when the existing game clock first advances (player ready).
    if (useGame.getState().lab.time > 0) show("enter");
    // Subscribe to existing events, including fast failure/reset transitions.
    // Never write tutorial state into the game or change its interaction rules.
    const unsubscribe = useGame.subscribe((s, previous) => {
      if (s.activeStage !== 1 || s.screen !== "game") return;
      if (s.lab.time === 0 && previous.lab.time > 0) {
        seen.clear();
        clearTimeout(timer);
        setMessage(null);
      }
      if (s.lab.time > 0 && previous.lab.time === 0) show("enter");
      if (s.lab.chips.length > 0 && previous.lab.chips.length === 0)
        show("first");
      if (s.lab.chips.length === 3 && previous.lab.chips.length < 3)
        show("collected");
      if (s.panel === "power" && previous.panel !== "power") show("console");
      if (s.lab.run === "failed" && previous.lab.run !== "failed")
        show("failed");
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [activeStage]);

  return activeStage === 1 ? message : null;
}
