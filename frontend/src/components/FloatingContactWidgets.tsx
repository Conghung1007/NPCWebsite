import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { Phone } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useContactInfo } from "@/hooks/useContactInfo";
import { navigateAppHref } from "@/lib/navigateAppHref";
import { resolveFloatLinks } from "@/lib/floatContact";
import { TNJS } from "@/lib/tnjsTheme";
import { cn } from "@/lib/utils";

/** Default mascot when Cpanel float CTA image is empty (TNJS-style). */
export const DEFAULT_FLOAT_CTA_IMAGE = "/brand/float-cta-mascot.png";

function ZaloGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="24" r="24" fill="#0068FF" />
      <text
        x="24"
        y="29"
        textAnchor="middle"
        fill="#fff"
        fontSize="14"
        fontWeight="700"
        fontFamily="system-ui,sans-serif"
      >
        Zalo
      </text>
    </svg>
  );
}

function MessengerGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="24" r="24" fill="#0084FF" />
      <path
        fill="#fff"
        d="M24 10.5c-7.3 0-13.2 5.4-13.2 12.1 0 3.8 1.9 7.2 4.9 9.4v4.5l4.5-2.5c1.2.3 2.5.5 3.8.5 7.3 0 13.2-5.4 13.2-12.1S31.3 10.5 24 10.5zm1.4 16.3-3.4-3.6-6.6 3.6 7.3-7.7 3.5 3.6 6.5-3.6-7.3 7.7z"
      />
    </svg>
  );
}

function isAppChromePath(location: string): boolean {
  return (
    location.startsWith("/cpanel") ||
    location.startsWith("/login") ||
    location.startsWith("/register") ||
    location.startsWith("/forgot-password") ||
    location.startsWith("/exam/") ||
    location.startsWith("/exam-taking") ||
    location.startsWith("/profile") ||
    location.startsWith("/checkout")
  );
}

/**
 * TNJS-style floating contact: CTA + mascot bottom-left; Messenger / Zalo / Call bottom-right.
 * Configured in Cpanel → Thông tin liên hệ (group site settings).
 */
export function FloatingContactWidgets() {
  const { data: settings, isLoading } = useSiteSettings("group");
  const { data: contactInfos = [] } = useContactInfo();
  const [location, setLocation] = useLocation();

  if (isAppChromePath(location) || isLoading || !settings?.floatWidgetsEnabled) {
    return null;
  }

  const contactHotline =
    contactInfos
      .filter((c) => c.type === "hotline" && c.isActive !== false)
      .flatMap((c) => (Array.isArray(c.content) ? c.content : []))
      .map((line) => String(line || "").trim())
      .find((line) => line.length > 0) || null;

  const links = resolveFloatLinks(settings, { contactHotline });
  const showCta = settings.floatCtaEnabled !== false;
  const ctaLabel = (settings.floatCtaLabel || "Tư vấn miễn phí").trim();
  const ctaHref = (settings.floatCtaHref || "/#tu-van").trim();
  const ctaImage = (settings.floatCtaImageUrl || "").trim();

  const rightButtons = [
    links.messenger
      ? {
          key: "messenger",
          href: links.messenger,
          label: "Chat Facebook Messenger",
          newTab: true,
          className: "bg-[#0084FF] hover:brightness-110",
          icon: <MessengerGlyph className="h-full w-full" />,
        }
      : null,
    links.zalo
      ? {
          key: "zalo",
          href: links.zalo,
          label: "Chat Zalo",
          newTab: true,
          className: "bg-[#0068FF] hover:brightness-110",
          icon: <ZaloGlyph className="h-full w-full" />,
        }
      : null,
    links.call
      ? {
          key: "call",
          href: links.call,
          label: `Gọi ${links.callLabel}`,
          newTab: false,
          className: "float-call-btn",
          icon: <Phone className="h-6 w-6 text-white" strokeWidth={2.4} />,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    href: string;
    label: string;
    newTab: boolean;
    className: string;
    icon: ReactNode;
  }>;

  if (!showCta && rightButtons.length === 0) return null;

  // Empty CMS field → brand default mascot (TNJS-style icon3)
  const mascotSrc = ctaImage || DEFAULT_FLOAT_CTA_IMAGE;

  return (
    <>
      {showCta ? (
        <div
          className="float-cta-bar pointer-events-none fixed bottom-0 left-2 z-[90] sm:left-2.5 pb-[env(safe-area-inset-bottom)]"
          data-testid="float-cta"
        >
          <div
            className="pointer-events-auto relative flex h-9 items-center justify-end rounded-t-md pl-[4.75rem] pr-3 shadow-lg sm:h-10 sm:pl-[5.25rem] sm:pr-4"
            style={{
              background:
                "linear-gradient(105deg, #E85D04 0%, #FF8800 45%, #FFB020 100%)",
            }}
          >
            <img
              src={mascotSrc}
              alt=""
              width={70}
              height={100}
              className="pointer-events-none absolute bottom-0 left-1 z-[1] h-[5.5rem] w-auto max-w-[4.5rem] object-contain object-bottom sm:left-1.5 sm:h-[6.25rem] sm:max-w-[4.75rem]"
              decoding="async"
            />
            <a
              href={ctaHref}
              onClick={(e) => {
                if (/^https?:\/\//i.test(ctaHref)) return;
                e.preventDefault();
                navigateAppHref(ctaHref, setLocation);
              }}
              className="relative z-[2] max-w-[11rem] text-right text-[11px] font-bold uppercase leading-tight tracking-wide text-white transition hover:brightness-110 sm:max-w-[13rem] sm:text-[13px] sm:tracking-wider"
            >
              {ctaLabel}
            </a>
          </div>
        </div>
      ) : null}

      {rightButtons.length > 0 ? (
        <div
          className="fixed bottom-20 right-3 z-[90] flex flex-col items-center gap-3 pb-[env(safe-area-inset-bottom)] sm:bottom-24 sm:right-4"
          data-testid="float-contact-stack"
        >
          {rightButtons.map((btn) => (
            <a
              key={btn.key}
              href={btn.href}
              target={btn.newTab ? "_blank" : undefined}
              rel={btn.newTab ? "noopener noreferrer" : undefined}
              aria-label={btn.label}
              title={btn.label}
              className={cn(
                "relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 sm:h-14 sm:w-14",
                btn.key === "call" ? "overflow-visible" : "overflow-hidden",
                btn.className,
              )}
            >
              {btn.key === "call" ? (
                <>
                  <span className="float-call-ring" aria-hidden />
                  <span
                    className="float-call-ring float-call-ring--delay"
                    aria-hidden
                  />
                  <span
                    className="relative z-[1] flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14"
                    style={{ backgroundColor: TNJS.orange }}
                  >
                    {btn.icon}
                  </span>
                </>
              ) : (
                btn.icon
              )}
            </a>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** Right-stack button count for scroll-top offset (0 = default position). */
export function useFloatStackCount(): number {
  const { data } = useSiteSettings("group");
  const { data: contactInfos = [] } = useContactInfo();
  const [location] = useLocation();
  if (isAppChromePath(location)) return 0;
  if (!data?.floatWidgetsEnabled) return 0;
  const contactHotline =
    contactInfos
      .filter((c) => c.type === "hotline" && c.isActive !== false)
      .flatMap((c) => (Array.isArray(c.content) ? c.content : []))
      .map((line) => String(line || "").trim())
      .find((line) => line.length > 0) || null;
  return resolveFloatLinks(data, { contactHotline }).rightCount;
}
