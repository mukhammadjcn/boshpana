"use client";

// Solid opaque strips that fill the Telegram safe-area insets so any
// content scrolled into those regions is fully hidden (matches the
// chrome color set via setHeaderColor / setBackgroundColor).
export function SafeAreaBlur() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-20 bg-bg-base"
        style={{ height: "var(--safe-top)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-bg-base"
        style={{ height: "var(--safe-bottom)" }}
      />
    </>
  );
}
