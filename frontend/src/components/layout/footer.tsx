import type { ReactNode } from "react";
import { Link } from "wouter";
import { MapPin, Phone, Mail, Facebook, Youtube, Linkedin } from "lucide-react";
import { useContactInfo } from "@/hooks/useContactInfo";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { usePortal } from "@/contexts/PortalContext";
import { getFooterServices } from "@/lib/portal";
import { TNJS } from "@/lib/tnjsTheme";

function SocialIcon({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  if (!href || href === "#") return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-[#00A651] sm:h-10 sm:w-10"
    >
      {children}
    </a>
  );
}

export function Footer() {
  const { data: contactInfos = [] } = useContactInfo();
  const { portal, meta } = usePortal();
  const { data: settings } = useSiteSettings(portal);
  const services = getFooterServices(portal);

  const getContactIcon = (type: string) => {
    switch (type) {
      case "main_office":
        return <MapPin className="h-5 w-5 mr-3 flex-shrink-0" />;
      case "hotline":
        return <Phone className="h-5 w-5 mr-3 flex-shrink-0" />;
      case "email":
        return <Mail className="h-5 w-5 mr-3 flex-shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <footer
      className="w-full max-w-full py-12 text-white sm:py-16"
      style={{ backgroundColor: TNJS.charcoal }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-8 grid w-4/5 max-w-4/5 grid-cols-1 gap-6 sm:grid-cols-2 lg:mb-12 lg:grid-cols-3 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-4 flex items-center lg:mb-6">
              <span
                className="mr-2 text-2xl font-bold sm:text-3xl"
                style={{ color: TNJS.green }}
              >
                {portal === "huongnghiep"
                  ? "HN"
                  : portal === "dichvu"
                    ? "DV"
                    : portal === "luyenthi"
                      ? "LT"
                      : "N&P"}
              </span>
              <span className="text-sm text-white/50">
                {portal === "group" ? "Group" : "N&P Group"}
              </span>
            </div>
            <p className="mb-4 text-sm text-white/60 sm:text-base lg:mb-6">
              {meta.tagline}.
              <br />
              Chuyên nghiệp - Uy tín - Hiệu quả.
            </p>
            <div className="flex justify-center space-x-3 sm:justify-start">
              <SocialIcon href={settings?.facebookUrl || ""} label="Facebook">
                <Facebook className="h-4 w-4 sm:h-5 sm:w-5" />
              </SocialIcon>
              <SocialIcon href={settings?.youtubeUrl || ""} label="YouTube">
                <Youtube className="h-4 w-4 sm:h-5 sm:w-5" />
              </SocialIcon>
              <SocialIcon href={settings?.linkedinUrl || ""} label="LinkedIn">
                <Linkedin className="h-4 w-4 sm:h-5 sm:w-5" />
              </SocialIcon>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-center text-base font-semibold sm:text-left sm:text-lg lg:mb-6">
              {portal === "group" ? "Cổng dịch vụ" : "Liên kết"}
            </h3>
            <ul className="space-y-2 text-center text-white/60 sm:text-left lg:space-y-3">
              {services.map((service) => (
                <li key={`${service.href}-${service.name}`}>
                  {service.external ||
                  service.href.includes("?") ||
                  service.href.includes("#") ? (
                    <a
                      href={service.href}
                      className="transition-colors hover:text-white"
                      rel={service.external ? "noopener noreferrer" : undefined}
                    >
                      {service.name}
                    </a>
                  ) : (
                    <Link
                      href={service.href}
                      className="transition-colors hover:text-white"
                    >
                      {service.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-center text-base font-semibold sm:text-left sm:text-lg lg:mb-6">
              Liên hệ
            </h3>
            <div className="space-y-4 text-white/60">
              {contactInfos.length > 0 ? (
                contactInfos
                  .filter((info) => info.isActive !== false)
                  .map((info) => (
                    <div
                      key={info.id}
                      className="flex items-start justify-center sm:justify-start"
                    >
                      {getContactIcon(info.type)}
                      <div>
                        <div className="mb-0.5 text-sm font-medium text-white/85">
                          {info.title}
                        </div>
                        {(info.content || []).map((line, i) => (
                          <div key={i} className="text-sm">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
              ) : (
                <>
                  <div className="flex items-center justify-center sm:justify-start">
                    <MapPin className="mr-3 h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">TP. Hồ Chí Minh</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start">
                    <Phone className="mr-3 h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">Hotline</span>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start">
                    <Mail className="mr-3 h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">info@npgroup.vn</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="mt-4 px-4 py-5 sm:px-6 lg:px-8"
        style={{ backgroundColor: TNJS.orange }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between md:flex-row">
          <div className="mb-4 text-sm font-medium text-white md:mb-0">
            © {new Date().getFullYear()} N&P Group. Tất cả quyền được bảo lưu.
          </div>
          <div className="flex space-x-6 text-sm text-white/90">
            {settings?.privacyUrl ? (
              <a href={settings.privacyUrl} className="transition-colors hover:text-white">
                Chính sách bảo mật
              </a>
            ) : (
              <span className="text-white/70">Chính sách bảo mật</span>
            )}
            {settings?.termsUrl ? (
              <a href={settings.termsUrl} className="transition-colors hover:text-white">
                Điều khoản dịch vụ
              </a>
            ) : (
              <span className="text-white/70">Điều khoản dịch vụ</span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
