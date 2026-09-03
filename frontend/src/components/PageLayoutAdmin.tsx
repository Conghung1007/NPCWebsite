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
  LAYOUT_PAGE_IMAGE_PREFIX,
  PAGE_SECTION_WHITELIST,
  SECTION_META,
  collectImageTypesFromSections,
  createSection,
  isLayoutPageId,
  type LayoutPageId,
  type PageSection,
  type SectionType,
} from "@shared/pageSections";
import { BlockImageSlot, HeroBlockImageSlots } from "@/components/BlockImageSlot";
import { ImageManager } from "@/components/ui/image-manager";
import { Switch } from "@/components/ui/switch";
import { CONTACT_SERVICES_BY_PORTAL } from "@/components/ui/contact-form";
import { isPortalId, type PortalId } from "@/lib/portal";

const ARTICLE_CATEGORIES = [
  { value: "visa-services", label: "Dịch vụ visa" },
  { value: "study-abroad", label: "Tư vấn du học" },
  { value: "japanese-training", label: "Đào tạo tiếng Nhật" },
  { value: "soft-skills", label: "Kỹ năng mềm" },
] as const;

const HERO_PREFIX_PRESETS = [
  { value: "group", label: "group" },
  { value: "huongnghiep", label: "huongnghiep" },
  { value: "dichvu", label: "dichvu" },
  { value: "exam", label: "exam (luyện thi)" },
  { value: "japanese", label: "japanese" },
] as const;

function clampInt(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sectionSummary(section: PageSection): string {
  const p = section.props;
  const title = String(p.title || p.brandName || "").trim();
  switch (section.type) {
    case "hero": {
      const brand = String(p.brandName || "").trim();
      const prefix = String(p.imageTypePrefix || "").trim();
      return [brand, title, prefix ? `ảnh: ${prefix}-*` : null]
        .filter(Boolean)
        .join(" · ");
    }
    case "feature_grid":
    case "cards": {
      const n = Array.isArray(p.items) ? p.items.length : 0;
      return [title, `${n} mục`].filter(Boolean).join(" · ");
    }
    case "testimonials": {
      const limit =
        typeof p.limit === "number" && Number.isFinite(p.limit)
          ? p.limit
          : 3;
      return [title, `tối đa ${limit}`].filter(Boolean).join(" · ");
    }
    case "articles": {
      const cat = String(p.category || "").trim();
      const label =
        ARTICLE_CATEGORIES.find((c) => c.value === cat)?.label || cat;
      return [title, label].filter(Boolean).join(" · ");
    }
    case "cta_form": {
      const svc = String(p.defaultService || "").trim();
      return [title, svc ? `DV: ${svc}` : "không chọn sẵn DV"]
        .filter(Boolean)
        .join(" · ");
    }
    case "exam_packages": {
      const align = String(p.align || "center");
      const guide = p.showAccessGuide === false ? "ẩn hướng dẫn" : "có hướng dẫn";
      return [title, align, guide].filter(Boolean).join(" · ");
    }
    case "exam_list": {
      const align = String(p.align || "center");
      return [title, `căn ${align}`].filter(Boolean).join(" · ");
    }
    default:
      return title || section.id;
  }
}

function cloneSections(sections: PageSection[]): PageSection[] {
  return sections.map((s) => ({
    ...s,
    props: {
      ...s.props,
      items: Array.isArray(s.props.items)
        ? s.props.items.map((item) =>
            item && typeof item === "object"
              ? { ...(item as Record<string, unknown>) }
              : item,
          )
        : s.props.items,
    },
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
  const [editIdBeforeImage, setEditIdBeforeImage] = useState<string | null>(
    null,
  );
  const layoutKeyRef = useRef(`${effectiveLayoutKey}:${effectivePortal}`);
  const layoutReady =
    !isLoading &&
    !isError &&
    layoutKeyRef.current === `${effectiveLayoutKey}:${effectivePortal}` &&
    !!data;

  useEffect(() => {
    if (controlledPageId) setPage(controlledPageId);
  }, [controlledPageId]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Clear stale sections immediately when switching page/portal key
  useEffect(() => {
    const layoutKey = `${effectiveLayoutKey}:${effectivePortal}`;
    if (layoutKeyRef.current === layoutKey) return;
    layoutKeyRef.current = layoutKey;
    setDirty(false);
    setEditId(null);
    setSections([]);
  }, [effectiveLayoutKey, effectivePortal]);

  useEffect(() => {
    if (!data?.sections) return;
    const layoutKey = `${effectiveLayoutKey}:${effectivePortal}`;
    if (layoutKeyRef.current !== layoutKey) return;
    if (!dirty) {
      setSections(cloneSections(data.sections));
    }
  }, [data, effectiveLayoutKey, effectivePortal, dirty]);

  const editing = sections.find((s) => s.id === editId) || null;
  const whitelist = PAGE_SECTION_WHITELIST[whitelistSource] || [];
  const busy = saveMutation.isPending || resetMutation.isPending;
  const isCustomLayout = !!(controlledLayoutKey && !controlledPageId);

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
    const label =
      SECTION_META[section?.type || "hero"]?.label || section?.type || "khối";
    const slots = section ? collectImageTypesFromSections([section]) : [];
    const imgNote =
      slots.length > 0
        ? `\n\nẢnh CMS (${slots.length <= 3 ? slots.join(", ") : `${slots.slice(0, 3).join(", ")}…`}) vẫn giữ trên R2/DB — chỉ gỡ khối.`
        : "";
    if (
      !confirm(
        `Xóa khối "${label}" khỏi trang?${imgNote}\n\nBấm "Lưu" sau đó để áp dụng trên website.`,
      )
    ) {
      return;
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

  const handleSave = async (): Promise<boolean> => {
    if (!layoutReady || busy) return false;
    const enabledCount = sections.filter((s) => s.enabled !== false).length;
    if (enabledCount === 0) {
      if (
        !confirm(
          "Không có khối nào đang bật — trang public sẽ trống. Vẫn lưu?",
        )
      ) {
        return false;
      }
    }
    const wasDefault = data?.isDefault;
    const sentCount = sections.length;
    try {
      const saved = await saveMutation.mutateAsync({
        page: effectiveLayoutKey,
        portal: effectivePortal,
        sections,
      });
      setSections(cloneSections(saved.sections));
      setDirty(false);
      const dropped = sentCount - saved.sections.length;
      toast({
        title: wasDefault
          ? "Đã lưu lần đầu — trang public dùng bố cục này"
          : "Đã lưu khối nội dung",
        description:
          dropped > 0
            ? `${dropped} khối không thuộc trang này đã bị bỏ khi lưu.`
            : undefined,
        variant: dropped > 0 ? "destructive" : undefined,
      });
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Không thể lưu. Vui lòng thử lại.";
      toast({
        title: "Lưu thất bại",
        description: msg,
        variant: "destructive",
      });
      return false;
    }
  };

  const handleSaveAndCloseEdit = async () => {
    const ok = await handleSave();
    if (ok) setEditId(null);
  };

  const handleCloseEdit = () => {
    if (
      dirty &&
      !confirm(
        "Có thay đổi chưa lưu. Đóng cửa sổ sửa? (Bấm Lưu trên thanh công cụ để áp dụng lên website.)",
      )
    ) {
      return;
    }
    setEditId(null);
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Đặt lại khối mẫu cho trang này? Thay đổi chưa lưu sẽ mất.",
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
      setEditId(null);
      layoutKeyRef.current = `${effectiveLayoutKey}:${effectivePortal}`;
      toast({
        title: "Đã đặt lại khối mẫu",
        description: isCustomLayout
          ? "Trang tùy chỉnh: Hero + nội dung chữ. Thêm khối khác nếu cần."
          : undefined,
      });
    } catch (err) {
      toast({
        title: "Không đặt lại được",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
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
              Đổi thứ tự bằng nút ↑ ↓ bên phải mỗi khối, rồi bấm{" "}
              <strong>Lưu</strong>. Trang công khai hiển thị theo thứ tự này.
              {data?.isDefault ? " (đang dùng mặc định — chưa lưu DB)" : ""}
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-1">
            {pageLabel ? (
              <p className="text-sm font-medium text-neutral-800">{pageLabel}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Đổi thứ tự bằng ↑ ↓ → bấm <strong>Lưu</strong>. Ảnh chỉnh trong từng
              khối (Hero, Thẻ liên kết…).
              {data?.isDefault ? " (đang dùng mặc định — chưa lưu DB)" : ""}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setAddOpen(true)}
            disabled={!layoutReady || busy}
          >
            <Plus className="h-4 w-4 mr-1" />
            Thêm khối
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!layoutReady || busy}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Mẫu hệ thống
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!dirty || !layoutReady || busy}
          >
            <Save className="h-4 w-4 mr-1" />
            {saveMutation.isPending ? "Đang lưu…" : `Lưu${dirty ? " *" : ""}`}
          </Button>
        </div>
      </div>

      {!layoutReady && isLoading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Không tải được khối nội dung. Thử tải lại trang.
        </p>
      ) : !layoutReady ? (
        <p className="text-sm text-muted-foreground">Đang tải bố cục…</p>
      ) : sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có khối. Bấm “Thêm khối” hoặc “Mẫu hệ thống”.
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
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-xs font-bold tabular-nums text-neutral-600"
                title={`Thứ tự ${index + 1}`}
              >
                {index + 1}
              </span>
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
                  {sectionSummary(section) || section.id}
                </p>
              </div>
              <div
                className="flex items-center gap-0.5 rounded-md border bg-neutral-50 p-0.5"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                title="Đổi thứ tự khối"
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Đưa khối lên trên"
                  title="Đưa lên"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => move(index, 1)}
                  disabled={index === sections.length - 1}
                  aria-label="Đưa khối xuống dưới"
                  title="Đưa xuống"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => toggle(section.id)}
                  aria-label={section.enabled ? "Ẩn" : "Hiện"}
                  title={section.enabled ? "Ẩn khối" : "Hiện khối"}
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
                  className="h-8"
                  onClick={() => setEditId(section.id)}
                >
                  Sửa
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => remove(section.id)}
                  aria-label="Xóa"
                  title="Xóa khối"
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
            <p className="text-sm text-muted-foreground">
              Chọn loại khối cho trang này. Sau khi thêm, cửa sổ sửa mở ngay để
              chỉnh từng cài đặt.
            </p>
          </DialogHeader>
          {whitelist.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Trang này chưa có loại khối nào được phép thêm.
            </p>
          ) : (
            <div className="grid gap-2 py-2 sm:grid-cols-2">
              {whitelist.map((type) => {
                const count = sections.filter((s) => s.type === type).length;
                const meta = SECTION_META[type];
                return (
                  <button
                    key={type}
                    type="button"
                    className="text-left rounded-lg border px-3 py-2.5 hover:bg-muted/60 transition-colors"
                    onClick={() => addType(type)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{meta.label}</p>
                      {count > 0 ? (
                        <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                          đã có {count}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">
                      Cài đặt: {meta.settings}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing && !imageEdit}
        onOpenChange={(open) => {
          if (open) return;
          // Tạm đóng để mở ImageManager — không hủy phiên sửa
          if (imageEdit || editIdBeforeImage) return;
          handleCloseEdit();
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[min(960px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
            <DialogTitle>
              Sửa — {editing ? SECTION_META[editing.type].label : ""}
            </DialogTitle>
            {editing ? (
              <div className="space-y-1 pt-1">
                <p className="text-sm text-muted-foreground">
                  {SECTION_META[editing.type].description}
                </p>
                <p className="text-xs text-neutral-500">
                  {SECTION_META[editing.type].settings}
                </p>
              </div>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {editing ? (
            <SectionPropsForm
              section={editing}
              portal={effectivePortal}
              onImageEdit={(slot) => {
                setEditIdBeforeImage(editing.id);
                setImageEdit(slot);
              }}
              onChange={(props) => patchProps(editing.id, props)}
            />
          ) : null}
          </div>
          <DialogFooter className="shrink-0 flex-col gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
            <p className="text-xs text-muted-foreground sm:mr-auto">
              {dirty
                ? "Chỉnh sửa đã ghi tạm — bấm Lưu & đóng để áp dụng lên website."
                : "Ảnh cập nhật ngay khi upload. Xóa khối không xóa file R2."}
            </p>
            <Button variant="outline" onClick={handleCloseEdit}>
              Đóng
            </Button>
            <Button
              onClick={() => void handleSaveAndCloseEdit()}
              disabled={!dirty || busy}
            >
              <Save className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? "Đang lưu…" : "Lưu & đóng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {imageEdit ? (
        <ImageManager
          isOpen
          onClose={() => {
            setImageEdit(null);
            if (editIdBeforeImage) {
              setEditId(editIdBeforeImage);
              setEditIdBeforeImage(null);
            }
          }}
          imageType={imageEdit.imageType}
          altText={imageEdit.label}
          portal={effectivePortal}
          onImageUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/ui-images"] });
            setImageEdit(null);
            if (editIdBeforeImage) {
              setEditId(editIdBeforeImage);
              setEditIdBeforeImage(null);
            }
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

function CtaPairHint({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  const hasLabel = label.trim().length > 0;
  const hasHref = href.trim().length > 0;
  if (hasLabel === hasHref) return null;
  return (
    <p className="text-xs text-amber-700 dark:text-amber-400">
      {hasLabel
        ? "Đã có chữ nút nhưng thiếu link — nút có thể không hoạt động."
        : "Đã có link nhưng thiếu chữ nút — nút sẽ không hiện."}
    </p>
  );
}

function AlignSelect({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: string) => void;
}) {
  const align =
    value === "left" || value === "right" ? String(value) : "center";
  return (
    <Select value={align} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="left">Căn trái</SelectItem>
        <SelectItem value="center">Căn giữa</SelectItem>
        <SelectItem value="right">Căn phải</SelectItem>
      </SelectContent>
    </Select>
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

  const portalId: PortalId = isPortalId(portal) ? portal : "group";
  const defaultHeroPrefix = isLayoutPageId(portal)
    ? LAYOUT_PAGE_IMAGE_PREFIX[portal]
    : portalId === "luyenthi"
      ? "exam"
      : portalId;

  if (section.type === "hero") {
    const prefixRaw = String(p.imageTypePrefix ?? "");
    const prefixPreview = prefixRaw.trim() || defaultHeroPrefix;
    const primaryLabel = String(p.ctaPrimaryLabel ?? "");
    const primaryHref = String(p.ctaPrimaryHref ?? "");
    const secondaryLabel = String(p.ctaSecondaryLabel ?? "");
    const secondaryHref = String(p.ctaSecondaryHref ?? "");
    return (
      <div className="space-y-4 py-1">
        <Field label="Thương hiệu">
          <Input
            value={String(p.brandName ?? "")}
            onChange={(e) => set("brandName", e.target.value)}
            placeholder="N&P"
          />
          <p className="text-xs text-muted-foreground">
            Chữ lớn nhất trên banner (thương hiệu / tên sản phẩm).
          </p>
        </Field>
        <Field label="Tiêu đề">
          <Textarea
            value={String(p.title ?? "")}
            onChange={(e) => set("title", e.target.value)}
            rows={2}
            placeholder="Dòng tiêu đề phụ dưới thương hiệu"
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
            value={prefixRaw}
            onChange={(e) => set("imageTypePrefix", e.target.value)}
            onBlur={() => {
              const trimmed = prefixRaw.trim();
              if (trimmed !== prefixRaw) set("imageTypePrefix", trimmed);
            }}
            placeholder={defaultHeroPrefix}
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {HERO_PREFIX_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                size="sm"
                variant={
                  prefixRaw.trim() === preset.value ? "default" : "outline"
                }
                className="h-7 text-xs"
                onClick={() => set("imageTypePrefix", preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Slot ảnh:{" "}
            <code className="font-mono">
              {prefixPreview}-hero
            </code>
            ,{" "}
            <code className="font-mono">
              {prefixPreview}-hero-1…5
            </code>
            . Để trống → «{defaultHeroPrefix}».
          </p>
        </Field>
        <HeroBlockImageSlots
          prefix={prefixPreview}
          portal={portal}
          onRequestEdit={onImageEdit}
        />
        <Field label="CTA chính — chữ">
          <Input
            value={primaryLabel}
            onChange={(e) => set("ctaPrimaryLabel", e.target.value)}
          />
        </Field>
        <Field label="CTA chính — link">
          <Input
            value={primaryHref}
            onChange={(e) => set("ctaPrimaryHref", e.target.value)}
            placeholder="/contact hoặc https://…"
          />
          <CtaPairHint label={primaryLabel} href={primaryHref} />
        </Field>
        <Field label="CTA phụ — chữ">
          <Input
            value={secondaryLabel}
            onChange={(e) => set("ctaSecondaryLabel", e.target.value)}
          />
        </Field>
        <Field label="CTA phụ — link">
          <Input
            value={secondaryHref}
            onChange={(e) => set("ctaSecondaryHref", e.target.value)}
            placeholder="/about hoặc portal:huongnghiep:/"
          />
          <CtaPairHint label={secondaryLabel} href={secondaryHref} />
          <p className="text-xs text-muted-foreground">
            Để trống cả chữ và link nếu không cần nút phụ.
          </p>
        </Field>
      </div>
    );
  }

  if (section.type === "rich_text") {
    const imageType = String(p.imageType ?? "");
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
            placeholder="Xuống dòng được giữ trên trang công khai."
          />
        </Field>
        <Field label="Mã ảnh minh họa (để trống = không hiện ảnh)">
          <Input
            value={imageType}
            onChange={(e) => set("imageType", e.target.value)}
            onBlur={() => {
              const trimmed = imageType.trim();
              if (trimmed !== imageType) set("imageType", trimmed);
            }}
            placeholder="vd. group-pillar-0"
          />
          <p className="text-xs text-muted-foreground">
            Có mã ảnh → bố cục 2 cột (chữ + ảnh). Trống → chỉ chữ căn giữa.
          </p>
        </Field>
        {imageType.trim() ? (
          <BlockImageSlot
            imageType={imageType.trim()}
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
    const moveItem = (from: number, to: number) => {
      if (to < 0 || to >= items.length) return;
      const next = [...items];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      set("items", next);
    };
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
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">
              Các mục ({items.length})
            </Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                set("items", [
                  ...items,
                  isCards
                    ? {
                        id: `item-${Date.now()}`,
                        label: "",
                        title: "Mục mới",
                        description: "",
                        cta: "Xem thêm",
                        href: "/contact",
                        imageType: "",
                      }
                    : {
                        id: `item-${Date.now()}`,
                        title: "Điểm mới",
                        body: "",
                      },
                ])
              }
            >
              <Plus className="h-3 w-3 mr-1" />
              Thêm mục
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
              Chưa có mục nào. Bấm «Thêm mục» để bắt đầu.
            </p>
          ) : null}
          {items.map((raw, i) => {
            const item =
              raw && typeof raw === "object"
                ? { ...(raw as Record<string, unknown>) }
                : {};
            const itemKey =
              typeof item.id === "string" && item.id
                ? item.id
                : `idx-${i}-${String(item.title ?? item.label ?? "")}`;
            const updateItem = (patch: Record<string, unknown>) => {
              const next = [...items];
              next[i] = { ...item, ...patch };
              set("items", next);
            };
            const itemCta = String(item.cta ?? "");
            const itemHref = String(item.href ?? "");
            return (
              <div
                key={itemKey}
                className="rounded-lg border p-4 space-y-3 bg-muted/20"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{i + 1}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={i === 0}
                      title="Đưa lên"
                      onClick={() => moveItem(i, i - 1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={i >= items.length - 1}
                      title="Đưa xuống"
                      onClick={() => moveItem(i, i + 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      title="Xóa mục"
                      onClick={() => {
                        if (
                          !confirm(
                            `Xóa mục #${i + 1}${
                              item.title ? ` «${String(item.title)}»` : ""
                            }?`,
                          )
                        ) {
                          return;
                        }
                        set(
                          "items",
                          items.filter((_, j) => j !== i),
                        );
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
                      value={itemCta}
                      onChange={(e) => updateItem({ cta: e.target.value })}
                    />
                    <Input
                      placeholder="Link nội bộ, https://… hoặc portal:huongnghiep:/"
                      value={itemHref}
                      onChange={(e) => updateItem({ href: e.target.value })}
                    />
                    <div className="sm:col-span-2">
                      <CtaPairHint label={itemCta} href={itemHref} />
                    </div>
                    <Input
                      placeholder="Mã ảnh CMS"
                      className="sm:col-span-2"
                      value={String(item.imageType ?? "")}
                      onChange={(e) =>
                        updateItem({ imageType: e.target.value })
                      }
                      onBlur={() => {
                        const rawType = String(item.imageType ?? "");
                        const trimmed = rawType.trim();
                        if (trimmed !== rawType) {
                          updateItem({ imageType: trimmed });
                        }
                      }}
                    />
                    {String(item.imageType ?? "").trim() ? (
                      <div className="sm:col-span-2">
                        <BlockImageSlot
                          imageType={String(item.imageType).trim()}
                          label={String(
                            item.title || item.label || `Mục ${i + 1}`,
                          )}
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
    const limitVal = clampInt(Number(p.limit), 1, 12, 3);
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
        <Field label="Số lượng hiển thị (1–12)">
          <Input
            type="number"
            min={1}
            max={12}
            value={limitVal}
            onChange={(e) => {
              const n = Number(e.target.value);
              set("limit", clampInt(n, 1, 12, 3));
            }}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Lấy từ Cpanel → Đánh giá khách hàng (theo portal hiện tại).
        </p>
      </div>
    );
  }

  if (section.type === "articles") {
    const category = String(p.category ?? "japanese-training");
    const known = ARTICLE_CATEGORIES.some((c) => c.value === category);
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
        <Field label="Chuyên mục bài viết">
          <Select
            value={category || "japanese-training"}
            onValueChange={(v) => set("category", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!known && category ? (
                <SelectItem value={category}>
                  {category} (giá trị cũ — chọn lại)
                </SelectItem>
              ) : null}
              {ARTICLE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Khớp chuyên mục khi tạo bài trong Cpanel → Bài viết.
          </p>
        </Field>
      </div>
    );
  }

  if (section.type === "cta_form") {
    const services = CONTACT_SERVICES_BY_PORTAL[portalId];
    const current = String(p.defaultService ?? "");
    const known =
      current === "" || services.some((s) => s.value === current);
    const selectValue = current === "" ? "__none__" : current;
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
        <Field label="Dịch vụ mặc định trong form">
          <Select
            value={selectValue}
            onValueChange={(v) =>
              set("defaultService", v === "__none__" ? "" : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Không chọn sẵn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Không chọn sẵn</SelectItem>
              {!known && current ? (
                <SelectItem value={current}>
                  {current} (không thuộc portal này)
                </SelectItem>
              ) : null}
              {services.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Prefill ô «Dịch vụ quan tâm» trên form công khai (theo portal đang
            chỉnh).
          </p>
        </Field>
      </div>
    );
  }

  if (section.type === "exam_packages") {
    return (
      <div className="space-y-4 py-1">
        <Field label="Tiêu đề">
          <Input
            value={String(p.title ?? "")}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Mô tả (tùy chọn)">
          <Textarea
            value={String(p.description ?? "")}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Căn tiêu đề / mô tả">
          <AlignSelect value={p.align} onChange={(v) => set("align", v)} />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">
              Hiện khối «Quy trình quyền thi»
            </Label>
            <p className="text-xs text-muted-foreground">
              Hiển thị hướng dẫn quyền thi bên dưới danh sách gói.
            </p>
          </div>
          <Switch
            checked={p.showAccessGuide !== false}
            onCheckedChange={(checked) => set("showAccessGuide", checked)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Danh sách gói lấy từ Cpanel → Quản lý gói đề.
        </p>
      </div>
    );
  }

  if (section.type === "exam_list") {
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
        <Field label="Căn tiêu đề / mô tả">
          <AlignSelect value={p.align} onChange={(v) => set("align", v)} />
        </Field>
        <p className="text-xs text-muted-foreground">
          Danh sách đề lấy từ Cpanel → Quản lý đề thi. Bộ lọc / tìm kiếm hiển thị
          trên trang công khai.
        </p>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground py-4">
      Không có form cho loại này.
    </p>
  );
}
