import { useGame } from "../store";
export function close() {
  useGame.getState().patch({ panel: null });
}
export function PanelHeader({
  number,
  title,
  sub,
}: {
  number: string;
  title: string;
  sub: string;
}) {
  return (
    <header className="panel-header">
      <div className="panel-number">{number}</div>
      <div>
        <span className="eyebrow">{sub}</span>
        <h2>{title}</h2>
      </div>
      <button className="close" aria-label="패널 닫기" onClick={close}>
        ×
      </button>
    </header>
  );
}
