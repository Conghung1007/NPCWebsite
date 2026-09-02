import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { usePortal } from "@/contexts/PortalContext";

const STORAGE_KEY = "np-popup-dismissed";

export function SitePopup() {
  const { portal } = usePortal();
  const { data: settings } = useSiteSettings(portal);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!settings?.popupEnabled) return;
    const key = `${STORAGE_KEY}:${portal}:${settings.popupTitle || "default"}`;
    if (sessionStorage.getItem(key)) return;

    const delay = settings.popupDelayMs ?? 1500;
    const timer = window.setTimeout(() => setOpen(true), delay);
    return () => window.clearTimeout(timer);
  }, [settings, portal]);

  if (!settings?.popupEnabled) return null;

  const dismiss = () => {
    const key = `${STORAGE_KEY}:${portal}:${settings.popupTitle || "default"}`;
    sessionStorage.setItem(key, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{settings.popupTitle || "Thông báo"}</DialogTitle>
        </DialogHeader>
        {settings.popupImageUrl ? (
          <img
            src={settings.popupImageUrl}
            alt=""
            className="w-full rounded-lg object-cover max-h-48"
          />
        ) : null}
        {settings.popupBody ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {settings.popupBody}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={dismiss}>
            Đóng
          </Button>
          {settings.popupLinkUrl ? (
            <Button asChild>
              <a href={settings.popupLinkUrl} onClick={dismiss}>
                Xem thêm
              </a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
