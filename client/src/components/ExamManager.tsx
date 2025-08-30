import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, FileText, Clock, Users, Eye } from "lucide-react";
import type { Exam } from "@shared/schema";

export function ExamManager() {
  const [, setLocation] = useLocation();
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; exam: Exam | null }>({
    isOpen: false,
    exam: null
  });
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    timeLimit: 30,
    isDemo: false,
    isActive: true
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch exams
  const { data: exams = [], isLoading: examsLoading, refetch: refetchExams } = useQuery<Exam[]>({
    queryKey: ["/api/exams"],
  });

  // Update exam mutation
  const updateExamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/exams/${id}`, "PUT", data);
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Cập nhật bài thi thành công",
      });
      setEditingExam(null);
      refetchExams();
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật bài thi",
        variant: "destructive",
      });
    },
  });

  // Delete exam mutation
  const deleteExamMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/exams/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Xóa bài thi thành công",
      });
      setDeleteConfirm({ isOpen: false, exam: null });
      refetchExams();
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa bài thi",
        variant: "destructive",
      });
    },
  });

  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      title: exam.title,
      description: exam.description || "",
      timeLimit: exam.timeLimit,
      isDemo: exam.isDemo || false,
      isActive: exam.isActive !== false
    });
  };

  const handleSaveExam = async () => {
    if (!formData.title || !formData.timeLimit) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc",
        variant: "destructive",
      });
      return;
    }

    if (!editingExam) return;

    updateExamMutation.mutate({
      id: editingExam.id,
      data: formData
    });
  };

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
          ) : exams.length === 0 ? (
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
                {exams.map((exam) => (
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
                          onClick={() => setLocation(`/exam/${exam.id}`)}
                          className="text-blue-600 hover:text-blue-700"
                          data-testid={`button-view-${exam.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditExam(exam)}
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
        </CardContent>
      </Card>

      {/* Edit Exam Dialog */}
      <Dialog open={!!editingExam} onOpenChange={(open) => !open && setEditingExam(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa bài thi</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin bài thi
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Tiêu đề *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Nhập tiêu đề bài thi"
                data-testid="input-edit-title"
              />
            </div>
            <div>
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Nhập mô tả bài thi (tùy chọn)"
                rows={3}
                data-testid="input-edit-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="timeLimit">Thời gian (phút) *</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  min="1"
                  value={formData.timeLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, timeLimit: parseInt(e.target.value) }))}
                  data-testid="input-edit-time-limit"
                />
              </div>
              <div className="space-y-2">
                <Label>Cài đặt</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isDemo"
                    checked={formData.isDemo}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDemo: !!checked }))}
                    data-testid="checkbox-edit-demo"
                  />
                  <Label htmlFor="isDemo" className="text-sm">Bài thi demo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: !!checked }))}
                    data-testid="checkbox-edit-active"
                  />
                  <Label htmlFor="isActive" className="text-sm">Kích hoạt</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingExam(null)}>
              Hủy
            </Button>
            <Button 
              onClick={handleSaveExam}
              disabled={updateExamMutation.isPending}
              data-testid="button-save-exam"
            >
              {updateExamMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && cancelDeleteExam()}>
        <DialogContent>
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