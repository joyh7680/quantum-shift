import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CHARACTERS } from "./Character";
import { TitleScene } from "./TitleScene";
import { TitleLogo } from "./TitleLogo";
import { useGame } from "./store";
import { CITY_STAGES } from "./stages";

function CharacterThumbnail({ id }: { id: string }) {
  return (
    <img
      className="character-thumbnail"
      src={`/character-thumbnails/${id}.png`}
      alt=""
      width={30}
      height={30}
      draggable={false}
    />
  );
}

function MenuDialog({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      queueMicrotask(() => previousFocus.current?.focus());
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`menu-dialog ${className}`}
      aria-labelledby="menu-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <header className="menu-dialog-header">
        <div>
          <span className="qc-overline">QUANTUM CITY / MISSION CONTROL</span>
          <h2 id="menu-dialog-title">{title}</h2>
        </div>
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label="닫기"
          autoFocus
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function MainMenu() {
  const id = useGame((s) => s.character);
  const [modal, setModal] = useState<"characters" | "stages" | null>(null);
  const [selectedStage, setSelectedStage] = useState(1);
  const asset = CHARACTERS.find((c) => c.id === id)!;
  const stage = CITY_STAGES[selectedStage - 1];
  const start = () => useGame.getState().start(id);
  useEffect(() => {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }, []);
  return (
    <main className="city-menu">
      <TitleScene id={id} />
      <div className="city-vignette" />
      <header className="city-topbar">
        <a className="city-wordmark" href="#" aria-label="퀀텀시티 메인">
          <span className="quantum-symbol">Q</span> QUANTUM CITY
        </a>
        <span className="city-system">
          <i /> QUANTUM LINK ONLINE <b>01 / 05 SECTORS</b>
        </span>
      </header>
      <section className="city-intro">
        <div className="qc-overline">
          <span /> A NEW DIMENSION OF ADVENTURE
        </div>
        <TitleLogo />
        <p className="city-tagline">
          크기의 경계를 넘는
          <br className="compact-break" /> 새로운 차원의 탐험
        </p>
        <p className="city-description">
          작아지는 순간, 새로운 길이 열린다.
          <br />
          당신의 크기가 이 도시의 가능성을 바꾼다.
        </p>
        <div className="city-genres">
          <span>3D 어드벤처</span>
          <span>크기 변환</span>
          <span>코딩 미션</span>
        </div>
      </section>
      <div className="hero-readout">
        <span>
          EXPLORER /{" "}
          {String(CHARACTERS.findIndex((c) => c.id === id) + 1).padStart(
            2,
            "0",
          )}
        </span>
        <strong>{asset.name}</strong>
        <small>
          QUANTUM SCALE <b>1.00 ×</b>
        </small>
      </div>
      <div className="scale-readout" aria-hidden="true">
        <span>0.25×</span>
        <i />
        <strong>1.00×</strong>
        <i />
        <span>2.50×</span>
      </div>
      <section className="city-actions" aria-label="메인 메뉴">
        <div className="launch-label">
          <span className="status-dot" /> STAGE 01 · 거인의 연구실{" "}
          <small>플레이 가능</small>
        </div>
        <div className="menu-buttons">
          <button className="city-launch" onClick={start}>
            게임 시작 <span>↗</span>
          </button>
          <button
            className="city-secondary character-trigger"
            aria-label={`캐릭터 선택: ${asset.name}`}
            aria-haspopup="dialog"
            onClick={() => setModal("characters")}
          >
            <CharacterThumbnail id={id} />
            <span className="character-trigger-copy">
              <small>캐릭터 선택</small>
              <strong>{asset.name}</strong>
            </span>
          </button>
          <button
            className="city-secondary"
            onClick={() => {
              setSelectedStage(1);
              setModal("stages");
            }}
          >
            <span>⌘</span> 스테이지 안내
          </button>
        </div>
      </section>
      <footer className="city-footer">
        <span>CHANGE YOUR SCALE. CHANGE YOUR WORLD.</span>
        <span>
          5개의 스테이지 · 하나의 퀀텀시티 <b>Q / 001</b>
        </span>
      </footer>
      {modal === "characters" && (
        <MenuDialog
          title="캐릭터 선택"
          onClose={() => setModal(null)}
          className="character-dialog"
        >
          <p className="dialog-lead">
            함께 도시를 탐험할 코드모스를 선택하세요.
          </p>
          <div className="explorer-selection">
            <span>선택한 탐험가</span>
            <strong>{asset.name}</strong>
            <span>총 {CHARACTERS.length}종</span>
          </div>
          <div className="explorer-grid">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                aria-label={`${c.name} 선택`}
                aria-pressed={c.id === id}
                className={c.id === id ? "chosen" : ""}
                onClick={() => useGame.getState().patch({ character: c.id })}
              >
                <CharacterThumbnail id={c.id} />
                <span className="explorer-name">{c.name}</span>
                <b aria-hidden="true">{c.id === id ? "✓" : ""}</b>
              </button>
            ))}
          </div>
          <footer className="dialog-footer">
            <span>선택한 캐릭터가 메인 화면과 게임에 적용됩니다.</span>
            <button className="city-launch" onClick={() => setModal(null)}>
              선택 완료 <span>→</span>
            </button>
          </footer>
        </MenuDialog>
      )}
      {modal === "stages" && (
        <MenuDialog title="스테이지 안내" onClose={() => setModal(null)}>
          <p className="dialog-lead">
            크기의 경계를 넘어, 다섯 개의 구역을 향해.
          </p>
          <div className="mission-route" aria-label="5개 스테이지 미션 경로">
            {CITY_STAGES.map((s) => (
              <button
                key={s.number}
                className={`route-card ${selectedStage === s.number ? "active" : ""} ${s.available ? "available" : "locked"}`}
                aria-pressed={selectedStage === s.number}
                onClick={() => setSelectedStage(s.number)}
              >
                <span className="route-node">
                  {String(s.number).padStart(2, "0")}
                </span>
                <small>STAGE {String(s.number).padStart(2, "0")}</small>
                <strong>{s.name}</strong>
                <p>{s.description}</p>
                <span className="route-status">
                  {s.available ? "● 플레이 가능" : "◇ 준비 중"}
                </span>
              </button>
            ))}
          </div>
          <section className="stage-details" aria-live="polite">
            <div>
              <span className="qc-overline">
                MISSION BRIEF / {String(stage.number).padStart(2, "0")}
              </span>
              <h3>{stage.name}</h3>
              <h4>{stage.learning ? "미션" : "목표"}</h4>
              <p>{stage.objective}</p>
            </div>
            <div>
              <h4>{stage.learning ? "학습 요소" : "주요 플레이"}</h4>
              {stage.learning ? (
                <p>{stage.learning}</p>
              ) : (
                <ul>
                  {stage.play?.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <footer className="dialog-footer">
            <span>
              {stage.available
                ? "현재 STAGE 1을 플레이할 수 있습니다."
                : "이 구역은 준비 중입니다. 추후 공개됩니다."}
            </span>
            <button
              className="city-launch"
              disabled={!stage.available}
              onClick={start}
            >
              {stage.available ? "STAGE 1 시작" : "준비 중 · 진입 불가"}
              <span>{stage.available ? "→" : "◇"}</span>
            </button>
          </footer>
        </MenuDialog>
      )}
    </main>
  );
}
