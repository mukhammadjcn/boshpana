"use client";

import type { CSSProperties, ReactNode } from "react";

type GameModalShellProps = {
  children: ReactNode;
  align?: "center" | "sheet";
  zIndexClassName?: string;
  overlayClassName?: string;
  backdropClassName?: string;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  onBackdropClick?: () => void;
  stopPanelClick?: boolean;
};

export function GameModalShell({
  children,
  align = "center",
  zIndexClassName = "z-50",
  overlayClassName = "bg-bg-overlay backdrop-blur-md",
  backdropClassName = "",
  panelClassName = "",
  panelStyle,
  onBackdropClick,
  stopPanelClick = false,
}: GameModalShellProps) {
  const alignClass =
    align === "sheet" ? "items-end sm:items-center" : "items-center";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 ${zIndexClassName} flex ${alignClass} justify-center ${overlayClassName}`}
    >
      <div
        className={`absolute inset-0 ${backdropClassName}`.trim()}
        onClick={onBackdropClick}
      />
      <div
        className={`relative z-10 ${panelClassName}`.trim()}
        style={panelStyle}
        onClick={
          stopPanelClick
            ? (event) => {
                event.stopPropagation();
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

type GameBottomSheetShellProps = {
  children: ReactNode;
  closing?: boolean;
  animated?: boolean;
  onBackdropClick?: () => void;
  overlayClassName?: string;
  panelClassName?: string;
  zIndexClassName?: string;
  showHandle?: boolean;
};

export function GameBottomSheetShell({
  children,
  closing = false,
  animated = true,
  onBackdropClick,
  overlayClassName = "bg-bg-overlay backdrop-blur-sm",
  panelClassName = "",
  zIndexClassName = "z-50",
  showHandle = true,
}: GameBottomSheetShellProps) {
  return (
    <GameModalShell
      align="sheet"
      zIndexClassName={zIndexClassName}
      overlayClassName={`${overlayClassName} ${
        animated ? (closing ? "animate-overlay-out" : "animate-overlay-in") : ""
      }`}
      panelClassName={`w-full max-w-md rounded-t-3xl border-t border-line-subtle bg-bg-surface shadow-pop sm:rounded-3xl sm:border ${
        animated ? (closing ? "animate-sheet-out" : "animate-sheet-in") : ""
      } ${panelClassName}`}
      onBackdropClick={onBackdropClick}
    >
      {showHandle ? (
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
      ) : null}
      {children}
    </GameModalShell>
  );
}
