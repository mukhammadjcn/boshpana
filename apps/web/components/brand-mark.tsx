import Image from "next/image";

export function BrandMark({
  className = "",
  size = 40
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/apple-touch-icon.png"
        alt="Jamoaviy.uz logo"
        fill
        sizes={`${size}px`}
        className="object-cover"
        priority
        unoptimized
      />
    </span>
  );
}
