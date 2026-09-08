import { MapPin, ExternalLink } from "lucide-react";
import { useContactInfo } from "@/hooks/useContactInfo";
import {
  normalizeContactContent,
  resolveOfficeMapEmbed,
} from "@/lib/googleMapsEmbed";
import { cn } from "@/lib/utils";

interface MapDisplayProps {
  className?: string;
  /** Override height (px). Default 280. */
  height?: number;
}

export function MapDisplay({ className = "", height = 280 }: MapDisplayProps) {
  const { data: contactInfos = [], isLoading } = useContactInfo();

  const officeInfo = contactInfos.find(
    (info) => info.type === "main_office" && info.isActive !== false,
  );
  const addressLines = normalizeContactContent(officeInfo?.content);
  const { embedUrl, openUrl } = resolveOfficeMapEmbed({
    mapUrl: officeInfo?.mapUrl,
    addressLines,
  });

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-muted/60 text-sm text-muted-foreground",
          className,
        )}
        style={{ minHeight: height }}
      >
        Đang tải bản đồ…
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center",
          className,
        )}
        style={{ minHeight: height }}
      >
        <MapPin className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          {officeInfo
            ? "Chưa cấu hình được bản đồ nhúng. Thêm link Embed Google Maps trong Cpanel → Thông tin liên hệ."
            : "Chưa có địa chỉ văn phòng để hiển thị bản đồ."}
        </p>
        {openUrl ? (
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Mở Google Maps
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border/60", className)}>
      <iframe
        src={embedUrl}
        width="100%"
        height={height}
        style={{ border: 0, displayHeight: height }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={
          officeInfo?.title
            ? `Bản đồ - ${officeInfo.title}`
            : "Bản đồ văn phòng"
        }
        className="w-full bg-muted"
      />
      {openUrl || addressLines[0] ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {addressLines[0] ? (
            <span className="min-w-0 truncate">{addressLines[0]}</span>
          ) : (
            <span />
          )}
          {openUrl ? (
            <a
              href={
                openUrl.includes("output=embed")
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines[0] || openUrl)}`
                  : openUrl
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
            >
              Phóng to
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
