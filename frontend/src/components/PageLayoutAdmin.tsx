import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  LayoutTemplate,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  usePageLayout,
  useResetPageLayout,
  useSavePageLayout,
} from "@/hooks/usePageLayout";
import {
  LAYOUT_PAGES,
  LAYOUT_PAGE_LABELS,
  PAGE_SECTION_WHITELIST,
  SECTION_META,
  collectImageTypesFromSections,
  createSection,
  type LayoutPageId,
  type PageSection,
  type SectionType,
} from "@shared/pageSections";
import { BlockImageSlot, HeroBlockImageSlots } from "@/components/BlockImageSlot";
import { ImageManager } from "@/components/ui/image-manager";

function cloneSections(sections: PageSection[]): PageSection[] {
  return sections.map((s) => ({
    ...s,
    props: { ...s.props },
  }));
}

export function PageLayoutAdmin({
  pageId: controlledPageId,
  layoutKey: controlledLayoutKey,
  sectionTemplate,
  portal: controlledPortal,
  pageLabel,
  hidePageSelector = false,
  onDirtyChange,
}: {
  pageId?: LayoutPageId;
  /** Custom cms page id — overrides pageId for page_layouts lookup */
  layoutKey?: string;
  /** Whitelist source when layoutKey is a custom page */
  sectionTemplate?: LayoutPageId;
  /** Portal scope for DB row */
  portal?: string;
  pageLabel?: string;
  hidePageSelector?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
} = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState<LayoutPageId>(controlledPageId || "group");
  const effectiveLayoutKey =
    controlledLayoutKey || controlledPageId || page;
  const whitelistSource: LayoutPageId =
    sectionTemplate ||
    (controlledPageId || (page as LayoutPageId));
  const effectivePortal = controlledPortal || controlledPageId || page;
  const { data, isLoading, isError } = usePageLayout(
    effectiveLayoutKey,
    effectivePortal,
  );
  const saveMutation = useSavePageLayout();
  const resetMutation = useResetPageLayout();

  const [sections, setSections] = useState<PageSection[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [imageEdit, setImageEdit] = useState<{
    imageType: string;
    label: string;
  } | null>(null);
  const layoutKeyRef = useRef(`${effectiveLayoutKey}:${effectivePortal}`);

  useEffect(() => {
    if (controlledPageId) setPage(controlledPageId);
  }, [controlledPageId]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!data?.sections) return;
    const layoutKey = `${effectiveLayoutKey}:${effectivePortal}`;
    const pageChanged = layoutKeyRef.current !== layoutKey;
    if (pageChanged || !dirty) {
      setSections(cloneSections(data.sections));
      setDirty(false);
      layoutKeyRef.current = layoutKey;
    }
  }, [data, effectiveLayoutKey, effectivePortal, dirty]);

  const editing = sections.find((s) => s.id === editId) || null;
  const whitelist = PAGE_SECTION_WHITELIST[whitelistSource] || [];

  const updateLocal = (next: PageSection[]) => {
    setSections(next.map((s, i) => ({ ...s, sortOrder: i })));
    setDirty(true);
  };

  const confirmDiscard = () => {
    if (!dirty) return true;
    return confirm(
      "Bạn có thay đổi chưa lưu. Chuyển trang sẽ mất các chỉnh sửa này. Tiếp tục?",
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[index], next[j]] = [next[j], next[index]];
    updateLocal(next);
  };

  const toggle = (id: string) => {
    updateLocal(
      sections.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s,
      ),
    );
  };

  const remove = (id: string) => {
    const section = sections.find((s) => s.id === id);
    if (section) {
      const slots = collectImageTypesFromSections([section]);
      if (slots.length > 0) {
        const preview =
          slots.length <= 3
            ? slots.join(", ")
            : `${slots.slice(0, 3).join(", ")}… (+${slots.length - 3})`;
        if (
          !confirm(
            `Xóa khối này khỏi trang?\n\nẢnh CMS (${preview}) vẫn giữ trên R2/DB — chỉ gỡ khối. Bấm "Lưu" để áp dụng.`,
          )
        ) {
          return;
        }
      }
    }
    updateLocal(sections.filter((s) => s.id !== id));
    if (editId === id) setEditId(null);
  };

  const addType = (type: SectionType) => {
    const newSection = createSection(
      type,
      undefined,
      sections.length,
      whitelistSource,
    );
    updateLocal([...sections, newSection]);
    setAddOpen(false);
    setEditId(newSection.id);
  };

  const patchProps = (id: string, props: Record<string, unknown>) => {
    updateLocal(
      sections.map((s) => (s.id === id ? { ...s, props } : s)),
    );
  };

  const handleSave = async () => {
    const enabledCount = sections.filter((s) => s.enabled !== false).length;
    if (enabledCount === 0) {
      if (
        !confirm(
          "Không có khối nào đang bật — trang public sẽ trống. Vẫn lưu?",
        )
      ) {
        return;
      }
    }
    const wasDefault = data?.isDefault;
    try {
      await saveMutation.mutateAsync({
        page: effectiveLayoutKey,
        portal: effectivePortal,
        sections,
      });
      setDirty(false);
      toast({
        title: wasDefault
          ? "Đã lưu lần đầu — trang public dùng bố cục này"
          : "Đã lưu khối nội dung",
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Không thể lưu. Vui lòng thử lại.";
      toast({
        title: "Lưu thất bại",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Đặt lại khối mặc định cho trang này? Thay đổi chưa lưu sẽ mất.",
      )
    ) {
      return;
    }
    try {
      const result = await resetMutation.mutateAsync({
        page: effectiveLayoutKey,
        portal: effectivePortal,
      });
      setSections(cloneSections(result.sections));
      setDirty(false);
      layoutKeyRef.current = `${effectiveLayoutKey}:${effectivePortal}`;
      toast({ title: "Đã đặt lại khối mặc định" });
    } catch {
      toast({ title: "Không đặt lại được", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        {!hidePageSelector ? (
          <div className="space-y-2 max-w-sm w-full">
            <Label>Trang</Label>
            <Select
              value={page}
              onValueChange={(v) => {
                if (!confirmDiscard()) return;
                setPage(v as LayoutPageId);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_PAGES.map((id) => (
                  <SelectItem key={id} value={id}>
                    {LAYOUT_PAGE_LABELS[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Thêm / ẩn / sắp xếp khối nội dung. Trang công khai render theo danh
              sách này.
              {data?.isDefault ? " (đang dùng mặc định — chưa lưu DB)" : ""}
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-1">
            {pageLabel ? (
              <p className="text-sm font-medium text-neutral-800">{pageLabel}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Thêm / ẩn / sắp xếp khối. Ảnh chỉnh trong từng khối (Hero, Thẻ liên kết…).
              {data?.isDefault ? " (đang dùng mặc định — chưa lưu DB)" : ""}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Thêm khối
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Mặc định
          </Button>
          <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" />
            Lưu{dirty ? " *" : ""}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Không tải được khối nội dung. Thử tải lại trang.
        </p>
      ) : sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có khối. Bấm “Thêm khối” hoặc “Mặc định”.
        </p>
      ) : (
        <ul className="space-y-2">
          {sections.map((section, index) => (
            <li
              key={section.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border bg-white px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setEditId(section.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEditId(section.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <LayoutTemplate className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {SECTION_META[section.type]?.label || section.type}
                  {!section.enabled ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (ẩn)
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {String(section.props.title || section.props.brandName || section.id)}
                </p>
              </div>
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Lên"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => move(index, 1)}
                  disabled={index === sections.length - 1}
                  aria-label="Xuống"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => toggle(section.id)}
                  aria-label={section.enabled ? "Ẩn" : "Hiện"}
                >
                  {section.enabled ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditId(section.id)}
                >
                  Sửa
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(section.id)}
                  aria-label="Xóa"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-[min(720px,calc(100vw-2rem))] max-w-none max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thêm khối</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2 sm:grid-cols-2">
            {whitelist.map((type) => (
              <button
                key={type}
                type="button"
                className="text-left rounded-lg border px-3 py-2 hover:bg-muted/60 transition-colors"
                onClick={() => addType(type)}
              >
                <p className="text-sm font-medium">{SECTION_META[type].label}</p>
                <p className="text-xs text-muted-foreground">
                  {SECTION_META[type].description}
                </p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[min(960px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
            <DialogTitle>
              Sửa — {editing ? SECTION_META[editing.type].label : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {editing ? (
            <SectionPropsForm
              section={editing}
              portal={effectivePortal}
              onImageEdit={setImageEdit}
              onChange={(props) => patchProps(editing.id, props)}
            />
          ) : null}
          </div>
          <DialogFooter className="shrink-0 flex-col gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row">
            <p className="text-xs text-muted-foreground sm:mr-auto">
              {dirty ? (
                <>
                  Nhớ bấm &quot;Lưu&quot; để áp dụng nội dung khối. Ảnh lưu ngay khi upload.
                  Xóa khối không xóa file R2.
                </>
              ) : (
                <>
                  Ảnh cập nhật ngay lên website. Xóa khối/trang tùy chỉnh xử lý ảnh khác
                  nhau — xem ghi chú khi xóa.
                </>
              )}
            </p>
            <Button onClick={() => setEditId(null)}>Xong</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {imageEdit ? (
        <ImageManager
          isOpen
          onClose={() => setImageEdit(null)}
          imageType={imageEdit.imageType}
          altText={imageEdit.label}
          portal={effectivePortal}
          onImageUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/ui-images"] });
            setImageEdit(null);
            toast({ title: "Đã cập nhật ảnh — hiển thị ngay trên trang public" });
          }}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function SectionPropsForm({
  section,
  portal,
  onImageEdit,
  onChange,
}: {
  section: PageSection;
  portal: string;
  onImageEdit?: (slot: { imageType: string; label: string }) => void;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const p = section.props;
  const set = (key: string, value: unknown) =>
    onChange({ ...p, [key]: value });

  if (section.type === "hero") {
    return (
      <div className="space-y-4 py-1">
        <Field label="Thương hiệu">
          <Input
            value={String(p.brandName ?? "")}
            onChange={(e) => set("brandName", e.target.value)}
          />
        </Field>
        <Field label="Tiêu đề">
          <Textarea
            value={String(p.title ?? "")}
            onChange={(e) => set("title", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Mô tả">
          <Textarea
            value={String(p.description ?? "")}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Prefix ảnh hero">
          <Input
            value={String(p.imageTypePrefix ?? "")}
            onChange={(e) => set("imageTypePrefix", e.target.value)}
            placeholder="vd. group, exam, huongnghiep"
          />
        </Field>
        <HeroBlockImageSlots
          prefix={String(p.imageTypePrefix ?? "group")}
          portal={portal}
          onRequestEdit={onImageEdit}
        />
        <Field label="CTA chính — chữ">
          <Input
            value={String(p.ctaPrimaryLabel ?? "")}
            onChange={(e) => set("ctaPrimaryLabel", e.target.value)}
          />
        </Field>
        <Field label="CTA chính — link">
          <Input
            value={String(p.ctaPrimaryHref ?? "")}
            onChange={(e) => set("ctaPrimaryHref", e.target.value)}
          />
        </Field>
        <Field label="CTA phụ — chữ">
          <Input
            value={String(p.ctaSecondaryLabel ?? "")}
            onChange={(e) => set("ctaSecondaryLabel", e.target.value)}
          />
        </Field>
        <Field label="CTA phụ — link">
          <Input
            value={String(p.ctaSecondaryHref ?? "")}
            onChange={(e) => set("ctaSecondaryHref", e.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (section.type === "rich_text") {
    return (
      <div className="space-y-4 py-1">
        <Field label="Tiêu đề">
          <Input
            value={String(p.title ?? "")}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Nội dung">
          <Textarea
            value={String(p.body ?? "")}
            onChange={(e) => set("body", e.target.value)}
            rows={6}
          />
        </Field>
        <Field label="Mã ảnh minh họa (để trống = không hiện ảnh)">
          <Input
            value={String(p.imageType ?? "")}
            onChange={(e) => set("imageType", e.target.value)}
            placeholder="vd. group-pillar-0"
          />
        </Field>
        {String(p.imageType ?? "").trim() ? (
          <BlockImageSlot
            imageType={String(p.imageType)}
            label="Ảnh minh họa"
            portal={portal}
            onRequestEdit={onImageEdit}
          />
        ) : null}
      </div>
    );
  }

  if (section.type === "feature_grid" || section.type === "cards") {
    const items = Array.isArray(p.items) ? [...p.items] : [];
    const isCards = section.type === "cards";
    return (
      <div className="space-y-4 py-1">
        <Field label="Tiêu đề">
          <Input
            value={String(p.title ?? "")}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Mô tả">
          <Textarea
            value={String(p.description ?? "")}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
          />
        </Field>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Các mục</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                set(
                  "items",
                  [
                    ...items,
                    isCards
                      ? {
                          label: "",
                          title: "Mục mới",
                          description: "",
                          cta: "Xem thêm",
                          href: "/contact",
                          imageType: "",
                        }
                      : { title: "Điểm mới", body: "" },
                  ],
                )
              }
            >
              <Plus className="h-3 w-3 mr-1" />
              Thêm mục
            </Button>
          </div>
          {items.map((raw, i) => {
            const item =
              raw && typeof raw === "object"
                ? { ...(raw as Record<string, unknown>) }
                : {};
            const updateItem = (patch: Record<string, unknown>) => {
              const next = [...items];
              next[i] = { ...item, ...patch };
              set("items", next);
            };
            return (
              <div key={i} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">#{i + 1}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const next = items.filter((_, j) => j !== i);
                      set("items", next);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {isCards ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Nhãn"
                      value={String(item.label ?? "")}
                      onChange={(e) => updateItem({ label: e.target.value })}
                    />
                    <Input
                      placeholder="Tiêu đề"
                      value={String(item.title ?? "")}
                      onChange={(e) => updateItem({ title: e.target.value })}
                    />
                    <Textarea
                      placeholder="Mô tả"
                      className="sm:col-span-2"
                      value={String(item.description ?? "")}
                      onChange={(e) =>
                        updateItem({ description: e.target.value })
                      }
                      rows={3}
                    />
                    <Input
                      placeholder="CTA"
                      value={String(item.cta ?? "")}
                      onChange={(e) => updateItem({ cta: e.target.value })}
                    />
                    <Input
                      placeholder="Link nội bộ, https://… hoặc portal:huongnghiep:/"
                      value={String(item.href ?? "")}
                      onChange={(e) => updateItem({ href: e.target.value })}
                    />
                    <Input
                      placeholder="Mã ảnh CMS"
                      className="sm:col-span-2"
                      value={String(item.imageType ?? "")}
                      onChange={(e) =>
                        updateItem({ imageType: e.target.value })
                      }
                    />
                    {String(item.imageType ?? "").trim() ? (
                      <div className="sm:col-span-2">
                        <BlockImageSlot
                          imageType={String(item.imageType)}
                          label={String(item.title || item.label || `Mục ${i + 1}`)}
                          portal={portal}
                          compact
                          onRequestEdit={onImageEdit}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Tiêu đề"
                      value={String(item.title ?? "")}
                      onChange={(e) => updateItem({ title: e.target.value })}
                    />
                    <Textarea
                      placeholder="Mô tả"
                      value={String(item.body ?? "")}
                      onChange={(e) => updateItem({ body: e.target.value })}
                      rows={2}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (section.type === "testimonials") {
    return (
      <div className="space-y-4 py-1">
        <Field label="Tiêu đề">
          <Input
            value={String(p.title ?? "")}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Mô tả">
          <Textarea
            value={String(p.description ?? "")}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Số lượng hiển thị">
          <Input
            type="number"
            min={1}
            max={12}
            value={Number(p.limit ?? 3)}
            onChange={(e) => set("limit", Number(e.target.value) || 3)}
          />
        </Field>
      </div>
    );
  }

  if (section.type === "articles") {
    return (
      <div className="space-y-4 py-1">
        <Field label="Tiêu đề">
          <Input
            value={String(p.title ?? "")}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Mô tả">
          <Input
            value={String(p.description ?? "")}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <Field label="Chuyên mục bài viết">
          <Input
            value={String(p.category ?? "")}
            onChange={(e) => set("category", e.target.value)}
            placeholder="general, japanese-training, …"
          />
        </Field>
      </div>
    );
  }

  if (section.type === "cta_form") {
    return (
      <div className="space-y-4 py-1">
        <Field label="Tiêu đề">
          <Input
            value={String(p.title ?? "")}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Mô tả">
          <Textarea
            value={String(p.description ?? "")}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Dịch vụ mặc định trong form (để trống = không chọn sẵn)">
          <Input
            value={String(p.defaultService ?? "")}
            onChange={(e) => set("defaultService", e.target.value)}
            placeholder="online-exam, visa, …"
          />
        </Field>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground py-4">
      Không có form cho loại này.
    </p>
  );
}
