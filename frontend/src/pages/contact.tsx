import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Facebook,
  Youtube,
  MessageCircle,
  Linkedin,
  ExternalLink,
} from "lucide-react";
import { HeroSection } from "@/components/ui/hero-section";
import { ContactForm } from "@/components/ui/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { useUiImages } from "@/hooks/useUiImages";
import { useAuth } from "@/hooks/useAuth";
import { useContactInfo } from "@/hooks/useContactInfo";
import { MapDisplay } from "@/components/MapDisplay";
import { useSiteContents } from "@/hooks/useSiteContents";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getSiteContentDefaults } from "@shared/siteContentDefaults";
import { resolvePortal } from "@/lib/portal";
import { normalizeContactContent } from "@/lib/googleMapsEmbed";

function lineHref(type: string, line: string): string | null {
  const t = line.trim();
  if (!t) return null;
  if (type === "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    return `mailto:${t}`;
  }
  if (type === "hotline") {
    const digits = t.replace(/[^\d+]/g, "");
    if (digits.length >= 8) return `tel:${digits}`;
  }
  if (type === "main_office") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}`;
  }
  return null;
}

export default function Contact() {
  const portal = resolvePortal();
  const { getImageByType, invalidateCache } = useUiImages();
  const { hasImageEditPermission } = useAuth();
  const { data: contactInfos = [] } = useContactInfo();
  const { data: settings } = useSiteSettings(portal);
  const defaults = useMemo(
    () => getSiteContentDefaults("contact", portal) || {},
    [portal],
  );
  const { data: remoteContents = {} } = useSiteContents("contact", portal);
  const getContent = (key: string, fallback = "") =>
    remoteContents[key] ?? defaults[key] ?? fallback;

  const [heroImage, setHeroImage] = useState(
    "https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080",
  );
  const [serviceFromQuery, setServiceFromQuery] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("service");
    if (q) setServiceFromQuery(q);
  }, []);

  useEffect(() => {
    const dbHeroImage = getImageByType("contact-hero");
    if (dbHeroImage) setHeroImage(dbHeroImage);
  }, [getImageByType]);

  useEffect(() => {
    document.title = `${getContent("heroTitle", "Liên hệ")} - Trí Nhân Academy`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        getContent(
          "metaDescription",
          "Liên hệ với Trí Nhân Academy để được tư vấn miễn phí về visa, du học, tiếng Nhật và luyện thi.",
        ),
      );
    }
  }, [remoteContents, defaults]);

  const getContactIcon = (type: string) => {
    const iconClass = "h-5 w-5";
    switch (type) {
      case "main_office":
        return <MapPin className={`${iconClass} text-primary`} />;
      case "hotline":
        return <Phone className={`${iconClass} text-primary`} />;
      case "email":
        return <Mail className={`${iconClass} text-primary`} />;
      case "business_hours":
        return <Clock className={`${iconClass} text-primary`} />;
      default:
        return <MapPin className={`${iconClass} text-primary`} />;
    }
  };

  const fallbackRows = useMemo(() => {
    const rows: Array<{ type: string; title: string; content: string[] }> = [];
    if (settings?.address?.trim()) {
      rows.push({
        type: "main_office",
        title: "Địa chỉ",
        content: [settings.address.trim()],
      });
    }
    if (settings?.hotline?.trim()) {
      rows.push({
        type: "hotline",
        title: "Hotline",
        content: [settings.hotline.trim()],
      });
    }
    if (settings?.email?.trim()) {
      rows.push({
        type: "email",
        title: "Email",
        content: [settings.email.trim()],
      });
    }
    if (rows.length === 0) {
      rows.push(
        {
          type: "main_office",
          title: "Văn phòng",
          content: ["TP. Hồ Chí Minh"],
        },
        {
          type: "email",
          title: "Email",
          content: ["info@trinhan.academy"],
        },
      );
    }
    return rows;
  }, [settings]);

  const displayContactInfo =
    contactInfos.length > 0
      ? contactInfos.map((info) => ({
          type: info.type,
          title: info.title,
          content: normalizeContactContent(info.content),
          icon: getContactIcon(info.type),
        }))
      : fallbackRows.map((row) => ({
          ...row,
          icon: getContactIcon(row.type),
        }));

  const socialLinks = [
    {
      name: "Facebook",
      icon: <Facebook className="h-5 w-5" />,
      href: settings?.facebookUrl || "",
      color: "bg-[#1877F2] hover:bg-[#166fe5]",
    },
    {
      name: "YouTube",
      icon: <Youtube className="h-5 w-5" />,
      href: settings?.youtubeUrl || "",
      color: "bg-[#FF0000] hover:bg-[#e60000]",
    },
    {
      name: "Zalo",
      icon: <MessageCircle className="h-5 w-5" />,
      href: settings?.zaloUrl || "",
      color: "bg-[#0068FF] hover:bg-[#0058d6]",
    },
    {
      name: "LinkedIn",
      icon: <Linkedin className="h-5 w-5" />,
      href: settings?.linkedinUrl || "",
      color: "bg-[#0A66C2] hover:bg-[#0958a8]",
    },
  ].filter((s) => s.href && s.href !== "#");

  return (
    <div className="w-full max-w-full">
      <HeroSection
        title={getContent("heroTitle", "Liên hệ với chúng tôi")}
        subtitle=""
        description={getContent(
          "heroDescription",
          "Sẵn sàng hỗ trợ bạn. Hãy để lại thông tin để nhận tư vấn miễn phí!",
        )}
        backgroundImage={heroImage}
        allowImageEdit={hasImageEditPermission}
        imageType="contact-hero"
        onImageUpdate={(newUrl) => {
          setHeroImage(newUrl);
          invalidateCache();
        }}
      />

      <section className="bg-neutral py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="order-2 lg:order-1 lg:col-span-2">
              <ContactForm variant="page" defaultService={serviceFromQuery} />
            </div>

            <div className="order-1 space-y-4 lg:order-2 lg:space-y-6">
              <Card className="border-border/70 shadow-sm">
                <CardContent className="p-5 sm:p-6">
                  <h4 className="mb-4 font-semibold text-foreground">
                    Thông tin liên hệ
                  </h4>
                  <div className="space-y-4">
                    {displayContactInfo.map((info, index) => (
                      <div key={`${info.title}-${index}`} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          {info.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1 font-medium text-foreground">
                            {info.title}
                          </div>
                          {info.content.map((item, i) => {
                            const href = lineHref(info.type, item);
                            return href ? (
                              <a
                                key={i}
                                href={href}
                                target={
                                  info.type === "main_office"
                                    ? "_blank"
                                    : undefined
                                }
                                rel={
                                  info.type === "main_office"
                                    ? "noopener noreferrer"
                                    : undefined
                                }
                                className="block text-sm text-muted-foreground transition-colors hover:text-primary"
                              >
                                {item}
                              </a>
                            ) : (
                              <div
                                key={i}
                                className="text-sm text-muted-foreground"
                              >
                                {item}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {socialLinks.length > 0 ? (
                <Card className="border-border/70 shadow-sm">
                  <CardContent className="p-5 sm:p-6">
                    <h4 className="mb-4 font-semibold text-foreground">
                      Kết nối với chúng tôi
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {socialLinks.map((social) => (
                        <a
                          key={social.name}
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors ${social.color}`}
                          title={social.name}
                          aria-label={social.name}
                        >
                          {social.icon}
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>

          <Card className="mt-6 border-border/70 shadow-sm sm:mt-8">
            <CardContent className="p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold text-foreground">
                  Bản đồ văn phòng
                </h4>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  Có thể mở rộng trên Google Maps
                </span>
              </div>
              <MapDisplay height={360} />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
