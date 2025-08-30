import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Eye, EyeOff, Power, PowerOff } from "lucide-react";
import { type ContactRequest, type User, type Article, type Exam } from "@shared/schema";

export function CpanelPageNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const messagesPerPage = 10;

  // Fetch data
  const { data: contactRequests = [] } = useQuery<ContactRequest[]>({
    queryKey: ["/api/contact-requests"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
  });

  const { data: exams = [] } = useQuery<Exam[]>({
    queryKey: ["/api/exams"],
  });

  // Sort contact requests by date
  const sortedMessages = contactRequests.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Pagination
  const totalPages = Math.ceil(sortedMessages.length / messagesPerPage);
  const startIndex = (currentPage - 1) * messagesPerPage;
  const endIndex = startIndex + messagesPerPage;
  const currentMessages = sortedMessages.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Toggle exam status mutation
  const toggleExamStatusMutation = useMutation({
    mutationFn: async (exam: Exam) => {
      const response = await fetch(`/api/exams/${exam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: exam.title,
          description: exam.description,
          isDemo: exam.isDemo,
          timeLimit: exam.timeLimit,
          isActive: !exam.isActive,
        }),
      });
      if (!response.ok) throw new Error("Failed to update exam");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật trạng thái bài thi",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái bài thi",
        variant: "destructive",
      });
    },
  });

  // Delete exam mutation
  const deleteExamMutation = useMutation({
    mutationFn: async (examId: string) => {
      const response = await fetch(`/api/exams/${examId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete exam");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      toast({
        title: "Thành công",
        description: "Đã xóa bài thi",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa bài thi",
        variant: "destructive",
      });
    },
  });

  const handleToggleExamStatus = (exam: Exam) => {
    toggleExamStatusMutation.mutate(exam);
  };

  const handleDeleteExam = (exam: Exam) => {
    if (confirm(`Bạn có chắc chắn muốn xóa bài thi "${exam.title}"?`)) {
      deleteExamMutation.mutate(exam.id);
    }
  };

  // Delete contact request mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/contact-requests/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete contact request");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-requests"] });
      toast({
        title: "Thành công",
        description: "Đã xóa yêu cầu liên hệ",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa yêu cầu liên hệ",
        variant: "destructive",
      });
    },
  });

  // Delete article mutation
  const deleteArticleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/articles/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete article");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      toast({
        title: "Thành công",
        description: "Đã xóa bài viết",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa bài viết",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50/50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Control Panel
          </h1>
          <p className="text-gray-600">
            Quản lý website và dữ liệu của công ty N&P
          </p>
        </div>

        <Tabs defaultValue="messages" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="messages">Tin nhắn</TabsTrigger>
            <TabsTrigger value="users">Người dùng</TabsTrigger>
            <TabsTrigger value="articles">Bài viết</TabsTrigger>
            <TabsTrigger value="exams">Bài thi</TabsTrigger>
            <TabsTrigger value="settings">Cài đặt</TabsTrigger>
          </TabsList>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Yêu cầu liên hệ</CardTitle>
                <CardDescription>
                  Quản lý các yêu cầu liên hệ từ khách hàng ({contactRequests.length} tổng)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Chưa có yêu cầu liên hệ nào
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentMessages.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-medium">{request.name}</h4>
                            <p className="text-sm text-gray-600">{request.email}</p>
                            {request.phone && (
                              <p className="text-sm text-gray-600">{request.phone}</p>
                            )}
                            {request.service && (
                              <Badge variant="secondary">{request.service}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {new Date(request.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteContactMutation.mutate(request.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm">{request.message}</p>
                      </div>
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          Trước
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Sau
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quản lý người dùng</CardTitle>
                <CardDescription>
                  Danh sách người dùng hệ thống ({users.length} tổng)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên đăng nhập</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Vai trò</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.email || "Chưa có"}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Articles Tab */}
          <TabsContent value="articles" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Quản lý bài viết</CardTitle>
                  <CardDescription>
                    Danh sách bài viết trên website ({articles.length} tổng)
                  </CardDescription>
                </div>
                <Button onClick={() => setLocation("/create-article")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tạo bài viết
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tiêu đề</TableHead>
                      <TableHead>Danh mục</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {articles.map((article) => (
                      <TableRow key={article.id}>
                        <TableCell className="font-medium">{article.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{article.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(article.createdAt).toLocaleDateString("vi-VN")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(`/article/${article.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(`/edit-article/${article.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Bạn có chắc chắn muốn xóa bài viết "${article.title}"?`)) {
                                  deleteArticleMutation.mutate(article.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Exams Tab */}
          <TabsContent value="exams" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Quản lý bài thi</CardTitle>
                  <CardDescription>
                    Danh sách bài thi trực tuyến ({exams.length} tổng)
                  </CardDescription>
                </div>
                <Button onClick={() => setLocation("/create-exam")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tạo bài thi
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tiêu đề</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Câu hỏi</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exams.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium">{exam.title}</TableCell>
                        <TableCell>
                          <Badge variant={exam.isDemo ? "secondary" : "default"}>
                            {exam.isDemo ? "Demo" : "Chính thức"}
                          </Badge>
                        </TableCell>
                        <TableCell>{exam.timeLimit} phút</TableCell>
                        <TableCell>{exam.questionCount || 0} câu</TableCell>
                        <TableCell>
                          <Badge variant={exam.isActive ? "default" : "secondary"}>
                            {exam.isActive ? "Hoạt động" : "Tạm dừng"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(exam.createdAt).toLocaleDateString("vi-VN")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(`/edit-exam/${exam.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleExamStatus(exam)}
                              disabled={toggleExamStatusMutation.isPending}
                            >
                              {exam.isActive ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteExam(exam)}
                              disabled={deleteExamMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cài đặt hệ thống</CardTitle>
                <CardDescription>
                  Cấu hình và thiết lập website
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Tính năng cài đặt sẽ được phát triển trong phiên bản tương lai.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}