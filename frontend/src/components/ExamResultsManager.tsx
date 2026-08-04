import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Eye, FileText, Search, Trophy } from "lucide-react";
import type { Exam, ExamAttempt } from "@shared/schema";
import { examKeys } from "@/lib/queryKeys";
import { formatScore } from "@/lib/examPass";
import { useToast } from "@/hooks/use-toast";

type ResultFilter = "all" | "passed" | "failed";

interface AdminAttemptRow extends ExamAttempt {
  userInfo: {
    username: string;
    fullName: string | null;
  } | null;
  examTitle: string;
  passed: boolean;
}

interface AdminAttemptsResponse {
  items: AdminAttemptRow[];
  total: number;
}

const PAGE_SIZE = 15;
const CSV_FETCH_LIMIT = 5000;

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function downloadCsv(filename: string, rows: string[][]) {
  const bom = "\uFEFF";
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  const blob = new Blob([bom + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExamResultsManager() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [examFilter, setExamFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, examFilter, resultFilter]);

  const { data: exams = [] } = useQuery<Exam[]>({
    queryKey: examKeys.adminAll,
    queryFn: async () => {
      const res = await fetch("/api/exams?includeInactive=1", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Không thể tải danh sách đề thi");
      return res.json();
    },
  });

  const offset = (currentPage - 1) * PAGE_SIZE;
  const listParams = useMemo(
    () => ({
      examId: examFilter === "all" ? undefined : examFilter,
      q: searchQuery || undefined,
      result: resultFilter === "all" ? undefined : resultFilter,
      limit: PAGE_SIZE,
      offset,
    }),
    [examFilter, searchQuery, resultFilter, offset]
  );

  const {
    data,
    isLoading,
    isError,
  } = useQuery<AdminAttemptsResponse>({
    queryKey: examKeys.adminAttempts(listParams),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (listParams.examId) params.set("examId", listParams.examId);
      if (listParams.q) params.set("q", listParams.q);
      if (listParams.result) params.set("result", listParams.result);
      params.set("limit", String(listParams.limit));
      params.set("offset", String(listParams.offset));
      const res = await fetch(`/api/admin/exam-attempts?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Không thể tải kết quả thi");
      return res.json();
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (seconds: number | null | undefined) => {
    const s = Number(seconds) || 0;
    const minutes = Math.floor(s / 60);
    const secs = s % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (examFilter !== "all") params.set("examId", examFilter);
      if (searchQuery) params.set("q", searchQuery);
      if (resultFilter !== "all") params.set("result", resultFilter);
      params.set("limit", String(CSV_FETCH_LIMIT));
      params.set("offset", "0");

      const res = await fetch(`/api/admin/exam-attempts?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Không thể xuất CSV");
      const payload: AdminAttemptsResponse = await res.json();
      const rows: string[][] = [
        [
          "Ngày thi",
          "Đề thi",
          "Tên đăng nhập",
          "Họ và tên",
          "Tổng điểm",
          "Thời gian (giây)",
          "Kết quả",
          "Mã lượt thi",
        ],
        ...payload.items.map((row) => [
          formatDate(row.completedAt),
          row.examTitle,
          row.userInfo?.username || "khách",
          row.userInfo?.fullName || "",
          formatScore(Number(row.totalScore) || 0),
          String(Number(row.totalTimeSpent) || 0),
          row.passed ? "Đạt" : "Không đạt",
          row.id,
        ]),
      ];

      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`ket-qua-thi-${stamp}.csv`, rows);

      toast({
        title: "Đã xuất CSV",
        description:
          payload.total > CSV_FETCH_LIMIT
            ? `Đã xuất ${payload.items.length} / ${payload.total} dòng (giới hạn ${CSV_FETCH_LIMIT}).`
            : `Đã xuất ${payload.items.length} dòng.`,
      });
    } catch (e: any) {
      toast({
        title: "Lỗi xuất CSV",
        description: e?.message || "Không thể xuất file",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Kết quả thi
            </CardTitle>
            <CardDescription className="mt-1">
              Xem lượt nộp bài theo đề / thí sinh · {total} kết quả
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={exporting || total === 0}
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Đang xuất..." : "Xuất CSV"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm thí sinh (tên đăng nhập / họ tên)..."
              className="pl-9"
              data-testid="input-search-results"
            />
          </div>
          <Select value={examFilter} onValueChange={setExamFilter}>
            <SelectTrigger className="w-full lg:w-[260px]" data-testid="select-exam-filter">
              <SelectValue placeholder="Chọn đề thi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả đề thi</SelectItem>
              {exams.map((exam) => (
                <SelectItem key={exam.id} value={exam.id}>
                  {exam.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={resultFilter}
            onValueChange={(v) => setResultFilter(v as ResultFilter)}
          >
            <SelectTrigger className="w-full lg:w-[180px]" data-testid="select-result-filter">
              <SelectValue placeholder="Kết quả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả kết quả</SelectItem>
              <SelectItem value="passed">Đạt</SelectItem>
              <SelectItem value="failed">Không đạt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-red-600">
            Không tải được danh sách kết quả thi
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">Không có kết quả</p>
            <p className="text-sm">Thử đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày thi</TableHead>
                    <TableHead>Đề thi</TableHead>
                    <TableHead>Thí sinh</TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Tổng điểm</TableHead>
                    <TableHead>Kết quả</TableHead>
                    <TableHead>Chi tiết</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(row.completedAt)}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <span className="line-clamp-2">{row.examTitle}</span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {row.userInfo?.fullName || row.userInfo?.username || "Khách"}
                        </div>
                        {row.userInfo?.fullName && (
                          <div className="text-xs text-muted-foreground">
                            @{row.userInfo.username}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{formatTime(row.totalTimeSpent)}</TableCell>
                      <TableCell className="font-medium">
                        {formatScore(Number(row.totalScore) || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.passed ? "default" : "destructive"}>
                          {row.passed ? "Đạt" : "Không đạt"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/exam-result/${row.id}`)}
                          data-testid={`button-view-result-${row.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
