import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, FileText, Trophy, Clock, User } from "lucide-react";
import type { Exam, ExamAttempt } from "@shared/schema";
import { useState } from "react";

interface ExamAttemptsPageProps {
  examId: string;
}

interface AttemptWithUserInfo extends ExamAttempt {
  userInfo: {
    username: string;
    fullName: string | null;
  } | null;
}

export default function ExamAttemptsPage({ examId }: ExamAttemptsPageProps) {
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const attemptsPerPage = 10;

  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: ["/api/exams", examId],
  });

  const { data: attempts = [], isLoading: attemptsLoading } = useQuery<AttemptWithUserInfo[]>({
    queryKey: [`/api/exams/${examId}/attempts`],
  });

  const sortedAttempts = [...attempts].sort((a, b) => 
    new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  const totalPages = Math.ceil(sortedAttempts.length / attemptsPerPage);
  const startIndex = (currentPage - 1) * attemptsPerPage;
  const endIndex = startIndex + attemptsPerPage;
  const currentAttempts = sortedAttempts.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

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

  const getResultBadge = (attempt: AttemptWithUserInfo, exam: Exam) => {
    const passingScore = (exam as any).passingScore || 0;
    const passed = attempt.totalScore >= passingScore;
    return passed ? (
      <Badge variant="default" className="bg-green-500">Đạt</Badge>
    ) : (
      <Badge variant="destructive">Không đạt</Badge>
    );
  };

  if (examLoading || attemptsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Không tìm thấy bài thi</h2>
            <Button onClick={() => window.history.back()}>
              Quay lại
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
            onClick={() => window.history.back()}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Danh sách lượt thi</h1>
            <p className="text-gray-600 mt-1">{exam.title}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Lịch sử thi ({sortedAttempts.length} lượt)
            </CardTitle>
            <CardDescription>
              Danh sách những người đã làm bài thi này
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedAttempts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Chưa có lượt thi nào</p>
                <p className="text-sm">Chưa có ai làm bài thi này</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên đăng nhập</TableHead>
                    <TableHead>Họ và Tên</TableHead>
                    <TableHead>Ngày thi</TableHead>
                    <TableHead>Thời gian làm bài</TableHead>
                    <TableHead>Điểm thi</TableHead>
                    <TableHead>Kết quả</TableHead>
                    <TableHead>Chi tiết</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentAttempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          {attempt.userInfo?.username || "Khách"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {attempt.userInfo?.fullName || "-"}
                      </TableCell>
                      <TableCell>
                        {formatDate(attempt.completedAt.toString())}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {formatTime(attempt.totalTimeSpent)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{attempt.totalScore}</span>
                      </TableCell>
                      <TableCell>
                        {getResultBadge(attempt, exam)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLocation(`/exam-result/${attempt.id}`)}
                          title="Xem chi tiết kết quả"
                          data-testid={`button-view-result-${attempt.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {sortedAttempts.length > 0 && (
              <div className="mt-6">
                <div className="mb-4 text-center text-sm text-muted-foreground">
                  Hiển thị {startIndex + 1}-{Math.min(endIndex, sortedAttempts.length)} trong tổng số {sortedAttempts.length} lượt thi
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.max(totalPages, 1)}
                  onPageChange={handlePageChange}
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
