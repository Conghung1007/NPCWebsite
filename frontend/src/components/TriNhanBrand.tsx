import { cn } from "@/lib/utils";
import { TNJS } from "@/lib/tnjsTheme";

export const BRAND_FULL_NAME = "Trí Nhân Academy";
export const BRAND_SHORT_NAME = "Trí Nhân";
/** Default raster lockup (fallback when CMS logo empty) */
export const BRAND_DEFAULT_LOGO = "/brand/trinhan-academy-logo.png";

type BrandTone = "default" | "onDark" | "onGreen";

type TriNhanBrandProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: BrandTone;
  /** Portal / tagline dưới hàng logo + tên */
  subtitle?: string;
  /** Prefer uploaded CMS logo when provided */
  imageUrl?: string | null;
  imageAlt?: string;
  /**
   * Use designed PNG lockup from /public/brand when no CMS logo.
   * Default false — SVG emblem + “Trí Nhân Academy” ngang hàng.
   */
  preferDefaultImage?: boolean;
};

const sizeMap = {
  sm: {
    mark: 36,
    title: "text-[0.95rem] sm:text-[1.05rem]",
    academy: "text-[8px] sm:text-[9px]",
    sub: "text-[10px] sm:text-[11px]",
    gap: "gap-2.5",
    img: "h-9 max-w-[10.5rem] sm:h-10 sm:max-w-[12rem]",
  },
  md: {
    mark: 44,
    title: "text-base sm:text-lg",
    academy: "text-[9px] sm:text-[10px]",
    sub: "text-[11px] sm:text-xs",
    gap: "gap-3",
    img: "h-11 max-w-[12.5rem] sm:h-12 sm:max-w-[14rem]",
  },
  lg: {
    mark: 52,
    title: "text-lg sm:text-xl",
    academy: "text-[10px] sm:text-[11px]",
    sub: "text-xs sm:text-sm",
    gap: "gap-3.5",
    img: "h-12 max-w-[14rem] sm:h-14 sm:max-w-[16rem]",
  },
} as const;

/** Emblem: open book + rising path — no letter monogram */
export function TriNhanMark({
  size = 44,
  className,
  tone = "default",
}: {
  size?: number;
  className?: string;
  tone?: BrandTone;
}) {
  const page = "#FFFFFF";
  const pageDim =
    tone === "default" ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.82)";
  const accent = TNJS.yellow;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="16"
        fill={tone === "default" ? TNJS.green : "rgba(255,255,255,0.18)"}
      />
      <path
        d="M14 42.5V24.2c0-1.1.7-2.1 1.7-2.5 5.2-2 10.1-2.1 14.3.2v22.3c-4.6-2.1-9.7-2-14.5-.1-.9.3-1.5 1.2-1.5 2.1Z"
        fill={page}
      />
      <path
        d="M50 42.5V24.2c0-1.1-.7-2.1-1.7-2.5-5.2-2-10.1-2.1-14.3.2v22.3c4.6-2.1 9.7-2 14.5-.1.9.3 1.5 1.2 1.5 2.1Z"
        fill={pageDim}
      />
      <path
        d="M22 38c4.5-3.5 8.2-8.2 10-14.5 1.8 6.3 5.5 11 10 14.5"
        stroke={accent}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="32" cy="21" r="3.2" fill={accent} />
    </svg>
  );
}

/**
 * Lockup: [sách]  Trí Nhân     ← 2 hàng chữ, khối cao ngang logo
 *                ACADEMY
 *         Hướng nghiệp / hệ sinh thái… ← dòng dưới (ngoài khối logo)
 */
export function TriNhanBrand({
  className,
  size = "md",
  tone = "default",
  subtitle,
  imageUrl,
  imageAlt = BRAND_FULL_NAME,
  preferDefaultImage = false,
}: TriNhanBrandProps) {
  const s = sizeMap[size];
  const titleColor = tone === "default" ? "text-foreground" : "text-white";
  const academyColor =
    tone === "default" ? "text-[#008A42]" : "text-[#F5C518]";
  const subtitleColor =
    tone === "default" ? "text-muted-foreground/90" : "text-white/70";

  const cmsLogo = imageUrl?.trim() || "";
  const showImage =
    cmsLogo ||
    (preferDefaultImage && tone === "default" ? BRAND_DEFAULT_LOGO : "");

  if (showImage) {
    return (
      <span className={cn("inline-flex flex-col items-start gap-1", className)}>
        <img
          src={showImage}
          alt={imageAlt}
          className={cn("w-auto object-contain object-left", s.img)}
        />
        {subtitle ? (
          <span
            className={cn(
              "pl-0.5 tracking-wide leading-snug",
              subtitleColor,
              s.sub,
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex flex-col items-start min-w-0", className)}>
      {/* Hàng logo: sách + (Trí Nhân / ACADEMY 2 dòng), cao bằng logo */}
      <span className={cn("inline-flex items-center min-w-0", s.gap)}>
        <TriNhanMark size={s.mark} tone={tone} />
        <span
          className="flex min-w-0 flex-col justify-center gap-0"
          style={{ height: s.mark }}
        >
          <span
            className={cn(
              "font-display font-bold tracking-tight leading-[1.05]",
              titleColor,
              s.title,
            )}
          >
            Trí Nhân
          </span>
          <span
            className={cn(
              "-mt-0.5 font-bold uppercase tracking-[0.18em] leading-none",
              academyColor,
              s.academy,
            )}
          >
            Academy
          </span>
        </span>
      </span>
      {/* Tagline dưới toàn bộ khối logo */}
      {subtitle ? (
        <span className={cn("mt-1 inline-flex min-w-0 items-start", s.gap)}>
          <span className="shrink-0" style={{ width: s.mark }} aria-hidden />
          <span
            className={cn("tracking-wide leading-snug", subtitleColor, s.sub)}
          >
            {subtitle}
          </span>
        </span>
      ) : null}
    </span>
  );
}
