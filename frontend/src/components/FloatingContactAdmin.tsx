import { useEffect, useMemo, useState } from "react";
import { Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSaveSiteSettings,
  useSiteSettings,
  type SiteSettings,
} from "@/hooks/useSiteSettings";
import { ImageManager } from "@/components/ui/image-manager";
import type { SiteSettingsInput } from "@shared/siteSettings";
import {
  pickFloatWidgetFields,
  resolveFloatLinks,
} from "@/lib/floatContact";
import { apiFetch } from "@/lib/queryClient";

/** Cpanel controls for TNJS-style floating contact widgets (group-wide). */
export function FloatingContactAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useSiteSettings("group");
  const saveMutation = useSaveSiteSettings("group");
  const [form, setForm] = useState<SiteSettingsInput | null>(null);
  const [imgOpen, setImgOpen] = useState(false);

  useEffect(() => {
    if (data && form === null) setForm({ ...data });
  }, [data, form]);

  // After successful external refetch, soft-sync float preview fields if form pristine-ish
  useEffect(() => {
    if (!data || !form) return;
    // Keep local edits; only seed once via form===null above
  }, [data, form]);

  const preview = useMemo(() => {
    if (!form) return null;
    const links = resolveFloatLinks(form);
    const parts: string[] = [];
    if (form.floatWidgetsEnabled === false) {
      return "Đang tắt toàn bộ nút nổi.";
    }
    if (form.floatCtaEnabled !== false) parts.push("CTA trái");
    if (links.messenger) parts.push("Messenger");
    else if (form.floatMessengerEnabled !== false) {
      parts.push("Messenger (thiếu link)");
    }
    if (links.zalo) parts.push("Zalo");
    else if (form.floatZaloEnabled !== false) parts.push("Zalo (thiếu số/link)");
    if (links.call) parts.push("Gọi");
    else if (form.floatCallEnabled !== false) parts.push("Gọi (thiếu hotline)");
    return parts.length
      ? `Sẽ hiện: ${parts.join(" · ")}`
      : "Chưa có nút nào đủ cấu hình để hiện.";
  }, [form]);

  if (isLoading && !form) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">Đang tải…</p>
    );
  }
  if (!form) return null;

  const set = <K extends keyof SiteSettingsInput>(
    key: K,
    value: SiteSettingsInput[K],
  ) => {
    setForm((p) => (p ? { ...p, [key]: value } : p));
  };

  const handleSave = async () => {
    try {
      // Merge onto latest server row so we don't wipe popup/site fields edited elsewhere
      const res = await apiFetch("/api/site-settings?portal=group");
      const latest = (res.ok ? await res.json() : data) as SiteSettingsInput;
      const payload: SiteSettingsInput = {
        ...latest,
        ...pickFloatWidgetFields(form),
        hotline: form.hotline || "",
        zaloUrl: form.zaloUrl || "",
        facebookUrl: form.facebookUrl || "",
      };
      const saved = await saveMutation.mutateAsync(payload);
      setForm({ ...saved });
      void queryClient.invalidateQueries({
        queryKey: ["/api/site-settings"],
        refetchType: "active",
      });
      toast({ title: "Đã lưu nút liên hệ nổi" });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không lưu được cấu hình nút nổi.",
        variant: "destructive",
      });
    }
  };

  const masterOn = form.floatWidgetsEnabled !== false;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Nút liên hệ nổi (kiểu TNJS)</CardTitle>
            <CardDescription className="mt-1">
              Góc trái: ảnh + tư vấn. Góc phải: Messenger, Zalo, Gọi. Dùng chung
              toàn site.
            </CardDescription>
            {preview ? (
              <p className="mt-2 text-xs font-medium text-[#008A42]">{preview}</p>
            ) : null}
          </div>
          <Button
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => void handleSave()}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saveMutation.isPending ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={masterOn}
            onCheckedChange={(v) => set("floatWidgetsEnabled", !!v)}
          />
          <Label>Bật nút liên hệ nổi trên website</Label>
        </div>

        <fieldset
          disabled={!masterOn}
          className="space-y-6 disabled:opacity-55"
        >
          <section className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.floatCtaEnabled !== false}
                onCheckedChange={(v) => set("floatCtaEnabled", !!v)}
              />
              <Label className="font-medium">Góc trái — Tư vấn miễn phí</Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nhãn nút</Label>
                <Input
                  value={form.floatCtaLabel || ""}
                  onChange={(e) => set("floatCtaLabel", e.target.value)}
                  placeholder="Tư vấn miễn phí"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Link khi bấm</Label>
                <Input
                  value={form.floatCtaHref || ""}
                  onChange={(e) => set("floatCtaHref", e.target.value)}
                  placeholder="/#tu-van"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ảnh nhân vật (góc trái, tùy chọn)</Label>
              {form.floatCtaImageUrl ? (
                <img
                  src={form.floatCtaImageUrl}
                  alt=""
                  className="h-24 object-contain object-bottom"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  PNG nền trong suốt, nhân vật đứng từ mép dưới — trên mobile hẹp
                  ảnh tự ẩn, chỉ còn nút.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setImgOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-1" /> Chọn ảnh
                </Button>
                {form.floatCtaImageUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => set("floatCtaImageUrl", "")}
                  >
                    Gỡ ảnh
                  </Button>
                ) : null}
              </div>
              <ImageManager
                isOpen={imgOpen}
                onClose={() => setImgOpen(false)}
                onImageUpdate={(url) => {
                  set("floatCtaImageUrl", url);
                  setImgOpen(false);
                }}
                imageType="float-cta"
                altText="Ảnh CTA nổi"
                portal="group"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Góc phải — Messenger / Zalo / Gọi</p>
            <p className="text-xs text-muted-foreground -mt-1">
              Nút chỉ hiện khi đủ link/số tương ứng.
            </p>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.floatMessengerEnabled !== false}
                onCheckedChange={(v) => set("floatMessengerEnabled", !!v)}
              />
              <Label>Facebook Messenger</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Link Messenger (m.me/…)</Label>
              <Input
                value={form.floatMessengerUrl || ""}
                onChange={(e) => set("floatMessengerUrl", e.target.value)}
                placeholder="https://m.me/YourPage"
                disabled={form.floatMessengerEnabled === false}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Facebook page URL (dự phòng nếu thiếu m.me)</Label>
              <Input
                value={form.facebookUrl || ""}
                onChange={(e) => set("facebookUrl", e.target.value)}
                placeholder="https://www.facebook.com/YourPage"
                disabled={form.floatMessengerEnabled === false}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={form.floatZaloEnabled !== false}
                onCheckedChange={(v) => set("floatZaloEnabled", !!v)}
              />
              <Label>Zalo chat</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Link Zalo (hoặc số)</Label>
              <Input
                value={form.zaloUrl || ""}
                onChange={(e) => set("zaloUrl", e.target.value)}
                placeholder="https://zalo.me/09… — trống thì dùng hotline"
                disabled={form.floatZaloEnabled === false}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={form.floatCallEnabled !== false}
                onCheckedChange={(v) => set("floatCallEnabled", !!v)}
              />
              <Label>Nút gọi điện</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Hotline</Label>
              <Input
                value={form.hotline || ""}
                onChange={(e) => set("hotline", e.target.value)}
                placeholder="09xx xxx xxx"
                disabled={form.floatCallEnabled === false}
              />
            </div>
          </section>
        </fieldset>
      </CardContent>
    </Card>
  );
}

/** After float admin saves, allow re-seed of admin form from cache if needed. */
export function resetFloatingContactAdminForm(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const latest = queryClient.getQueryData<SiteSettings>([
    "/api/site-settings",
    "group",
  ]);
  return latest;
}
