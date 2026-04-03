import Image from "next/image";
import { resolvePresidentImageSrc } from "@/lib/president-image-paths";

export default function PresidentAvatar({
  presidentSlug,
  presidentName,
  size = 48,
  className = "",
}) {
  const src = resolvePresidentImageSrc({ presidentSlug, presidentName });

  if (!src) {
    return null;
  }

  return (
    <div
      className={[
        "relative shrink-0 overflow-hidden rounded-full border border-[rgba(120,53,15,0.14)] bg-[rgba(247,242,234,0.9)] shadow-[0_8px_18px_rgba(120,53,15,0.08)]",
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
