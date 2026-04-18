import Image from "next/image";
import { resolvePresidentImageSrc } from "@/lib/president-image-paths";

export default function PresidentAvatar({
  presidentSlug,
  presidentName,
  size = 48,
  shape = "circle",
  className = "",
}) {
  const src = resolvePresidentImageSrc({ presidentSlug, presidentName });

  if (!src) {
    return null;
  }

  return (
    <div
      className={[
        "relative shrink-0 overflow-hidden border border-white/10 bg-white/5 shadow-[0_8px_18px_rgba(0,0,0,0.22)]",
        shape === "rounded" ? "rounded-[0.95rem]" : "rounded-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
