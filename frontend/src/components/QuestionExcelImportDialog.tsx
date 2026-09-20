import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/queryClient";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";

type ImportError = { row: number; message: string };

type ImportResult = {
  message?: string;
  created?: number;
  errors?: ImportError[];
  skippedEmptyRows?: number;
  partial?: boolean;
};

const MAX_CLIENT_BYTES = 5 * 1024 * 1024;

export function QuestionExcelImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    if (uploading) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await apiFetch("/api/questions/import/template");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Không tải được file mẫu");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mau-nhap-cau-hoi.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Không tải được file mẫu",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleFilePick = (picked: File | null) => {
    setResult(null);
    if (!picked) {
      setFile(null);
      return;
    }
    const lower = picked.name.toLowerCase();
    if (!lower.endsWith(".xlsx")) {
      toast({
        title: "Sai định dạng",
        description: "Chỉ hỗ trợ file .xlsx",
        variant: "destructive",
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (picked.size > MAX_CLIENT_BYTES) {
      toast({
        title: "File quá lớn",
        description: "File Excel không được vượt quá 5MB",
        variant: "destructive",
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(picked);
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Chọn file",
        description: "Vui lòng chọn file Excel (.xlsx).",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/questions/import", {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as ImportResult;
      setResult(body);

      if (!res.ok && res.status !== 207) {
        throw new Error(body.message || "Nhập Excel thất bại");
      }

      const created = body.created || 0;
      const errCount = body.errors?.length || 0;
      if (created > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
        toast({
          title: body.partial || errCount > 0 ? "Nhập một phần" : "Nhập thành công",
          description:
            body.message ||
            `Đã tạo ${created} câu hỏi` +
              (errCount ? `, ${errCount} lỗi` : "") +
              (body.skippedEmptyRows
                ? `, bỏ qua ${body.skippedEmptyRows} dòng trống`
                : ""),
        });
      } else {
        toast({
          title: "Không nhập được",
          description: body.message || "Kiểm tra lỗi trong file.",
          variant: "destructive",
        });
      }
    } catch (err: unknown) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Nhập Excel thất bại",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Nhập câu hỏi từ Excel
          </DialogTitle>
          <DialogDescription>
            Tải file mẫu (sheet <code className="text-xs">CauHoi</code>), điền nội dung,
            nhóm cha/con bằng cột <code className="text-xs">nhom</code>. Đáp án dùng A–F
            hoặc 1, 2, 3… Ảnh/audio thêm sau trong form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={downloading || uploading}
            onClick={downloadTemplate}
          >
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Tải file mẫu (.xlsx)
          </Button>

          <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-center">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => handleFilePick(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Chọn file Excel
            </Button>
            <p className="mt-2 text-sm text-muted-foreground truncate">
              {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "Chưa chọn file · tối đa 5MB"}
            </p>
          </div>

          {result ? (
            <div className="space-y-2 text-sm">
              {typeof result.created === "number" ? (
                <p className="text-neutral-700">
                  Đã tạo: <strong>{result.created}</strong>
                  {result.skippedEmptyRows
                    ? ` · Bỏ qua ${result.skippedEmptyRows} dòng trống`
                    : null}
                </p>
              ) : null}
              {result.errors && result.errors.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
                  <p className="mb-1 font-semibold">
                    Lỗi / cảnh báo ({result.errors.length})
                  </p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {result.errors.slice(0, 40).map((err, i) => (
                      <li key={`${err.row}-${i}`}>
                        {err.row > 0 ? `Dòng ${err.row}: ` : null}
                        {err.message}
                      </li>
                    ))}
                    {result.errors.length > 40 ? (
                      <li>… và {result.errors.length - 40} lỗi khác</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            disabled={uploading}
            onClick={() => handleClose(false)}
          >
            Đóng
          </Button>
          <Button type="button" disabled={!file || uploading} onClick={handleImport}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Nhập vào ngân hàng câu hỏi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
