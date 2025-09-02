import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, FileText, Clock, Users } from "lucide-react";
import type { Exam } from "@shared/schema";

export function ExamManager() {
  const [, setLocation] = useLocation();
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; exam: Exam | null }>({
    isOpen: false,
    exam: null
  });
  const [currentPage, setCurrentPage] = useState(1);
  const examsPerPage = 10;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch exams
  const { data: exams = [], isLoading: examsLoading, refetch: refetchExams } = useQuery<Exam[]>({
    queryKey: ["/api/exams"],
  });



  // Delete exam mutation
  const deleteExamMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/exams/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Xóa bài thi thành công",
      });
      setDeleteConfirm({ isOpen: false, exam: null });
      refetchExams();
      // Reset to first page if current page becomes empty after deletion
      const newTotal = exams.length - 1;
      const newTotalPages = Math.ceil(newTotal / examsPerPage);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa bài thi",
        variant: "destructive",
      });
    },
  });



  const handleDeleteExam = (exam: Exam) => {
    setDeleteConfirm({ isOpen: true, exam });
  };

  const confirmDeleteExam = () => {
    if (deleteConfirm.exam) {
      deleteExamMutation.mutate(deleteConfirm.exam.id);
    }
  };

  const cancelDeleteExam = () => {
    setDeleteConfirm({ isOpen: false, exam: null });
  };

  const getExamStatusBadge = (exam: Exam) => {
    if (exam.isActive === false) {
      return <Badge variant="secondary">Không hoạt động</Badge>;
    }
    if (exam.isDemo) {
      return <Badge variant="outline">Demo</Badge>;
    }
    return <Badge variant="default">Chính thức</Badge>;
  };

  // Sort exams by newest first and calculate pagination
  const sortedExams = [...exams].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const totalPages = Math.ceil(sortedExams.length / examsPerPage);
  const startIndex = (currentPage - 1) * examsPerPage;
  const endIndex = startIndex + examsPerPage;
  const currentExams = sortedExams.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Quản lý bài thi
              </CardTitle>
              <CardDescription>
                Tạo và quản lý các bài thi trực tuyến
              </CardDescription>
            </div>
            <Button 
              onClick={() => setLocation("/create-exam")}
              className="flex items-center gap-2"
              data-testid="button-create-exam"
            >
              <Plus className="w-4 h-4" />
              Tạo bài thi mới
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {examsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sortedExams.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">Chưa có bài thi nào</p>
              <p className="text-sm">Tạo bài thi đầu tiên bằng cách nhấn nút "Tạo bài thi mới" ở trên</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Số câu hỏi</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentExams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {exam.title}
                      </div>
                      {exam.description && (
                        <div className="text-sm text-gray-500 mt-1">
                          {exam.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {getExamStatusBadge(exam)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {exam.timeLimit} phút
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        {exam.questionCount} câu
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(exam.createdAt).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLocation(`/edit-exam/${exam.id}`)}
                          data-testid={`button-edit-${exam.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteExam(exam)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-delete-${exam.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {sortedExams.length > 0 && (
            <div className="mt-6">
              <div className="mb-4 text-center text-sm text-muted-foreground">
                Hiển thị {startIndex + 1}-{Math.min(endIndex, sortedExams.length)} trong tổng số {sortedExams.length} bài thi
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



      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && cancelDeleteExam()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa bài thi</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa bài thi "{deleteConfirm.exam?.title}" không?
              <br />
              <span className="text-red-600 font-medium">Hành động này không thể hoàn tác và sẽ xóa tất cả câu hỏi liên quan.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDeleteExam}>
              Hủy
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteExam}
              disabled={deleteExamMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteExamMutation.isPending ? "Đang xóa..." : "Xóa bài thi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}