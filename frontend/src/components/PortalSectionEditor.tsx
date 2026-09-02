import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useBulkUpsertSiteContents,
  useSiteContents,
} from "@/hooks/useSiteContents";
import type { PortalSectionDef } from "@/pages/portal-sections";
import type { PortalId } from "@/lib/portal";
import {
  getPortalSectionDefaults,
  mergePortalSectionContent,
  portalSectionPageId,
  PORTAL_SECTION_TEXT_FIELDS,
  sectionDefToSiteContent,
} from "@/lib/portalSectionContent";
import {
  BulletsEditor,
  CardsEditor,
  FaqEditor,
  RowsEditor,
  StepsEditor,
} from "@/components/portal-section-editors";

type PortalSectionEditorProps = {
  fallback: PortalSectionDef;
  portal: PortalId;
};

export function PortalSectionEditor({ fallback, portal }: PortalSectionEditorProps) {
  const { toast } = useToast();
  const pageId = portalSectionPageId(fallback.slug);
  const defaults = useMemo(() => getPortalSectionDefaults(fallback), [fallback]);

  const { data, isLoading, isError } = useSiteContents(pageId, portal);
  const saveMutation = useBulkUpsertSiteContents(pageId, portal);

  const merged = useMemo(
    () => mergePortalSectionContent(fallback, { ...defaults, ...(data || {}) }),
    [fallback, defaults, data],
  );

  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [cards, setCards] = useState(merged.cards || []);
  const [rows, setRows] = useState(merged.rows || []);
  const [steps, setSteps] = useState(merged.steps || []);
  const [bullets, setBullets] = useState(merged.bullets || []);
  const [faq, setFaq] = useState(merged.faq || []);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const base = mergePortalSectionContent(fallback, { ...defaults, ...(data || {}) });
    const texts: Record<string, string> = {};
    for (const key of PORTAL_SECTION_TEXT_FIELDS) {
      texts[key] = (base[key as keyof PortalSectionDef] as string) || "";
    }
    setTextFields(texts);
    setCards(base.cards || []);
    setRows(base.rows || []);
    setSteps(base.steps || []);
    setBullets(base.bullets || []);
    setFaq(base.faq || []);
    setDirty(false);
  }, [data, defaults, fallback]);

  const markDirty = () => setDirty(true);

  const handleSave = async () => {
    const payload: PortalSectionDef = {
      ...fallback,
      ...textFields,
      cards: cards.length ? cards : undefined,
      rows: rows.length ? rows : undefined,
      steps: steps.length ? steps : undefined,
      bullets: bullets.length ? bullets : undefined,
      faq: faq.length ? faq : undefined,
    };
    const entries = Object.entries(sectionDefToSiteContent(payload)).map(
      ([key, value]) => ({ key, value }),
    );
    try {
      await saveMutation.mutateAsync(entries);
      setDirty(false);
      toast({ title: "Đã lưu nội dung trang con" });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể lưu. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">Đang tải…</p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive py-8 text-center">
        Không tải được nội dung.
      </p>
    );
  }

  const showCards = (fallback.cards?.length || 0) > 0 || cards.length > 0;
  const showRows = (fallback.rows?.length || 0) > 0 || rows.length > 0;
  const showSteps = (fallback.steps?.length || 0) > 0 || steps.length > 0;
  const showBullets = (fallback.bullets?.length || 0) > 0 || bullets.length > 0;
  const showFaq = (fallback.faq?.length || 0) > 0 || faq.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Trang <strong className="text-foreground">{merged.title}</strong>
        </p>
        <Button
          size="sm"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => void handleSave()}
        >
          <Save className="h-4 w-4 mr-1.5" />
          {saveMutation.isPending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold border-b pb-2">Tiêu đề & mô tả</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {PORTAL_SECTION_TEXT_FIELDS.map((key) => (
            <div
              key={key}
              className={
                key === "description" || key === "lead" || key === "note"
                  ? "sm:col-span-2 space-y-1.5"
                  : "space-y-1.5"
              }
            >
              <Label htmlFor={`ps-${key}`} className="text-xs capitalize">
                {key}
              </Label>
              {key === "description" || key === "lead" || key === "note" ? (
                <Textarea
                  id={`ps-${key}`}
                  rows={3}
                  value={textFields[key] ?? ""}
                  onChange={(e) => {
                    setTextFields((p) => ({ ...p, [key]: e.target.value }));
                    markDirty();
                  }}
                  className="text-sm"
                />
              ) : (
                <Input
                  id={`ps-${key}`}
                  value={textFields[key] ?? ""}
                  onChange={(e) => {
                    setTextFields((p) => ({ ...p, [key]: e.target.value }));
                    markDirty();
                  }}
                  className="text-sm h-9"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {showCards ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold border-b pb-2">Thẻ nội dung</h3>
          <CardsEditor
            items={cards}
            onChange={(next) => {
              setCards(next);
              markDirty();
            }}
          />
        </section>
      ) : null}

      {showRows ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold border-b pb-2">Thông tin nhanh</h3>
          <RowsEditor
            items={rows}
            onChange={(next) => {
              setRows(next);
              markDirty();
            }}
          />
        </section>
      ) : null}

      {showSteps ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold border-b pb-2">Quy trình</h3>
          <StepsEditor
            items={steps}
            onChange={(next) => {
              setSteps(next);
              markDirty();
            }}
          />
        </section>
      ) : null}

      {showBullets ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold border-b pb-2">Điểm nổi bật</h3>
          <BulletsEditor
            items={bullets}
            onChange={(next) => {
              setBullets(next);
              markDirty();
            }}
          />
        </section>
      ) : null}

      {showFaq ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold border-b pb-2">Câu hỏi thường gặp</h3>
          <FaqEditor
            items={faq}
            onChange={(next) => {
              setFaq(next);
              markDirty();
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
