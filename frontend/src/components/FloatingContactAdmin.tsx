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
import { useSaveSiteSettings, useSiteSettings } from "@/hooks/useSiteSettings";
import { ImageManager } from "@/components/ui/image-manager";
import type { SiteSettingsInput } from "@shared/siteSettings";
import {
  DEFAULT_FLOAT_CALL,
  DEFAULT_FLOAT_FACEBOOK,
  DEFAULT_FLOAT_MESSENGER,
  DEFAULT_FLOAT_ZALO,
  pickFloatWidgetFields,
  resolveFloatLinks,
} from "@/lib/floatContact";
import { apiFetch } from "@/lib/queryClient";

/** Cpanel: floating contact widgets (group-wide). */
export function FloatingContactAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useSiteSettings("group");
  const saveMutation = useSaveSiteSettings("group");
  const [form, setForm] = useState<SiteSettingsInput | null>(null);
  const [imgOpen, setImgOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  useEffect(() => {
    if (data && form === null) setForm({ ...data });
  }, [data, form]);

  const preview = useMemo(() => {
    if (!form) return null;
    if (form.floatWidgetsEnabled === false) {
      return "Đang tắt toàn bộ nút nổi.";
    }
    const links = resolveFloatLinks(form);
    const parts: string[] = [];
    if (form.floatCtaEnabled !== false) {
      parts.push(
        form.floatCtaImageUrl?.trim()
          ? "CTA trái (ảnh đã upload)"
          : "CTA trái (ảnh mặc định)",
      );
    }
    if (form.floatMessengerEnabled !== false && links.messenger) {
      parts.push(
        form.floatMessengerUrl?.trim() || form.facebookUrl?.trim()
          ? "Messenger"
          : "Messenger (mặc định)",
      );
    }
    if (form.floatZaloEnabled !== false && links.zalo) {
      parts.push(form.zaloUrl?.trim() ? "Zalo" : "Zalo (mặc định)");
    }
    if (form.floatCallEnabled !== false && links.call) {
      parts.push(form.hotline?.trim() ? "Gọi" : "Gọi (mặc định)");
    }
    return parts.length
      ? `Sẽ hiện: ${parts.join(" · ")}`
      : "Chưa có nút nào được bật.";
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

  /** Merge float fields onto latest hub settings and persist. */
  const persist = async (
    nextForm: SiteSettingsInput,
    okTitle = "Đã lưu nút liên hệ nổi",
  ) => {
    const res = await apiFetch("/api/site-settings?portal=group");
    const latest = (res.ok ? await res.json() : data) as SiteSettingsInput;
    const payload: SiteSettingsInput = {
      ...latest,
      ...pickFloatWidgetFields(nextForm),
      hotline: nextForm.hotline || "",
      zaloUrl: nextForm.zaloUrl || "",
      facebookUrl: nextForm.facebookUrl || "",
    };
    const saved = await saveMutation.mutateAsync(payload);
    setForm({ ...saved });
    void queryClient.invalidateQueries({
      queryKey: ["/api/site-settings"],
      refetchType: "active",
    });
    toast({ title: okTitle });
    return saved;
  };

  const handleSave = async () => {
    try {
      await persist(form);
    } catch {
      toast({
        title: "Lỗi",
        description: "Không lưu được cấu hình nút nổi.",
        variant: "destructive",
      });
    }
  };

  const applyCtaImage = async (url: string) => {
    const next = { ...form, floatCtaImageUrl: url };
    setForm(next);
    setImgOpen(false);
    setImageBusy(true);
    try {
      await persist(
        next,
        url ? "Đã upload ảnh và lưu cấu hình" : "Đã gỡ ảnh — dùng ảnh mặc định",
      );
    } catch {
      toast({
        title: "Lỗi",
        description:
          "Ảnh đã lên R2 nhưng chưa lưu được cấu hình. Bấm «Lưu» lại.",
        variant: "destructive",
      });
    } finally {
      setImageBusy(false);
    }
  };

  const masterOn = form.floatWidgetsEnabled !== false;
  const busy = saveMutation.isPending || imageBusy;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Nút liên hệ nổi</CardTitle>
            <CardDescription className="mt-1">
              Góc trái: ảnh + tư vấn. Góc phải: Messenger, Zalo, Gọi. Dùng chung
              toàn site. Ảnh CTA tự lưu ngay sau khi upload lên R2.
            </CardDescription>
            {preview ? (
              <p className="mt-2 text-xs font-medium text-[#008A42]">{preview}</p>
            ) : null}
          </div>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void handleSave()}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {busy ? "Đang lưu…" : "Lưu"}
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
          disabled={!masterOn || busy}
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
              <Label>Ảnh nhân vật (góc trái)</Label>
              {form.floatCtaImageUrl ? (
                <div className="space-y-1">
                  <img
                    src={form.floatCtaImageUrl}
                    alt=""
                    className="h-24 object-contain object-bottom"
                  />
                  <p className="text-[11px] text-muted-foreground break-all">
                    {form.floatCtaImageUrl}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Đang dùng ảnh mặc định. Upload PNG nền trong suốt để thay
                    (tự lưu sau upload).
                  </p>
                  <img
                    src="/brand/float-cta-mascot.png"
                    alt=""
                    className="h-24 object-contain object-bottom opacity-90"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setImgOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-1" />{" "}
                  {imageBusy ? "Đang xử lý…" : "Chọn ảnh"}
                </Button>
                {form.floatCtaImageUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void applyCtaImage("")}
                  >
                    Gỡ ảnh
                  </Button>
                ) : null}
              </div>
              <ImageManager
                isOpen={imgOpen}
                onClose={() => setImgOpen(false)}
                onImageUpdate={(url) => {
                  void applyCtaImage(url);
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
              Để trống sẽ dùng số/link mặc định thương hiệu. Điền rồi bấm Lưu để
              ghi đè.
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
                placeholder={DEFAULT_FLOAT_MESSENGER}
                disabled={form.floatMessengerEnabled === false}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Facebook page URL (dự phòng nếu thiếu m.me)</Label>
              <Input
                value={form.facebookUrl || ""}
                onChange={(e) => set("facebookUrl", e.target.value)}
                placeholder={DEFAULT_FLOAT_FACEBOOK}
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
                placeholder={DEFAULT_FLOAT_ZALO}
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
                placeholder={DEFAULT_FLOAT_CALL}
                disabled={form.floatCallEnabled === false}
              />
            </div>
          </section>
        </fieldset>
      </CardContent>
    </Card>
  );
}
