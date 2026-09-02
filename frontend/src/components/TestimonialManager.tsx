import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Star, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageManager } from "@/components/ui/image-manager";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { useAdminPortal } from "@/contexts/AdminPortalContext";
import { portalBadgeLabel } from "@/components/AdminPortalFilter";
import { PORTAL_IDS, type PortalId } from "@/lib/portal";
import type { Testimonial } from "@shared/schema";

type FormState = {
  name: string;
  role: string;
  content: string;
  avatarUrl: string;
  rating: number;
  displayOrder: number;
  isActive: boolean;
  portal: PortalId;
};

const emptyForm = (portal: PortalId): FormState => ({
  name: "",
  role: "",
  content: "",
  avatarUrl: "",
  rating: 5,
  displayOrder: 0,
  isActive: true,
  portal,
});

export function TestimonialManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { listQuery, defaultPortal } = useAdminPortal();

  const [open, setOpen] = useState(false);
  const [showAvatarManager, setShowAvatarManager] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultPortal));

  const { data: testimonials = [], isLoading } = useQuery<Testimonial[]>({
    queryKey: ["/api/testimonials", "admin", listQuery],
    queryFn: async () => {
      const res = await apiFetch(`/api/testimonials?${listQuery}`);
      if (!res.ok) throw new Error("Failed to load testimonials");
      return res.json();
    },
  });

  useEffect(() => {
    if (!open) setForm(emptyForm(defaultPortal));
  }, [defaultPortal, open]);

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      if (editing) {
        const res = await apiRequest("PUT", `/api/testimonials/${editing.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/testimonials", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/testimonials"] });
      toast({ title: editing ? "Đã cập nhật phản hồi" : "Đã thêm phản hồi" });
      setOpen(false);
      setEditing(null);
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể lưu phản hồi.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/testimonials/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/testimonials"] });
      toast({ title: "Đã xóa phản hồi" });
    },
  });

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm(defaultPortal));
    setOpen(true);
  };

  const startEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({
      name: t.name,
      role: t.role,
      content: t.content,
      avatarUrl: t.avatarUrl || "",
      rating: t.rating ?? 5,
      displayOrder: t.displayOrder ?? 0,
      isActive: t.isActive ?? true,
      portal: (t.portal as PortalId) || defaultPortal,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Quản lý ý kiến khách hàng hiển thị trên trang chủ và các trang dịch vụ.
        </p>
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Thêm phản hồi
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Đang tải…</p>
      ) : testimonials.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
          Chưa có phản hồi nào.
        </p>
      ) : (
        <ul className="space-y-3">
          {testimonials.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-start gap-3 rounded-lg border bg-white p-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{t.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {portalBadgeLabel(t.portal as PortalId)}
                  </Badge>
                  {!t.isActive ? (
                    <Badge variant="secondary" className="text-xs">
                      Ẩn
                    </Badge>
                  ) : null}
                  <span className="inline-flex items-center text-xs text-amber-600">
                    <Star className="h-3 w-3 fill-current mr-0.5" />
                    {t.rating ?? 5}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t.role}</p>
                <p className="text-sm text-neutral-700 mt-2 line-clamp-3">{t.content}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => startEdit(t)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm("Xóa phản hồi này?")) {
                      deleteMutation.mutate(t.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Sửa phản hồi" : "Thêm phản hồi"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Họ tên</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Portal</Label>
                <Select
                  value={form.portal}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, portal: v as PortalId }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PORTAL_IDS.map((id) => (
                      <SelectItem key={id} value={id}>
                        {portalBadgeLabel(id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Vai trò / mô tả</Label>
              <Input
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nội dung</Label>
              <Textarea
                rows={4}
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ảnh đại diện (tuỳ chọn)</Label>
              <div className="flex flex-wrap items-center gap-3">
                {form.avatarUrl ? (
                  <img
                    src={form.avatarUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover border"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    Chưa có
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAvatarManager(true)}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {form.avatarUrl ? "Đổi ảnh" : "Tải ảnh"}
                </Button>
                {form.avatarUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setForm((p) => ({ ...p, avatarUrl: "" }))}
                  >
                    Xóa ảnh
                  </Button>
                ) : null}
              </div>
              <ImageManager
                isOpen={showAvatarManager}
                onClose={() => setShowAvatarManager(false)}
                onImageUpdate={(url) => {
                  setForm((p) => ({ ...p, avatarUrl: url }));
                  setShowAvatarManager(false);
                }}
                imageType="testimonial"
                altText={`${form.name || "Khách hàng"} avatar`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Điểm (1–5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.rating}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, rating: Number(e.target.value) || 5 }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Thứ tự hiển thị</Label>
                <Input
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      displayOrder: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: !!v }))}
              />
              <Label>Hiển thị trên web</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={!form.name || !form.content || saveMutation.isPending}
              onClick={() => saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
