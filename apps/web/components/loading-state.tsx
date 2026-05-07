"use client";

type LoadingStateProps = {
  label: string;
  fullScreen?: boolean;
  className?: string;
};

export function LoadingState({
  label,
  fullScreen = true,
  className = "",
}: LoadingStateProps) {
  const containerClassName = fullScreen
    ? "grid min-h-screen place-items-center bg-bg-base text-ink-secondary"
    : "grid place-items-center text-ink-secondary";

  return (
    <div className={`${containerClassName} ${className}`.trim()}>
      <div className="flex items-center gap-2 text-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
        {label}
      </div>
    </div>
  );
}
