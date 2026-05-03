"use client";

import Image from "next/image";

// Featured artwork tile shared across Mafia status cards (ghost,
// victim, doctor save, peaceful night, talk, no-vote, winner banners).
// Sized to feel hero-like without overwhelming the surrounding text.
export function MafiaSituationArt({
  src,
  alt,
  size = "md"
}: {
  src: string;
  alt: string;
  size?: "md" | "lg";
}) {
  const dimension = size === "lg" ? "h-40 w-40" : "h-28 w-28";
  const sizesAttr = size === "lg" ? "160px" : "112px";
  return (
    <div
      className={`relative mx-auto overflow-hidden rounded-full border border-line-strong bg-bg-elevated ${dimension}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizesAttr}
        className="object-cover"
      />
    </div>
  );
}
