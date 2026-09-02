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
import { normalizeCmsSlug } from "@shared/cmsPages";
import { PORTAL_META, PORTAL_IDS, portalOrigin, type PortalId } from "@/lib/portal";

function buildPreviewUrl(page: PageContentEntry): string {
  const portal = page.portal;
  const path = page.publicPath;
  if (typeof window === "undefined") return path;

  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";

  if (isLocal) {
    return `${path}?portal=${encodeURIComponent(portal)}`;
  }

  try {
    const origin = portalOrigin(portal as PortalId);
    if (origin) return `${origin}${path}`;
  } catch {
    /* fall through */
  }
  return path;
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

export function PageContentAdmin() {
  const { toast } = useToast();
  const { filter } = useAdminPortal();
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

  const [selectedId, setSelectedId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"blocks" | "text" | "images">(
    "blocks",
  );
  const [blocksDirty, setBlocksDirty] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPortal, setNewPortal] = useState<PortalId>("group");
  const [newDescription, setNewDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (pages.length === 0) {
      setSelectedId("");
      return;
    }
    if (!selectedId) {
      setSelectedId(pages[0].id);
      return;
    }
    if (!pages.some((p) => p.id === selectedId)) {
      const nextId = pages[0].id;
      if (
        blocksDirty &&
        !confirm(
          "Bạn có khối nội dung chưa lưu. Chuyển sang trang khác sẽ mất các chỉnh sửa. Tiếp tục?",
        )
      ) {
        return;
      }
      setBlocksDirty(false);
      setSelectedId(nextId);
    }
  }, [pages, selectedId, blocksDirty]);

  useEffect(() => {
    if (filter !== "all") setNewPortal(filter);
  }, [filter]);

  useEffect(() => {
    if (!slugTouched && newLabel) {
      setNewSlug(normalizeCmsSlug(newLabel));
    }
  }, [newLabel, slugTouched]);

  const selected = pages.find((p) => p.id === selectedId);

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
    const slug = normalizeCmsSlug(newSlug || newLabel);
    if (!label) {
      toast({ title: "Nhập tên trang", variant: "destructive" });
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
        description: `Truy cập tại ${created.publicPath}`,
      });
      setAddOpen(false);
      setNewLabel("");
      setNewSlug("");
      setNewDescription("");
      setSlugTouched(false);
      setSelectedId(created.id);
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
    if (
      blocksDirty &&
      !confirm(
        "Bạn có khối nội dung chưa lưu trên trang này. Xóa trang sẽ mất các chỉnh sửa. Tiếp tục?",
      )
    ) {
      return;
    }
    const slug = selected.publicPath.replace(/^\//, "");
    const remaining = pages.filter((p) => p.id !== selected.id);
    const samePortal = remaining.filter((p) => p.portal === selected.portal);
    const nextId = (samePortal[0] ?? remaining[0])?.id ?? "";

    if (
      !confirm(
        `Xóa trang "${selected.label}"?\n\nURL /${slug} → 404. Khối nội dung bị xóa. Ảnh CMS/R2 gắn slot của trang này cũng sẽ bị dọn (nếu có).`,
      )
    ) {
      return;
    }
    try {
      const result = await deletePage.mutateAsync({
        id: selected.id,
        slug,
        portal: selected.portal,
      });
      const img = result.images;
      const imgNote =
        img && img.dbRemoved > 0
          ? ` · ${img.dbRemoved} slot ảnh, ${img.r2Removed} file R2`
          : "";
      toast({ title: `Đã xóa trang${imgNote}` });
      setBlocksDirty(false);
      setSelectedId(nextId);
    } catch (err) {
      toast({
        title: "Không xóa được trang",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  if (!customLoading && pages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Không có trang nào trong phạm vi portal đã chọn.
      </p>
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
            className="h-8 px-2"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <nav className="space-y-3">
          {Array.from(grouped.entries()).map(([portalId, portalPages]) => (
            <div key={portalId}>
              <p className="text-[11px] font-medium text-neutral-400 px-2 mb-1">
                {PORTAL_META[portalId]?.label || portalId}
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
          Trang hệ thống không thể xóa. Xóa trang tùy chỉnh sẽ dọn slot ảnh CMS +
          file R2 của trang đó. Xóa khối trong editor không xóa ảnh R2.
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
                    onClick={handleDeletePage}
                    disabled={deletePage.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Xóa trang
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
                Trang này ngoài phạm vi portal đang lọc — vẫn có thể chỉnh sửa, hoặc
                chọn lại portal &quot;Tất cả&quot; để thấy trong danh sách.
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

              {selected.editor === "blocks" &&
              (selected.layoutPageId || selected.layoutKey) ? (
                <TabsContent value="blocks" className="mt-4" forceMount>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm trang khối mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Portal</Label>
              <Select
                value={newPortal}
                onValueChange={(v) => setNewPortal(v as PortalId)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PORTAL_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {PORTAL_META[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tên trang</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="vd. Giới thiệu dịch vụ mới"
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL slug</Label>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground">/</span>
                <Input
                  value={newSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setNewSlug(e.target.value);
                  }}
                  placeholder="gioi-thieu-dich-vu"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Không trùng route hệ thống (login, contact, du-hoc…). Không thay
                thế trang chủ `/`.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Mô tả (tùy chọn)</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreatePage} disabled={createPage.isPending}>
              Tạo trang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
