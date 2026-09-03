import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Image, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAdminPortal } from "@/contexts/AdminPortalContext";
import { PageLayoutAdmin } from "@/components/PageLayoutAdmin";
import { SiteContentEditor } from "@/components/SiteContentEditor";
import { PageImageSlotsAdmin } from "@/components/PageImageSlotsAdmin";
import { PortalSectionEditor } from "@/components/PortalSectionEditor";
import { getSectionBySlug } from "@/pages/portal-sections";
import {
  useCmsPages,
  useCreateCmsPage,
  useDeleteCmsPage,
} from "@/hooks/useCmsPages";
import {
  getPageContentDefaults,
  getLayoutPortal,
  getLayoutPageKey,
  getPagesForPortal,
  type PageContentEntry,
} from "@shared/pageContentRegistry";
import { normalizeCmsSlug, validateCmsSlug } from "@shared/cmsPages";
import { PORTAL_META, PORTAL_IDS, portalHref, type PortalId } from "@/lib/portal";

function portalLabel(id: PortalId): string {
  return PORTAL_META[id]?.label || PORTAL_META[id]?.brand || id;
}

function buildPreviewUrl(page: PageContentEntry): string {
  const portal = page.portal as PortalId;
  const path = page.publicPath;
  if (typeof window === "undefined") return path;

  try {
    return portalHref(portal, path);
  } catch {
    return `${path}?portal=${encodeURIComponent(portal)}`;
  }
}

function mergePages(
  staticPages: PageContentEntry[],
  customPages: PageContentEntry[],
): PageContentEntry[] {
  return [...staticPages, ...customPages].sort((a, b) => {
    if (a.portal !== b.portal) return a.portal.localeCompare(b.portal);
    if (a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1;
    return a.label.localeCompare(b.label, "vi");
  });
}

type CreatePageFormProps = {
  portalOptions: PortalId[];
  newPortal: PortalId;
  setNewPortal: (v: PortalId) => void;
  newLabel: string;
  setNewLabel: (v: string) => void;
  newSlug: string;
  setNewSlug: (v: string) => void;
  setSlugTouched: (v: boolean) => void;
  newDescription: string;
  setNewDescription: (v: string) => void;
  slugError: string | null;
  previewPath: string;
  pending: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
};

function CreatePageForm({
  portalOptions,
  newPortal,
  setNewPortal,
  newLabel,
  setNewLabel,
  newSlug,
  setNewSlug,
  setSlugTouched,
  newDescription,
  setNewDescription,
  slugError,
  previewPath,
  pending,
  canSubmit,
  onCancel,
  onSubmit,
}: CreatePageFormProps) {
  return (
    <>
      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label>Portal</Label>
          <Select
            value={newPortal}
            onValueChange={(v) => setNewPortal(v as PortalId)}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {portalOptions.map((id) => (
                <SelectItem key={id} value={id}>
                  {portalLabel(id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cms-page-label">Tên trang</Label>
          <Input
            id="cms-page-label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="vd. Hướng dẫn thi thử"
            disabled={pending}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit && !pending) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cms-page-slug">URL slug</Label>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground shrink-0">/</span>
            <Input
              id="cms-page-slug"
              value={newSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setNewSlug(e.target.value);
              }}
              placeholder="huong-dan-thi-thu"
              disabled={pending}
              aria-invalid={!!slugError}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit && !pending) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />
          </div>
          {slugError ? (
            <p className="text-xs text-destructive">{slugError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Trang sẽ mở tại{" "}
              <code className="rounded bg-muted px-1">{previewPath}</code>
              {newPortal !== "group" ? ` · portal=${newPortal}` : ""}. Không
              trùng route hệ thống hay trang tùy chỉnh khác.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cms-page-desc">Mô tả (tùy chọn)</Label>
          <Textarea
            id="cms-page-desc"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
            disabled={pending}
            maxLength={500}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Hủy
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit || pending}>
          {pending ? "Đang tạo…" : "Tạo trang"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PageContentAdmin() {
  const { toast } = useToast();
  const { filter, allowedPortals } = useAdminPortal();
  const staticPages = useMemo(() => getPagesForPortal(filter), [filter]);
  const { data: customPages = [], isLoading: customLoading } = useCmsPages(
    filter === "all" ? "all" : filter,
  );
  const createPage = useCreateCmsPage();
  const deletePage = useDeleteCmsPage();

  const pages = useMemo(
    () => mergePages(staticPages, customPages),
    [staticPages, customPages],
  );

  const createPortalOptions = useMemo(
    () => (allowedPortals ? allowedPortals : [...PORTAL_IDS]),
    [allowedPortals],
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedCache, setSelectedCache] = useState<PageContentEntry | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"blocks" | "text" | "images">(
    "blocks",
  );
  const [blocksDirty, setBlocksDirty] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPortal, setNewPortal] = useState<PortalId>("group");
  const [newDescription, setNewDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const normalizedSlug = useMemo(
    () => normalizeCmsSlug(newSlug || newLabel),
    [newSlug, newLabel],
  );

  const slugError = useMemo(() => {
    if (!newLabel.trim() && !newSlug.trim()) return null;
    const base = validateCmsSlug(normalizedSlug);
    if (base) return base;
    const clash = customPages.some(
      (p) =>
        p.portal === newPortal &&
        p.publicPath.replace(/^\//, "") === normalizedSlug,
    );
    if (clash) return "Slug đã tồn tại trong portal này";
    const staticClash = staticPages.some(
      (p) =>
        p.portal === newPortal &&
        p.publicPath.replace(/^\//, "") === normalizedSlug,
    );
    if (staticClash) return "Slug trùng trang hệ thống của portal này";
    return null;
  }, [newLabel, newSlug, normalizedSlug, customPages, newPortal, staticPages]);

  const canCreate =
    !!newLabel.trim() && !!normalizedSlug && !slugError && !createPage.isPending;

  const resetCreateForm = () => {
    setNewLabel("");
    setNewSlug("");
    setNewDescription("");
    setSlugTouched(false);
    if (filter !== "all") setNewPortal(filter);
    else if (!createPortalOptions.includes(newPortal)) {
      setNewPortal(createPortalOptions[0] || "group");
    }
  };

  const openCreateDialog = () => {
    if (
      blocksDirty &&
      !confirm(
        "Bạn có khối chưa lưu trên trang hiện tại. Mở form tạo trang mới? (Chỉnh sửa khối chưa lưu vẫn giữ đến khi đổi trang.)",
      )
    ) {
      return;
    }
    resetCreateForm();
    setAddOpen(true);
  };

  useEffect(() => {
    if (pages.length === 0) {
      if (!blocksDirty) {
        setSelectedId("");
        setSelectedCache(null);
      }
      return;
    }
    if (!selectedId) {
      setSelectedId(pages[0].id);
      return;
    }
    if (!pages.some((p) => p.id === selectedId)) {
      // Keep editing current page when dirty / just-created (list chưa kịp có id)
      if (blocksDirty || selectedCache?.id === selectedId) {
        return;
      }
      setSelectedId(pages[0].id);
    }
  }, [pages, selectedId, blocksDirty, selectedCache?.id]);

  useEffect(() => {
    if (filter !== "all") {
      setNewPortal(filter);
      return;
    }
    if (!createPortalOptions.includes(newPortal)) {
      setNewPortal(createPortalOptions[0] || "group");
    }
  }, [filter, createPortalOptions, newPortal]);

  useEffect(() => {
    if (!slugTouched && newLabel) {
      setNewSlug(normalizeCmsSlug(newLabel));
    }
  }, [newLabel, slugTouched]);

  const selectedFromList = pages.find((p) => p.id === selectedId);
  const selected =
    selectedFromList ||
    (selectedCache?.id === selectedId ? selectedCache : undefined);

  useEffect(() => {
    if (selectedFromList) setSelectedCache(selectedFromList);
  }, [selectedFromList]);

  const selectedOutOfFilter =
    !!selectedId && !pages.some((p) => p.id === selectedId);

  const selectPage = (id: string) => {
    if (id === selectedId) return;
    if (
      blocksDirty &&
      !confirm(
        "Bạn có khối nội dung chưa lưu. Chuyển trang sẽ mất các chỉnh sửa. Tiếp tục?",
      )
    ) {
      return;
    }
    setBlocksDirty(false);
    setSelectedId(id);
  };

  useEffect(() => {
    setBlocksDirty(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    const allowed = new Set<string>();
    if (selected.editor === "blocks") allowed.add("blocks");
    if (selected.editor === "legacy" || selected.editor === "portal-section") {
      allowed.add("text");
    }
    if (selected.imageSlots.length > 0) allowed.add("images");
    if (!allowed.has(activeTab)) {
      setActiveTab(selected.editor === "blocks" ? "blocks" : "text");
    }
  }, [selected, activeTab]);

  const portalSectionFallback = useMemo(() => {
    if (!selected?.sectionSlug) return null;
    return getSectionBySlug(selected.portal, selected.sectionSlug) || null;
  }, [selected?.portal, selected?.sectionSlug]);

  const grouped = useMemo(() => {
    const map = new Map<PortalId, PageContentEntry[]>();
    for (const p of pages) {
      const list = map.get(p.portal) || [];
      list.push(p);
      map.set(p.portal, list);
    }
    return map;
  }, [pages]);

  const handleCreatePage = async () => {
    const label = newLabel.trim();
    const slug = normalizedSlug;
    if (!label) {
      toast({ title: "Nhập tên trang", variant: "destructive" });
      return;
    }
    const err = validateCmsSlug(slug);
    if (err) {
      toast({ title: "Slug không hợp lệ", description: err, variant: "destructive" });
      return;
    }
    if (slugError) {
      toast({ title: "Không tạo được trang", description: slugError, variant: "destructive" });
      return;
    }
    try {
      const created = await createPage.mutateAsync({
        portal: newPortal,
        slug,
        label,
        description: newDescription.trim(),
      });
      toast({
        title: "Đã tạo trang",
        description: `Mở tại ${created.publicPath} — đang chuyển tới chỉnh khối.`,
      });
      setAddOpen(false);
      resetCreateForm();
      setBlocksDirty(false);
      setSelectedCache(created);
      setSelectedId(created.id);
      setActiveTab("blocks");
    } catch (err) {
      toast({
        title: "Không tạo được trang",
        description: err instanceof Error ? err.message : "Thử lại",
        variant: "destructive",
      });
    }
  };

  const handleDeletePage = async () => {
    if (!selected?.isCustom) return;
    const deleting = selected;
    const slug = deleting.publicPath.replace(/^\//, "");
    const remaining = pages.filter((p) => p.id !== deleting.id);
    const samePortal = remaining.filter((p) => p.portal === deleting.portal);
    const nextId = (samePortal[0] ?? remaining[0])?.id ?? "";

    try {
      const result = await deletePage.mutateAsync({
        id: deleting.id,
        slug,
        portal: deleting.portal,
      });
      const img = result.images;
      const imgNote =
        img && img.dbRemoved > 0
          ? ` · ${img.dbRemoved} slot ảnh, ${img.r2Removed} file R2`
          : "";
      toast({ title: `Đã xóa trang${imgNote}` });
      setDeleteOpen(false);
      setBlocksDirty(false);
      setSelectedCache(null);
      setSelectedId(nextId);
    } catch (err) {
      toast({
        title: "Không xóa được trang",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const requestDeletePage = () => {
    if (!selected?.isCustom || deletePage.isPending) return;
    if (
      blocksDirty &&
      !confirm(
        "Bạn có khối nội dung chưa lưu trên trang này. Xóa trang sẽ mất các chỉnh sửa. Tiếp tục?",
      )
    ) {
      return;
    }
    setDeleteOpen(true);
  };

  const createFormProps: CreatePageFormProps = {
    portalOptions: createPortalOptions,
    newPortal,
    setNewPortal,
    newLabel,
    setNewLabel,
    newSlug,
    setNewSlug,
    setSlugTouched,
    newDescription,
    setNewDescription,
    slugError,
    previewPath: `/${normalizedSlug || "…"}`,
    pending: createPage.isPending,
    canSubmit: canCreate,
    onCancel: () => {
      setAddOpen(false);
      resetCreateForm();
    },
    onSubmit: () => void handleCreatePage(),
  };

  if (!customLoading && pages.length === 0) {
    return (
      <div className="py-8 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Không có trang nào trong phạm vi portal đã chọn.
        </p>
        <Button type="button" size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm trang
        </Button>
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) resetCreateForm();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Thêm trang khối mới</DialogTitle>
            </DialogHeader>
            <CreatePageForm {...createFormProps} />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[520px]">
      <aside className="lg:w-56 shrink-0 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Trang nội dung
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2"
            onClick={openCreateDialog}
            title="Thêm trang khối mới"
            disabled={createPage.isPending}
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs">Thêm</span>
          </Button>
        </div>
        <nav className="space-y-3">
          {Array.from(grouped.entries()).map(([portalId, portalPages]) => (
            <div key={portalId}>
              <p className="text-[11px] font-medium text-neutral-400 px-2 mb-1">
                {portalLabel(portalId)}
              </p>
              <ul className="space-y-0.5">
                {portalPages.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => selectPage(p.id)}
                      className={cn(
                        "w-full text-left rounded-lg px-3 py-2 text-sm transition-colors",
                        selectedId === p.id
                          ? "bg-[#00A651]/10 text-[#007A3D] font-semibold"
                          : "text-neutral-700 hover:bg-neutral-100",
                      )}
                    >
                      <span className="line-clamp-2">{p.label}</span>
                      {p.isCustom ? (
                        <span className="block text-[10px] font-normal text-neutral-400 mt-0.5">
                          Tùy chỉnh · {p.publicPath}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <p className="text-[11px] text-muted-foreground px-1">
          Trang hệ thống (vd. Trang Luyện thi) không thể xóa. Bấm{" "}
          <strong>Thêm</strong> để tạo trang khối mới — sau đó mới có nút{" "}
          <strong>Xóa trang</strong>.
        </p>
      </aside>

      <div className="flex-1 min-w-0">
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  {selected.label}
                  {selected.isCustom ? (
                    <span className="text-xs font-normal rounded-full bg-blue-50 text-blue-700 px-2 py-0.5">
                      Tùy chỉnh
                    </span>
                  ) : null}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selected.description}
                  {selected.editor === "blocks" ? (
                    <>
                      {" "}
                      · Khối lưu tại{" "}
                      <code className="text-xs font-mono">
                        {getLayoutPortal(selected)}/{getLayoutPageKey(selected).slice(0, 8)}…
                      </code>
                      {selected.publicPath === "/"
                        ? " (trang chủ portal)"
                        : ` (${selected.publicPath})`}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.isCustom ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={requestDeletePage}
                    disabled={deletePage.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    {deletePage.isPending ? "Đang xóa…" : "Xóa trang"}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={buildPreviewUrl(selected)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    Xem trang
                  </a>
                </Button>
              </div>
            </div>

            {selectedOutOfFilter ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Trang này ngoài phạm vi portal đang lọc — vẫn có thể chỉnh sửa.
                Chọn lại portal &quot;Tất cả&quot; hoặc đúng cổng để thấy trong danh
                sách bên trái.
              </p>
            ) : null}

            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as "blocks" | "text" | "images")
              }
            >
              <TabsList>
                {selected.editor === "blocks" ? (
                  <TabsTrigger value="blocks" className="gap-1.5">
                    <LayoutTemplate className="h-4 w-4" />
                    Khối nội dung
                  </TabsTrigger>
                ) : null}
                {selected.editor === "legacy" || selected.editor === "portal-section" ? (
                  <TabsTrigger value="text" className="gap-1.5">
                    <FileText className="h-4 w-4" />
                    Văn bản
                  </TabsTrigger>
                ) : null}
                {selected.imageSlots.length > 0 && selected.editor !== "blocks" ? (
                  <TabsTrigger value="images" className="gap-1.5">
                    <Image className="h-4 w-4" />
                    Hình ảnh
                  </TabsTrigger>
                ) : null}
              </TabsList>

              {selected.editor === "blocks" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Đổi ảnh trong từng khối (Hero, Thẻ…). Thêm / sắp xếp / ẩn khối rồi
                  bấm <strong>Lưu</strong>.
                </p>
              ) : null}

              {selected.editor === "blocks" &&
              (selected.layoutPageId || selected.layoutKey) ? (
                <TabsContent value="blocks" className="mt-4">
                  <PageLayoutAdmin
                    key={selected.id}
                    pageId={selected.layoutPageId}
                    layoutKey={selected.layoutKey}
                    sectionTemplate={selected.sectionTemplate}
                    portal={selected.portal}
                    pageLabel={selected.label}
                    hidePageSelector
                    onDirtyChange={setBlocksDirty}
                  />
                </TabsContent>
              ) : null}

              {selected.editor === "legacy" && selected.siteContentsPage ? (
                <TabsContent value="text" className="mt-4">
                  <SiteContentEditor
                    siteContentsPage={selected.siteContentsPage}
                    portal={selected.portal}
                    defaults={getPageContentDefaults(selected)}
                  />
                </TabsContent>
              ) : null}

              {selected.editor === "portal-section" && portalSectionFallback ? (
                <TabsContent value="text" className="mt-4">
                  <PortalSectionEditor
                    fallback={portalSectionFallback}
                    portal={selected.portal}
                  />
                </TabsContent>
              ) : null}

              {selected.imageSlots.length > 0 && selected.editor !== "blocks" ? (
                <TabsContent value="images" className="mt-4">
                  <PageImageSlotsAdmin page={selected} />
                </TabsContent>
              ) : null}
            </Tabs>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Chọn một trang trong danh sách bên trái để chỉnh sửa.
          </p>
        )}
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (createPage.isPending) return;
          setAddOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm trang khối mới</DialogTitle>
          </DialogHeader>
          <CreatePageForm {...createFormProps} />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deletePage.isPending) return;
          setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Xóa trang &quot;{selected?.label}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  URL{" "}
                  <code className="rounded bg-muted px-1">
                    {selected?.publicPath}
                  </code>{" "}
                  sẽ trả 404. Toàn bộ khối nội dung của trang bị xóa.
                </p>
                <p>
                  Slot ảnh CMS / file R2 gắn trang này cũng sẽ được dọn (nếu có).
                  Thao tác không hoàn tác.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePage.isPending}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePage.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDeletePage();
              }}
            >
              {deletePage.isPending ? "Đang xóa…" : "Xóa trang"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
