import { useLocation } from "wouter";
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
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, FileText, Trophy, Clock, User, Search, ShieldAlert } from "lucide-react";
import type { Exam, ExamAttempt } from "@shared/schema";
import { useEffect, useMemo, useState } from "react";
import { examKeys } from "@/lib/queryKeys";
import {
  didAttemptPass,
  formatScore,
  getAttemptSectionScores,
} from "@/lib/examPass";
import { useAuth } from "@/hooks/useAuth";

interface ExamAttemptsPageProps {
  examId: string;
}

interface AttemptWithUserInfo extends ExamAttempt {
  userInfo: {
    username: string;
    fullName: string | null;
  } | null;
}

type ResultFilter = "all" | "passed" | "failed";

export default function ExamAttemptsPage({ examId }: ExamAttemptsPageProps) {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const attemptsPerPage = 10;

  const canManage = user?.role === "admin" || user?.role === "manager";

  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: examKeys.detail(examId),
    enabled: canManage,
  });

  const {
    data: attempts = [],
    isLoading: attemptsLoading,
    isError: attemptsError,
  } = useQuery<AttemptWithUserInfo[]>({
    queryKey: examKeys.attempts(examId),
    enabled: canManage,
    retry: false,
  });

  const filteredAttempts = useMemo(() => {
    if (!exam) return [];
    const q = searchQuery.trim().toLowerCase();

    return [...attempts]
      .filter((attempt) => {
        const passed = didAttemptPass(exam, attempt);
        if (resultFilter === "passed" && !passed) return false;
        if (resultFilter === "failed" && passed) return false;

        if (!q) return true;
        const username = (attempt.userInfo?.username || "khách").toLowerCase();
        const fullName = (attempt.userInfo?.fullName || "").toLowerCase();
        return username.includes(q) || fullName.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.completedAt || 0).getTime() -
          new Date(a.completedAt || 0).getTime()
      );
  }, [attempts, exam, searchQuery, resultFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, resultFilter, examId]);

  const totalPages = Math.ceil(filteredAttempts.length / attemptsPerPage);
  const startIndex = (currentPage - 1) * attemptsPerPage;
  const endIndex = startIndex + attemptsPerPage;
  const currentAttempts = filteredAttempts.slice(startIndex, endIndex);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-10 space-y-4">
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold">Cần đăng nhập</h2>
            <p className="text-gray-600 text-sm">
              Chỉ admin/manager mới xem được danh sách điểm thi.
            </p>
            <Button
              onClick={() =>
                setLocation(`/login?redirect=/exam-attempts/${examId}`)
              }
            >
              Đăng nhập
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-10 space-y-4">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold">Không có quyền truy cập</h2>
            <p className="text-gray-600 text-sm">
              Trang này chỉ dành cho admin và manager.
            </p>
            <Button variant="outline" onClick={() => setLocation("/cpanel/exams")}>
              Về quản lý đề thi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (examLoading || attemptsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (attemptsError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-10 space-y-4">
            <h2 className="text-xl font-semibold">Không tải được dữ liệu</h2>
            <p className="text-gray-600 text-sm">
              Không thể lấy danh sách lượt thi. Thử lại hoặc quay về Cpanel.
            </p>
            <Button variant="outline" onClick={() => setLocation("/cpanel/exams")}>
              Về quản lý đề thi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Không tìm thấy bài thi</h2>
            <Button onClick={() => setLocation("/cpanel/exams")}>
              Về quản lý đề thi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/cpanel/exams")}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Về quản lý đề thi
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Xem điểm · Lượt thi</h1>
            <p className="text-gray-600 mt-1">{exam.title}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Lịch sử thi ({filteredAttempts.length}
              {filteredAttempts.length !== attempts.length
                ? ` / ${attempts.length}`
                : ""}{" "}
              lượt)
            </CardTitle>
            <CardDescription>
              Điểm và kết quả của thí sinh đã nộp bài đề này
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên đăng nhập hoặc họ tên..."
                  className="pl-9"
                  data-testid="input-search-attempts"
                />
              </div>
              <Select
                value={resultFilter}
                onValueChange={(v) => setResultFilter(v as ResultFilter)}
              >
                <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-result-filter">
                  <SelectValue placeholder="Kết quả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả kết quả</SelectItem>
                  <SelectItem value="passed">Đạt</SelectItem>
                  <SelectItem value="failed">Không đạt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {attempts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Chưa có lượt thi nào</p>
                <p className="text-sm">Chưa có ai nộp bài thi này</p>
              </div>
            ) : filteredAttempts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Không có kết quả phù hợp</p>
                <p className="text-sm">Thử đổi từ khóa hoặc bộ lọc kết quả</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên đăng nhập</TableHead>
                      <TableHead>Họ và tên</TableHead>
                      <TableHead>Ngày thi</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Điểm từng phần</TableHead>
                      <TableHead>Tổng điểm</TableHead>
                      <TableHead>Kết quả</TableHead>
                      <TableHead>Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentAttempts.map((attempt) => {
                      const passed = didAttemptPass(exam, attempt);
                      const sectionScores = getAttemptSectionScores(exam, attempt);

                      return (
                        <TableRow key={attempt.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400 shrink-0" />
                              {attempt.userInfo?.username || "Khách"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {attempt.userInfo?.fullName || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(
                              (
                                attempt.completedAt ||
                                attempt.startedAt ||
                                new Date()
                              ).toString()
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 whitespace-nowrap">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {formatTime(attempt.totalTimeSpent)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {sectionScores.length === 0 ? (
                              <span className="text-gray-400 text-sm">—</span>
                            ) : (
                              <div className="flex flex-col gap-1 min-w-[140px]">
                                {sectionScores.map((s) => (
                                  <div
                                    key={s.sectionId}
                                    className="flex items-center justify-between gap-2 text-xs"
                                  >
                                    <span
                                      className="text-gray-600 truncate max-w-[100px]"
                                      title={s.label}
                                    >
                                      {s.label}
                                    </span>
                                    <span
                                      className={
                                        s.passed
                                          ? "font-medium text-gray-900"
                                          : "font-medium text-red-600"
                                      }
                                    >
                                      {formatScore(s.score)}
                                      {s.passingScore != null && s.passingScore > 0
                                        ? `/${formatScore(s.passingScore)}`
                                        : ""}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">
                              {formatScore(Number(attempt.totalScore) || 0)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {passed ? (
                              <Badge variant="default" className="bg-green-500">
                                Đạt
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Không đạt</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setLocation(`/exam-result/${attempt.id}`)
                              }
                              title="Xem chi tiết kết quả"
                              data-testid={`button-view-result-${attempt.id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Chi tiết
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {filteredAttempts.length > 0 && (
              <div className="mt-2">
                <div className="mb-4 text-center text-sm text-muted-foreground">
                  Hiển thị {startIndex + 1}-
                  {Math.min(endIndex, filteredAttempts.length)} trong{" "}
                  {filteredAttempts.length} lượt
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.max(totalPages, 1)}
                  onPageChange={setCurrentPage}
                  className="justify-center"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
