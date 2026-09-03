import { useEffect, useState } from "react";
import { Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAdminPortal } from "@/contexts/AdminPortalContext";
import { useSaveSiteSettings, useSiteSettings } from "@/hooks/useSiteSettings";
import { ImageManager } from "@/components/ui/image-manager";
import type { SiteSettingsInput } from "@shared/siteSettings";
import { PORTAL_META, type PortalId } from "@/lib/portal";

export function SiteSettingsAdmin() {
  const { toast } = useToast();
  const { filter, defaultPortal } = useAdminPortal();
  const portal = (filter === "all" ? defaultPortal : filter) as PortalId;
  const { data, isLoading } = useSiteSettings(portal);
  const saveMutation = useSaveSiteSettings(portal);

  const [form, setForm] = useState<SiteSettingsInput | null>(null);
  const [imgTarget, setImgTarget] = useState<
    "logoUrl" | "logoFooterUrl" | "popupImageUrl" | null
  >(null);

  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  if (isLoading || !form) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">Đang tải…</p>
    );
  }

  const set = (key: keyof SiteSettingsInput, value: string | boolean | number) => {
    setForm((p) => (p ? { ...p, [key]: value } : p));
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(form);
      toast({ title: "Đã lưu cấu hình" });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể lưu cấu hình.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Portal: <strong>{PORTAL_META[portal]?.label || PORTAL_META[portal]?.brand || portal}</strong>
        </p>
        <Button
          size="sm"
          disabled={saveMutation.isPending}
          onClick={() => void handleSave()}
        >
          <Save className="h-4 w-4 mr-1.5" />
          {saveMutation.isPending ? "Đang lưu…" : "Lưu cấu hình"}
        </Button>
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">Thông tin chung</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tên hiển thị</Label>
            <Input value={form.siteName} onChange={(e) => set("siteName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Hotline</Label>
            <Input value={form.hotline} onChange={(e) => set("hotline", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Địa chỉ</Label>
            <Textarea
              rows={2}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">Mạng xã hội</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["facebookUrl", "Facebook"],
              ["youtubeUrl", "YouTube"],
              ["zaloUrl", "Zalo"],
              ["linkedinUrl", "LinkedIn"],
              ["tiktokUrl", "TikTok"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <Input
                placeholder="https://…"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">Logo & liên kết pháp lý</h3>
        <p className="text-xs text-muted-foreground -mt-2">
          Nên upload logo lockup «Trí Nhân Academy» (nền trong suốt). Nếu để trống,
          site dùng biểu tượng sách + chữ Trí Nhân / Academy.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["logoUrl", "Logo header", "site-logo"],
              ["logoFooterUrl", "Logo footer", "site-logo-footer"],
            ] as const
          ).map(([field, label, imgType]) => (
            <div key={field} className="space-y-2 rounded-lg border p-3">
              <Label>{label}</Label>
              {form[field] ? (
                <img src={form[field]} alt="" className="h-12 object-contain" />
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setImgTarget(field)}
              >
                <Upload className="h-4 w-4 mr-1" /> Chọn ảnh
              </Button>
              <ImageManager
                isOpen={imgTarget === field}
                onClose={() => setImgTarget(null)}
                onImageUpdate={(url) => {
                  set(field, url);
                  setImgTarget(null);
                }}
                imageType={imgType}
                altText={label}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Link chính sách bảo mật</Label>
            <Input
              value={form.privacyUrl}
              onChange={(e) => set("privacyUrl", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Link điều khoản</Label>
            <Input value={form.termsUrl} onChange={(e) => set("termsUrl", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">Popup thông báo</h3>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.popupEnabled}
            onCheckedChange={(v) => set("popupEnabled", !!v)}
          />
          <Label>Bật popup khi vào trang</Label>
        </div>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Tiêu đề</Label>
            <Input
              value={form.popupTitle}
              onChange={(e) => set("popupTitle", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nội dung</Label>
            <Textarea
              rows={3}
              value={form.popupBody}
              onChange={(e) => set("popupBody", e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Link CTA</Label>
              <Input
                placeholder="https://…"
                value={form.popupLinkUrl}
                onChange={(e) => set("popupLinkUrl", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Delay (ms)</Label>
              <Input
                type="number"
                min={0}
                value={form.popupDelayMs}
                onChange={(e) => set("popupDelayMs", Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ảnh popup</Label>
            {form.popupImageUrl ? (
              <img
                src={form.popupImageUrl}
                alt=""
                className="max-h-32 rounded border object-cover"
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setImgTarget("popupImageUrl")}
            >
              <Upload className="h-4 w-4 mr-1" /> Chọn ảnh popup
            </Button>
            <ImageManager
              isOpen={imgTarget === "popupImageUrl"}
              onClose={() => setImgTarget(null)}
              onImageUpdate={(url) => {
                set("popupImageUrl", url);
                setImgTarget(null);
              }}
              imageType="site-popup"
              altText="Popup"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
