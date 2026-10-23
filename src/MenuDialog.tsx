import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function MenuDialog({
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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      {children}
    </dialog>
  );
}
