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
  const dimension = size === "lg" ? "h-32 w-32" : "h-24 w-24";
  const sizesAttr = size === "lg" ? "128px" : "96px";
  return (
    <div className={`relative mx-auto ${dimension}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizesAttr}
        className="object-contain"
      />
    </div>
  );
}
