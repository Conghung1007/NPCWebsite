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
import {
  GROUP_LABELS,
  groupContentKeys,
  humanizeContentKey,
} from "@shared/pageContentRegistry";
import type { PortalId } from "@/lib/portal";

type SiteContentEditorProps = {
  siteContentsPage: string;
  portal?: PortalId;
  defaults?: Record<string, string>;
};

export function SiteContentEditor({
  siteContentsPage,
  portal,
  defaults = {},
}: SiteContentEditorProps) {
  const { toast } = useToast();
  const { data, isLoading, isError } = useSiteContents(siteContentsPage, portal);
  const saveMutation = useBulkUpsertSiteContents(siteContentsPage, portal);

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const merged = { ...defaults, ...(data || {}) };
    setDraft(merged);
    setDirty(false);
  }, [data, defaults]);

  const groups = useMemo(
    () => groupContentKeys(Object.keys(draft)),
    [draft],
  );

  const updateField = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      const entries = Object.entries(draft).map(([key, value]) => ({
        key,
        value,
      }));
      await saveMutation.mutateAsync(entries);
      setDirty(false);
      toast({ title: "Đã lưu nội dung trang" });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể lưu nội dung. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Đang tải nội dung…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive py-8 text-center">
        Không tải được nội dung trang.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Chỉnh sửa văn bản hiển thị trên trang public. Lưu tại đây thay vì sửa trực tiếp trên web.
        </p>
        <Button
          size="sm"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => void handleSave()}
        >
          <Save className="h-4 w-4 mr-1.5" />
          {saveMutation.isPending ? "Đang lưu…" : "Lưu văn bản"}
        </Button>
      </div>

      {Object.entries(groups).map(([groupKey, fieldKeys]) => (
        <section key={groupKey} className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800 border-b pb-2">
            {GROUP_LABELS[groupKey] || humanizeContentKey(groupKey)}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {fieldKeys.map((key) => {
              const value = draft[key] ?? "";
              const isJsonField =
                key === "faqs" ||
                key === "documents-by-type" ||
                (value.trim().startsWith("[") || value.trim().startsWith("{"));
              const multiline =
                isJsonField || value.length > 120 || value.includes("\n");
              return (
                <div
                  key={key}
                  className={multiline ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}
                >
                  <Label htmlFor={`sc-${key}`} className="text-xs text-neutral-600">
                    {humanizeContentKey(key)}
                    <span className="ml-1 font-mono text-neutral-400">({key})</span>
                  </Label>
                  {multiline ? (
                    <Textarea
                      id={`sc-${key}`}
                      rows={isJsonField ? 10 : 4}
                      value={value}
                      onChange={(e) => updateField(key, e.target.value)}
                      className={isJsonField ? "font-mono text-xs" : "text-sm"}
                    />
                  ) : (
                    <Input
                      id={`sc-${key}`}
                      value={value}
                      onChange={(e) => updateField(key, e.target.value)}
                      className="text-sm h-9"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
