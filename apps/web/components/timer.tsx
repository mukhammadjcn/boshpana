"use client";

export function Timer({ seconds }: { seconds: number }) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (safe % 60).toString().padStart(2, "0");

  return (
    <div className="rounded-full border border-orange-400/40 bg-orange-400/10 px-4 py-2 text-sm font-semibold text-orange-100">
      {minutes}:{remainder}
    </div>
  );
}
