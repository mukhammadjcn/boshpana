"use client";

type LoadingStateProps = {
  label: string;
  fullScreen?: boolean;
  className?: string;
  variant?: "label" | "spinner";
};

export function LoadingState({
  label,
  fullScreen = true,
  className = "",
  variant = "label",
}: LoadingStateProps) {
  const containerClassName = fullScreen
    ? "grid min-h-screen place-items-center bg-bg-base text-ink-secondary"
    : "grid place-items-center text-ink-secondary";

  return (
    <div className={`${containerClassName} ${className}`.trim()}>
      {variant === "spinner" ? (
        <div className="flex items-center justify-center">
          <span className="sr-only">{label}</span>
          <span
            aria-hidden
            className="h-6 w-6 animate-spin rounded-full border-2 border-brand/30 border-t-brand"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          {label}
        </div>
      )}
    </div>
  );
}
