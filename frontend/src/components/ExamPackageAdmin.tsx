import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EXAM_LEVELS } from "@shared/examAccess";
import type { Exam } from "@shared/schema";
import { examKeys } from "@/lib/queryKeys";
import { getPackageSaleInfo } from "@/lib/examPackageDisplay";
import { TNJS } from "@/lib/tnjsTheme";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
type CatalogPackage = {
  id: string;
  name: string;
  description: string | null;
  level: string | null;
  examCount: number;
  priceVnd: number;
  compareAtPriceVnd?: number | null;
  isActive: boolean;
  sortOrder: number;
  linkedExamCount?: number;
};

type PackageDetail = CatalogPackage & {
  exams?: PackageExam[];
};

type DetailStatus = "idle" | "loading" | "ready" | "error";

type PackageExam = {
  id: string;
  title: string;
  level: string | null;
  isActive: boolean | null;
  isDemo: boolean | null;
};

type EntitlementRow = {
  id: string;
  userId: string;
  level: string;
  packageId: string | null;
  status: string;
  amountVnd: number;
  note: string | null;
};

type PackageForm = {
  name: string;
  description: string;
  level: string;
  priceVnd: number;
  compareAtPriceVnd: number;
  isActive: boolean;
  sortOrder: number;
};

const emptyForm: PackageForm = {
  name: "",
  description: "",
  level: "",
  priceVnd: 10000,
  compareAtPriceVnd: 0,
  isActive: true,
  sortOrder: 0,
};

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function SectionTitle({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: TNJS.green }}
      >
        {step}
      </span>
      <div>
        <h3 className="font-semibold text-base text-gray-900">{title}</h3>
        {description ? (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

type ExamListEntry = Pick<
  Exam,
  "id" | "title" | "level" | "isActive" | "isDemo" | "packageId"
>;

function toExamListEntry(
  exam: Exam | PackageExam,
  packageId?: string | null,
): ExamListEntry {
  return {
    id: exam.id,
    title: exam.title,
    level: exam.level,
    isActive: exam.isActive,
    isDemo: exam.isDemo,
    packageId: "packageId" in exam ? exam.packageId ?? packageId ?? null : packageId ?? null,
  };
}

function ExamListItem({
  exam,
  action,
  onAction,
  hint,
  variant = "add",
}: {
  exam: ExamListEntry;
  action: "add" | "remove";
  onAction: () => void;
  hint?: string;
  variant?: "add" | "remove";
}) {
  return (
    <button
      type="button"
      onClick={onAction}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        variant === "add"
          ? "bg-white hover:border-[#00A651]/40 hover:bg-[#00A651]/5"
          : "bg-white hover:border-red-200 hover:bg-red-50/50",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          variant === "add" ? "bg-[#00A651]/10" : "bg-red-50",
        )}
      >
        <FileText
          className={cn("h-4 w-4", variant === "add" ? "text-[#00A651]" : "text-red-500")}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-gray-900">{exam.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {exam.level ? (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
              {exam.level}
            </Badge>
          ) : null}
          {!exam.isActive ? <span>Ẩn</span> : null}
          {exam.isDemo ? <span>Demo</span> : null}
          {hint ? <span className="text-amber-600">{hint}</span> : null}
        </p>
      </div>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
          variant === "add"
            ? "border-[#00A651]/30 text-[#00A651]"
            : "border-red-200 text-red-500",
        )}
      >
        {action === "add" ? <Plus className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </span>
    </button>
  );
}

export function ExamPackageAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editLoadRef = useRef(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailStatus, setDetailStatus] = useState<DetailStatus>("idle");
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [detailExams, setDetailExams] = useState<PackageExam[]>([]);
  const [examSearch, setExamSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [nameError, setNameError] = useState("");

  const { data: catalog = [], isLoading: catalogLoading } = useQuery<CatalogPackage[]>({
    queryKey: ["/api/admin/exam-package-catalog"],
    retry: false,
  });

  const { data: allExams = [], isLoading: examsLoading } = useQuery<Exam[]>({
    queryKey: examKeys.adminAll,
    queryFn: async () => {
      const res = await fetch("/api/exams?includeInactive=1", { credentials: "include" });
      if (!res.ok) throw new Error("Không thể tải danh sách đề thi");
      return res.json();
    },
  });

  const { data: requests = [], isLoading: reqLoading } = useQuery<EntitlementRow[]>({
    queryKey: ["/api/admin/exam-packages"],
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const lookup = new Map<string, ExamListEntry>();
      for (const e of allExams) lookup.set(e.id, toExamListEntry(e));
      for (const e of detailExams) {
        if (!lookup.has(e.id)) lookup.set(e.id, toExamListEntry(e, editingId));
      }
      const validExamIds = selectedExamIds.filter((id) => lookup.has(id));
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        level: form.level || null,
        priceVnd: Number(form.priceVnd) || 0,
        compareAtPriceVnd:
          Number(form.compareAtPriceVnd) > Number(form.priceVnd)
            ? Number(form.compareAtPriceVnd)
            : null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
        examIds: validExamIds,
      };
      if (!body.name) throw new Error("Nhập tên gói");

      const wasEdit = !!editingId;
      const meta = {
        wasEdit,
        wasActive: form.isActive,
        requestedCount: selectedExamIds.length,
        demoCount: validExamIds.filter((id) => lookup.get(id)?.isDemo).length,
        orphanCount: selectedExamIds.length - validExamIds.length,
      };

      if (wasEdit) {
        const res = await apiRequest("PATCH", `/api/admin/exam-package-catalog/${editingId}`, body);
        const data = await res.json();
        return { ...data, ...meta };
      }
      const res = await apiRequest("POST", "/api/admin/exam-package-catalog", body);
      const data = await res.json();
      return { ...data, ...meta };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/exam-package-catalog"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/exam-packages"] });
      await queryClient.invalidateQueries({ queryKey: examKeys.adminAll });
      const linked = data?.linkedExamCount ?? 0;
      const missing = (data?.missingExamIds as string[] | undefined) ?? [];
      let description =
        linked > 0
          ? `Gói có ${linked} đề thi.`
          : data.wasActive
            ? "Chưa gắn đề — hãy chọn đề ở bước 2."
            : "Đã lưu nháp (chưa bán).";
      if (data.orphanCount > 0) {
        description += ` ${data.orphanCount} đề không còn trong hệ thống đã bỏ qua.`;
      }
      if (missing.length > 0) {
        description += ` ${missing.length} đề không tồn tại đã bỏ qua.`;
      }
      if (data.demoCount > 0) {
        description += ` Có ${data.demoCount} đề demo trong gói.`;
      }
      toast({
        title: data.wasEdit ? "Đã cập nhật gói đề" : "Đã tạo gói đề",
        description,
      });
      closeDialog();
    },
    onError: (e: Error) => {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/exam-package-catalog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exam-package-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exam-packages"] });
      toast({ title: "Đã xóa gói đề" });
    },
    onError: (e: Error) => {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/admin/exam-packages/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exam-packages"] });
      toast({ title: "Đã cập nhật yêu cầu mua gói" });
    },
    onError: (e: Error) => {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    },
  });

  const packageNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of catalog) m.set(p.id, p.name);
    return m;
  }, [catalog]);

  const formSale = useMemo(
    () =>
      getPackageSaleInfo({
        priceVnd: form.priceVnd,
        compareAtPriceVnd: form.compareAtPriceVnd,
      }),
    [form.priceVnd, form.compareAtPriceVnd],
  );

  const examLookup = useMemo(() => {
    const m = new Map<string, ExamListEntry>();
    for (const e of allExams) m.set(e.id, toExamListEntry(e));
    for (const e of detailExams) {
      if (!m.has(e.id)) m.set(e.id, toExamListEntry(e, editingId));
    }
    return m;
  }, [allExams, detailExams, editingId]);

  const selectedExams = useMemo(
    () =>
      selectedExamIds
        .map((id) => examLookup.get(id))
        .filter((e): e is ExamListEntry => !!e),
    [selectedExamIds, examLookup],
  );

  const orphanExamIds = useMemo(
    () => selectedExamIds.filter((id) => !examLookup.has(id)),
    [selectedExamIds, examLookup],
  );

  const levelMismatchCount = useMemo(() => {
    if (!form.level) return 0;
    return selectedExams.filter((e) => e.level && e.level !== form.level).length;
  }, [form.level, selectedExams]);

  const addableByLevelCount = useMemo(() => {
    if (!form.level) return 0;
    return allExams.filter(
      (e) => !selectedExamIds.includes(e.id) && e.level === form.level,
    ).length;
  }, [allExams, selectedExamIds, form.level]);

  const availableExams = useMemo(() => {
    const q = examSearch.trim().toLowerCase();
    return allExams.filter((exam) => {
      if (selectedExamIds.includes(exam.id)) return false;
      if (levelFilter !== "all" && exam.level !== levelFilter) return false;
      if (!q) return true;
      return (
        exam.title.toLowerCase().includes(q) ||
        (exam.level || "").toLowerCase().includes(q)
      );
    });
  }, [allExams, selectedExamIds, examSearch, levelFilter]);

  const openCreate = () => {
    editLoadRef.current += 1;
    setEditingId(null);
    setForm(emptyForm);
    setSelectedExamIds([]);
    setDetailExams([]);
    setExamSearch("");
    setLevelFilter("all");
    setNameError("");
    setDetailStatus("ready");
    setDialogOpen(true);
  };

  const loadPackageDetail = async (pkgId: string, loadToken: number) => {
    const res = await fetch(`/api/admin/exam-package-catalog/${pkgId}`, {
      credentials: "include",
    });
    if (loadToken !== editLoadRef.current) return;
    if (!res.ok) throw new Error("Không tải được chi tiết gói");
    const data = (await res.json()) as PackageDetail;
    if (loadToken !== editLoadRef.current) return;
    setForm({
      name: data.name,
      description: data.description || "",
      level: data.level || "",
      priceVnd: data.priceVnd,
      compareAtPriceVnd: data.compareAtPriceVnd ?? 0,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    });
    setSelectedExamIds((data.exams || []).map((e) => e.id));
    setDetailExams(data.exams || []);
    setLevelFilter(data.level || "all");
    setDetailStatus("ready");
  };

  const openEdit = async (pkg: CatalogPackage) => {
    const loadToken = ++editLoadRef.current;
    setEditingId(pkg.id);
    setSelectedExamIds([]);
    setDetailExams([]);
    setExamSearch("");
    setLevelFilter(pkg.level || "all");
    setNameError("");
    setDetailStatus("loading");
    setDialogOpen(true);

    try {
      await loadPackageDetail(pkg.id, loadToken);
    } catch {
      if (loadToken !== editLoadRef.current) return;
      setDetailStatus("error");
      toast({
        title: "Không tải được đề trong gói",
        description: "Thử lại hoặc kiểm tra kết nối.",
        variant: "destructive",
      });
    }
  };

  const closeDialog = () => {
    editLoadRef.current += 1;
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setSelectedExamIds([]);
    setDetailExams([]);
    setExamSearch("");
    setLevelFilter("all");
    setNameError("");
    setDetailStatus("idle");
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      setNameError("Vui lòng nhập tên gói đề");
      return;
    }
    if (editingId && detailStatus !== "ready") {
      toast({
        title: "Chưa tải xong dữ liệu",
        description: "Đợi danh sách đề tải xong hoặc thử tải lại.",
        variant: "destructive",
      });
      return;
    }
    if (form.isActive && (Number(form.priceVnd) || 0) <= 0) {
      toast({
        title: "Chưa nhập giá bán",
        description: "Gói đang bán cần giá lớn hơn 0.",
        variant: "destructive",
      });
      return;
    }
    const validCount = selectedExamIds.filter((id) => examLookup.has(id)).length;
    if (form.isActive && validCount === 0) {
      toast({
        title: "Chưa chọn đề thi",
        description:
          "Gói đang bán cần ít nhất 1 đề hợp lệ. Tắt 「Cho phép bán」 nếu muốn lưu nháp.",
        variant: "destructive",
      });
      return;
    }
    if (orphanExamIds.length > 0) {
      toast({
        title: "Đã bỏ đề không tồn tại",
        description: `${orphanExamIds.length} đề không còn trong hệ thống sẽ không được lưu.`,
      });
    }
    setNameError("");
    saveMutation.mutate();
  };

  const handleLevelChange = (level: string) => {
    setForm((f) => ({ ...f, level }));
    setLevelFilter(level || "all");
  };

  const addExamsByLevel = () => {
    if (!form.level) return;
    const candidates = allExams.filter(
      (e) => !selectedExamIds.includes(e.id) && e.level === form.level,
    );
    if (candidates.length === 0) {
      toast({
        title: "Không có đề phù hợp",
        description: `Không tìm thấy đề cấp ${form.level} để thêm.`,
      });
      return;
    }
    const fromOther = candidates.filter(
      (e) => e.packageId && e.packageId !== editingId,
    );
    if (fromOther.length > 0) {
      const ok = confirm(
        `${fromOther.length}/${candidates.length} đề cấp ${form.level} đang thuộc gói khác. Chuyển sang gói này?`,
      );
      if (!ok) return;
    }
    setSelectedExamIds((prev) => {
      const next = new Set(prev);
      for (const exam of candidates) next.add(exam.id);
      return [...next];
    });
  };

  const addAllVisible = () => {
    const fromOther = availableExams.filter(
      (e) => e.packageId && e.packageId !== editingId,
    );
    if (fromOther.length > 0) {
      const ok = confirm(
        `${fromOther.length} đề đang thuộc gói khác. Chuyển tất cả sang gói này?`,
      );
      if (!ok) return;
    }
    setSelectedExamIds((prev) => {
      const next = new Set(prev);
      for (const exam of availableExams) next.add(exam.id);
      return [...next];
    });
  };

  const clearSelected = () => {
    setSelectedExamIds([]);
  };

  const addExam = (exam: Exam) => {
    if (selectedExamIds.includes(exam.id)) return;
    if (exam.packageId && exam.packageId !== editingId) {
      const otherName = packageNameById.get(exam.packageId) || "gói khác";
      if (!confirm(`Đề này đang thuộc “${otherName}”. Chuyển sang gói này?`)) {
        return;
      }
    }
    setSelectedExamIds((prev) => [...prev, exam.id]);
  };

  const removeExam = (id: string) => {
    setSelectedExamIds((prev) => prev.filter((x) => x !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-[#00A651]" />
            Quản lý gói đề
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tạo gói bán, chọn đề thi từ hệ thống và duyệt yêu cầu mua gói.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Tạo gói đề
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Danh sách gói đề</CardTitle>
          <CardDescription>
            Mỗi gói gồm nhiều đề thi — bấm sửa để thêm hoặc bớt đề.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left border-y">
                <tr>
                  <th className="px-4 py-3 font-medium">Tên gói</th>
                  <th className="px-4 py-3 font-medium">Cấp</th>
                  <th className="px-4 py-3 font-medium">Đề đã gắn</th>
                  <th className="px-4 py-3 font-medium">Giá</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {catalogLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Đang tải…
                    </td>
                  </tr>
                ) : catalog.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Chưa có gói đề — bấm 「Tạo gói đề」 để bắt đầu.
                    </td>
                  </tr>
                ) : (
                  catalog.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3">{p.level || "—"}</td>
                      <td className="px-4 py-3">
                        {p.linkedExamCount ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const sale = getPackageSaleInfo(p);
                          return sale.onSale ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold tabular-nums">
                                  {formatVnd(sale.salePriceVnd)}
                                </span>
                                <Badge
                                  className="h-5 px-1.5 text-[10px] font-bold text-white border-0"
                                  style={{ backgroundColor: TNJS.orange }}
                                >
                                  -{sale.discountPercent}%
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground line-through tabular-nums">
                                {formatVnd(sale.compareAtPriceVnd!)}
                              </span>
                            </div>
                          ) : (
                            formatVnd(p.priceVnd)
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? "Đang bán" : "Tắt"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm(`Xóa gói “${p.name}”? Đề gắn sẽ bỏ liên kết.`)) {
                                deleteMutation.mutate(p.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Duyệt yêu cầu mua gói</CardTitle>
        </CardHeader>
        <CardContent>
          {reqLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          ) : !requests.length ? (
            <p className="text-sm text-muted-foreground">Chưa có yêu cầu mua gói nào.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Gói</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Số tiền</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2">
                        {row.packageId
                          ? packageNameById.get(row.packageId) || row.level
                          : row.level}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.userId}</td>
                      <td className="px-3 py-2">{formatVnd(row.amountVnd)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{row.status}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        {row.status === "pending" ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              disabled={review.isPending}
                              onClick={() => review.mutate({ id: row.id, status: "active" })}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={review.isPending}
                              onClick={() => review.mutate({ id: row.id, status: "rejected" })}
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Từ chối
                            </Button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="flex max-h-[92vh] w-[min(1120px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          {/* Header */}
          <div
            className="border-b px-6 py-5 pr-12"
            style={{ background: `linear-gradient(135deg, ${TNJS.green}12 0%, white 60%)` }}
          >
            <DialogHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                    style={{ backgroundColor: TNJS.green }}
                  >
                    <Package className="h-5 w-5" />
                  </span>
                  <div className="text-left">
                    <DialogTitle className="text-xl">
                      {editingId ? "Chỉnh sửa gói đề" : "Tạo gói đề mới"}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      Điền thông tin gói, sau đó chọn các đề thi muốn bán kèm.
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {selectedExamIds.length} đề
                  </Badge>
                  <Badge variant="secondary" className="font-normal">
                    {formatVnd(form.priceVnd)}
                  </Badge>
                  {formSale.onSale ? (
                    <Badge
                      className="font-normal text-white border-0"
                      style={{ backgroundColor: TNJS.orange }}
                    >
                      Sale -{formSale.discountPercent}%
                    </Badge>
                  ) : null}
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      form.isActive
                        ? "border-[#00A651]/40 text-[#00A651] bg-[#00A651]/5"
                        : "",
                    )}
                  >
                    {form.isActive ? "Đang bán" : "Chưa bán"}
                  </Badge>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
            {/* Step 1 — Basic info */}
            <section className="space-y-4">
              <SectionTitle
                step={1}
                title="Thông tin gói"
                description="Tên, giá và mô tả hiển thị trên trang luyện thi."
              />
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="pkg-name">
                      Tên gói <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pkg-name"
                      value={form.name}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, name: e.target.value }));
                        if (e.target.value.trim()) setNameError("");
                      }}
                      placeholder="VD: Gói luyện thi JLPT N3 — 10 đề"
                      className={cn("h-11", nameError && "border-red-500 focus-visible:ring-red-200")}
                    />
                    {nameError ? (
                      <p className="text-xs text-red-500">{nameError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Tên ngắn gọn, dễ hiểu — học viên sẽ thấy khi mua gói.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Cấp JLPT</Label>
                    <Select
                      value={form.level || "none"}
                      onValueChange={(v) => handleLevelChange(v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Chọn cấp" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Không gắn cấp</SelectItem>
                        {EXAM_LEVELS.map((lv) => (
                          <SelectItem key={lv} value={lv}>
                            {lv}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Gợi ý lọc đề phù hợp ở bước 2.
                      {form.level && addableByLevelCount > 0 ? (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 ml-1 text-xs"
                          onClick={addExamsByLevel}
                        >
                          Thêm {addableByLevelCount} đề {form.level}
                        </Button>
                      ) : null}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pkg-compare-price">Giá gốc (VNĐ)</Label>
                    <Input
                      id="pkg-compare-price"
                      type="number"
                      min={0}
                      step={1000}
                      className="h-11"
                      placeholder="Để trống nếu không sale"
                      value={form.compareAtPriceVnd || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          compareAtPriceVnd: Number(e.target.value) || 0,
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Nhập cao hơn giá sale để hiện gạch ngang và badge giảm giá trên thẻ.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pkg-price">Giá sale (VNĐ)</Label>
                    <Input
                      id="pkg-price"
                      type="number"
                      min={0}
                      step={1000}
                      className="h-11"
                      value={form.priceVnd}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, priceVnd: Number(e.target.value) || 0 }))
                      }
                    />
                    {formSale.onSale ? (
                      <p className="text-xs font-medium" style={{ color: TNJS.orange }}>
                        Sale: {formatVnd(formSale.salePriceVnd)}{" "}
                        <span className="line-through text-muted-foreground font-normal">
                          {formatVnd(formSale.compareAtPriceVnd!)}
                        </span>{" "}
                        (−{formSale.discountPercent}%)
                      </p>
                    ) : (
                      <p className="text-xs font-medium" style={{ color: TNJS.green }}>
                        Hiển thị: {formatVnd(form.priceVnd)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="pkg-desc">Mô tả ngắn</Label>
                    <Textarea
                      id="pkg-desc"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      placeholder="VD: Gói 10 đề thi thử chuẩn format JLPT N3, có đáp án và giải thích."
                      className="min-h-[80px] resize-y"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/20 px-4 py-3 md:col-span-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="pkg-active-dialog"
                        checked={form.isActive}
                        onCheckedChange={(checked) =>
                          setForm((f) => ({ ...f, isActive: checked }))
                        }
                      />
                      <div>
                        <Label htmlFor="pkg-active-dialog" className="cursor-pointer font-medium">
                          Cho phép bán gói này
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Tắt nếu chưa muốn hiển thị trên trang luyện thi.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5 w-full sm:w-36">
                      <Label htmlFor="pkg-sort" className="text-xs text-muted-foreground">
                        Thứ tự hiển thị
                      </Label>
                      <Input
                        id="pkg-sort"
                        type="number"
                        className="h-9"
                        value={form.sortOrder}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Step 2 — Exam picker */}
            <section className="space-y-4">
              <SectionTitle
                step={2}
                title="Chọn đề thi trong gói"
                description="Bấm vào đề bên phải để thêm · bấm đề bên trái để bỏ."
              />

              {levelMismatchCount > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {levelMismatchCount} đề đã chọn không khớp cấp{" "}
                  <strong>{form.level}</strong> — kiểm tra lại trước khi lưu.
                </div>
              ) : null}

              {orphanExamIds.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {orphanExamIds.length} đề không còn trong hệ thống — sẽ bỏ khi lưu.
                </div>
              ) : null}

              {detailStatus === "loading" ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-xl border bg-muted/10">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: TNJS.green }} />
                    <p className="text-sm">Đang tải danh sách đề…</p>
                  </div>
                </div>
              ) : detailStatus === "error" ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50/50 px-6 text-center">
                  <p className="text-sm font-medium text-red-700">
                    Không tải được đề trong gói. Lưu lúc này có thể xóa hết đề đã gắn.
                  </p>
                  {editingId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const loadToken = ++editLoadRef.current;
                        setDetailStatus("loading");
                        loadPackageDetail(editingId, loadToken).catch(() => {
                          if (loadToken !== editLoadRef.current) return;
                          setDetailStatus("error");
                        });
                      }}
                    >
                      Thử tải lại
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Selected */}
                  <div className="flex flex-col rounded-xl border overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between gap-2 border-b bg-[#00A651]/5 px-4 py-3">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          Đã chọn ({selectedExamIds.length})
                        </p>
                        <p className="text-xs text-muted-foreground">Đề sẽ được bán trong gói</p>
                      </div>
                      {selectedExamIds.length > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                          onClick={clearSelected}
                        >
                          Bỏ hết
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto bg-muted/10 p-3 min-h-[300px] max-h-[420px]">
                      {selectedExams.length > 0 ? (
                        selectedExams.map((exam) => (
                          <ExamListItem
                            key={exam.id}
                            exam={exam}
                            action="remove"
                            variant="remove"
                            onAction={() => removeExam(exam.id)}
                          />
                        ))
                      ) : (
                        <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed bg-white px-6 text-center">
                          <ChevronRight
                            className="h-8 w-8 text-muted-foreground/40 mb-2 rotate-180"
                          />
                          <p className="text-sm font-medium text-gray-700">Chưa có đề nào</p>
                          <p className="mt-1 text-xs text-muted-foreground max-w-[220px]">
                            Chọn đề từ danh sách bên phải để thêm vào gói.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Available */}
                  <div className="flex flex-col rounded-xl border overflow-hidden shadow-sm">
                    <div className="border-b bg-white px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-gray-900">
                            Đề có thể thêm ({availableExams.length})
                          </p>
                          <p className="text-xs text-muted-foreground">Toàn bộ đề trong hệ thống</p>
                        </div>
                        {availableExams.length > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0"
                            onClick={addAllVisible}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Thêm tất cả
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-9 h-9"
                            placeholder="Tìm theo tên đề…"
                            value={examSearch}
                            onChange={(e) => setExamSearch(e.target.value)}
                          />
                        </div>
                        <Select value={levelFilter} onValueChange={setLevelFilter}>
                          <SelectTrigger className="h-9 w-full sm:w-28">
                            <SelectValue placeholder="Cấp" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tất cả</SelectItem>
                            {EXAM_LEVELS.map((lv) => (
                              <SelectItem key={lv} value={lv}>
                                {lv}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto bg-white p-3 min-h-[300px] max-h-[420px]">
                      {examsLoading ? (
                        <div className="flex h-full min-h-[260px] items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : availableExams.length === 0 ? (
                        <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
                          <Search className="h-8 w-8 text-muted-foreground/40 mb-2" />
                          <p className="text-sm font-medium text-gray-700">Không tìm thấy đề</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Thử đổi từ khóa hoặc bộ lọc cấp.
                          </p>
                        </div>
                      ) : (
                        availableExams.map((exam) => {
                          const inOtherPackage =
                            exam.packageId && exam.packageId !== editingId;
                          return (
                            <ExamListItem
                              key={exam.id}
                              exam={exam}
                              action="add"
                              variant="add"
                              hint={inOtherPackage ? "Đang ở gói khác" : undefined}
                              onAction={() => addExam(exam)}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <DialogFooter className="flex-col gap-3 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground text-left w-full sm:w-auto">
              Gói gồm{" "}
              <strong className="text-gray-900">{selectedExams.length} đề</strong>
              {orphanExamIds.length > 0 ? (
                <span className="text-red-600"> (+{orphanExamIds.length} lỗi)</span>
              ) : null}
              {" · "}
              Giá <strong className="text-gray-900">{formatVnd(form.priceVnd)}</strong>
              {!form.isActive ? (
                <span className="text-muted-foreground"> · Nháp (chưa bán)</span>
              ) : null}
            </p>
            <div className="flex w-full sm:w-auto gap-2">
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={closeDialog}>
                Hủy
              </Button>
              <Button
                type="button"
                className="flex-1 sm:flex-none text-white hover:opacity-95"
                style={{ backgroundColor: TNJS.orange }}
                disabled={
                  saveMutation.isPending ||
                  (editingId !== null && detailStatus !== "ready")
                }
                onClick={handleSave}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang lưu…
                  </>
                ) : editingId ? (
                  "Lưu thay đổi"
                ) : (
                  "Tạo gói đề"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>    </div>
  );
}
