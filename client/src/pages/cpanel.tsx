import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { ArticleManager } from "@/components/ArticleManager";
import { ExamManager } from "@/components/ExamManager";
import { ContactInfoManager } from "@/components/ContactInfoManager";
import { QuestionBankManager } from "@/components/QuestionBankManager";

import { Pagination } from "@/components/ui/pagination";
import { Users, MessageSquare, Shield, User, Plus, Edit, Eye, EyeOff, Trash2, FileText, Image, Check, X, MapPin, HelpCircle } from "lucide-react";
import { type User as UserType, type ContactRequest, type RegistrationRequest } from "@shared/schema";

interface CpanelPageProps {
  tab?: string;
}

export function CpanelPage({ tab }: CpanelPageProps) {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("");
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [formData, setFormData] = useState({ username: "", fullName: "", email: "", phone: "", password: "" });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; user: UserType | null }>({
    isOpen: false,
    user: null
  });
  const [messageDetail, setMessageDetail] = useState<{ isOpen: boolean; message: any | null }>({
    isOpen: false,
    message: null
  });
  const [deleteMessageConfirm, setDeleteMessageConfirm] = useState<{ isOpen: boolean; message: any | null }>({
    isOpen: false,
    message: null
  });
  const [deleteRegistrationConfirm, setDeleteRegistrationConfirm] = useState<{ isOpen: boolean; registration: any | null }>({
    isOpen: false,
    registration: null
  });
  const [currentPage, setCurrentPage] = useState(1);
  const messagesPerPage = 9;
  const { toast } = useToast();

  useEffect(() => {
    // Don't do anything while authentication is loading
    if (isLoading) return;
    
    // If not authenticated, redirect to login
    if (!isAuthenticated || !user) {
      toast({
        title: "Không có quyền truy cập",
        description: "Vui lòng đăng nhập để truy cập trang này.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }
    
    // Check if user has permission to access Control Panel
    if (user.role === 'user') {
      toast({
        title: "Không có quyền truy cập",
        description: "Chỉ Manager và Admin mới có thể truy cập Control Panel.",
        variant: "destructive",
      });
      setLocation("/");
      return;
    }
    
    // Valid tabs list
    const validTabs = ['registrations', 'exams', 'questions', 'articles', 'contact-info', 'messages', 'users'];
    const defaultTab = (user.role === "manager" || user.role === "admin") ? "registrations" : "exams";
    
    // Check URL path for tab (from route param)
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
    } else {
      // No tab or invalid tab in URL, redirect to default tab
      setLocation(`/cpanel/${defaultTab}`, { replace: true });
    }
  }, [isLoading, isAuthenticated, user, setLocation, toast, tab]);

  // Define permissions based on user role
  const isManager = user?.role === "manager";
  const canManageUsers = user?.role === "manager"; // Only managers can manage users
  const canManageRegistrations = user?.role === "manager" || user?.role === "admin";

  // Fetch users (for managers only)
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "manager",
  });

  // Fetch messages/contact requests
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchContactRequests } = useQuery<ContactRequest[]>({
    queryKey: ["/api/contact"],
    enabled: !!user,
  });

  // Fetch registration requests (for managers and admins)
  const { data: registrationRequests = [], isLoading: registrationsLoading, refetch: refetchRegistrations } = useQuery<RegistrationRequest[]>({
    queryKey: ["/api/registration-requests"],
    enabled: !!user && canManageRegistrations,
  });

  const handleEditUser = (userToEdit: UserType) => {
    setEditingUser(userToEdit);
    setFormData({
      username: userToEdit.username,
      fullName: userToEdit.fullName || "",
      email: userToEdit.email || "",
      phone: userToEdit.phone || "",
      password: "", // Don't show existing password
    });
  };

  const handleSaveUser = async () => {
    if (!formData.username) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tên đăng nhập",
        variant: "destructive",
      });
      return;
    }
    
    if (!editingUser && !formData.password) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mật khẩu cho người dùng mới",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          fullName: formData.fullName || null,
          email: formData.email || null,
          phone: formData.phone || null,
          password: formData.password,
          role: "admin", // Default role is admin
        }),
      });

      if (response.ok) {
        toast({
          title: "Thành công",
          description: editingUser ? "Đã cập nhật người dùng" : "Đã thêm người dùng mới",
        });
        refetchUsers();
        setEditingUser(null);
        setIsAddingUser(false);
        setFormData({ username: "", fullName: "", email: "", phone: "", password: "" });
        setShowFormPassword(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Có lỗi xảy ra");
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể lưu người dùng",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = (userToDelete: UserType) => {
    setDeleteConfirm({ isOpen: true, user: userToDelete });
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirm.user) return;

    try {
      const response = await fetch(`/api/users/${deleteConfirm.user.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Thành công",
          description: "Đã xóa người dùng thành công",
        });
        refetchUsers();
      } else {
        throw new Error("Failed to delete user");
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa người dùng",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirm({ isOpen: false, user: null });
    }
  };

  const cancelDeleteUser = () => {
    setDeleteConfirm({ isOpen: false, user: null });
  };

  const handleViewMessage = (message: any) => {
    setMessageDetail({ isOpen: true, message });
  };

  const handleDeleteMessage = (message: any) => {
    setDeleteMessageConfirm({ isOpen: true, message });
  };

  const confirmDeleteMessage = async () => {
    if (!deleteMessageConfirm.message) return;
    
    try {
      const response = await fetch(`/api/contact/${deleteMessageConfirm.message.id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        toast({
          title: "Thành công",
          description: "Đã xóa tin nhắn thành công",
        });
        refetchContactRequests();
        // Reset to first page if current page becomes empty after deletion
        const newTotal = sortedMessages.length - 1;
        const newTotalPages = Math.ceil(newTotal / messagesPerPage);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages);
        }
      } else {
        throw new Error("Failed to delete message");
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa tin nhắn",
        variant: "destructive",
      });
    } finally {
      setDeleteMessageConfirm({ isOpen: false, message: null });
    }
  };

  const cancelDeleteMessage = () => {
    setDeleteMessageConfirm({ isOpen: false, message: null });
  };

  // Registration handlers
  const handleApproveRegistration = async (requestId: string) => {
    try {
      const response = await fetch(`/api/registration-requests/${requestId}/approve`, {
        method: "POST",
      });

      if (response.ok) {
        toast({
          title: "Thành công",
          description: "Đã duyệt đăng ký và tạo tài khoản",
        });
        refetchRegistrations();
        refetchUsers(); // Cập nhật danh sách users để hiển thị tài khoản mới được duyệt
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Có lỗi xảy ra");
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể duyệt đăng ký",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRegistration = (registration: any) => {
    setDeleteRegistrationConfirm({ isOpen: true, registration });
  };

  const confirmDeleteRegistration = async () => {
    if (!deleteRegistrationConfirm.registration) return;

    try {
      const response = await fetch(`/api/registration-requests/${deleteRegistrationConfirm.registration.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Thành công",
          description: "Đã xóa yêu cầu đăng ký",
        });
        refetchRegistrations();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Có lỗi xảy ra");
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa yêu cầu đăng ký",
        variant: "destructive",
      });
    } finally {
      setDeleteRegistrationConfirm({ isOpen: false, registration: null });
    }
  };

  const cancelDeleteRegistration = () => {
    setDeleteRegistrationConfirm({ isOpen: false, registration: null });
  };

  const getServiceName = (service: string) => {
    const serviceNames: Record<string, string> = {
      'visa-services': 'Dịch vụ Visa',
      'study-abroad': 'Du học',
      'japanese-training': 'Đào tạo tiếng Nhật',


    };
    return serviceNames[service] || service || 'Chưa chọn';
  };

  if (!user) {
    return null; // Will redirect to login
  }

  // Sort messages by newest first and calculate pagination
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const totalPages = Math.ceil(sortedMessages.length / messagesPerPage);
  const startIndex = (currentPage - 1) * messagesPerPage;
  const endIndex = startIndex + messagesPerPage;
  const currentMessages = sortedMessages.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Control Panel
          </h1>
          <p className="text-gray-600 mt-2 mb-6">
            Chào mừng {user.username} ({user.role})
          </p>
        </div>

        <div className="flex gap-8">
          {/* Left Sidebar - Navigation */}
          <div className="flex-shrink-0">
            <div className="space-y-2">
              {canManageRegistrations && (
                <Button 
                  variant={activeTab === "registrations" ? "default" : "ghost"}
                  className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                  onClick={() => setLocation("/cpanel/registrations")}
                >
                  <Shield className="w-5 h-5" />
                  Duyệt đăng ký
                </Button>
              )}
              <Button 
                variant={activeTab === "exams" ? "default" : "ghost"}
                className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                onClick={() => setLocation("/cpanel/exams")}
              >
                <FileText className="w-5 h-5" />
                Quản lý bài thi
              </Button>
              <Button 
                variant={activeTab === "questions" ? "default" : "ghost"}
                className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                onClick={() => setLocation("/cpanel/questions")}
              >
                <HelpCircle className="w-5 h-5" />
                Bộ câu hỏi
              </Button>
              <Button 
                variant={activeTab === "articles" ? "default" : "ghost"}
                className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                onClick={() => setLocation("/cpanel/articles")}
              >
                <FileText className="w-5 h-5" />
                Quản lý bài viết
              </Button>
              <Button 
                variant={activeTab === "contact-info" ? "default" : "ghost"}
                className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                onClick={() => setLocation("/cpanel/contact-info")}
              >
                <MapPin className="w-5 h-5" />
                Thông tin liên hệ
              </Button>
              <Button 
                variant={activeTab === "messages" ? "default" : "ghost"}
                className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                onClick={() => setLocation("/cpanel/messages")}
              >
                <MessageSquare className="w-5 h-5" />
                Tin nhắn liên hệ
              </Button>
              {canManageUsers && (
                <Button 
                  variant={activeTab === "users" ? "default" : "ghost"}
                  className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                  onClick={() => setLocation("/cpanel/users")}
                >
                  <Users className="w-5 h-5" />
                  Quản lý người dùng
                </Button>
              )}
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1">
            {/* Articles Content - Available for all users */}
            {activeTab === "articles" && (
              <ArticleManager />
            )}

            {/* Users Content - For managers and admins */}
            {canManageUsers && activeTab === "users" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="w-5 h-5" />
                          Danh sách người dùng
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground mt-[12px] mb-[12px]">
                          Quản lý tất cả người dùng trong hệ thống
                        </CardDescription>
                      </div>
                      {!isAddingUser && !editingUser && (
                        <Button 
                          onClick={() => setIsAddingUser(true)}
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Thêm người dùng
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(isAddingUser || editingUser) && (
                      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                        <h3 className="font-medium mb-4">
                          {editingUser ? "Chỉnh sửa người dùng" : "Thêm người dùng mới"}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Tên đăng nhập</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border rounded-md"
                              value={formData.username}
                              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                              placeholder="Nhập tên đăng nhập"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Họ tên</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border rounded-md"
                              value={formData.fullName}
                              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                              placeholder="Nhập họ tên (không bắt buộc)"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Email</label>
                            <input
                              type="email"
                              className="w-full px-3 py-2 border rounded-md"
                              value={formData.email}
                              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                              placeholder="Nhập email (không bắt buộc)"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Số điện thoại</label>
                            <input
                              type="tel"
                              className="w-full px-3 py-2 border rounded-md"
                              value={formData.phone}
                              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="Nhập số điện thoại (không bắt buộc)"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Mật khẩu</label>
                            <div className="relative">
                              <input
                                type={showFormPassword ? "text" : "password"}
                                className="w-full px-3 py-2 border rounded-md pr-10"
                                value={formData.password}
                                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                placeholder="Nhập mật khẩu"
                              />
                              <button
                                type="button"
                                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                                onClick={() => setShowFormPassword(!showFormPassword)}
                              >
                                {showFormPassword ? (
                                  <EyeOff className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <Eye className="w-4 h-4 text-gray-500" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setEditingUser(null);
                              setIsAddingUser(false);
                              setFormData({ username: "", fullName: "", email: "", phone: "", password: "" });
                              setShowFormPassword(false);
                            }}
                          >
                            Hủy
                          </Button>
                          <Button onClick={handleSaveUser}>
                            {editingUser ? "Cập nhật" : "Thêm"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {usersLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tên đăng nhập</TableHead>
                            <TableHead>Họ tên</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Số điện thoại</TableHead>
                            <TableHead>Vai trò</TableHead>
                            <TableHead>Mật khẩu</TableHead>
                            <TableHead>Ngày tạo</TableHead>
                            <TableHead>Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((userItem) => (
                            <TableRow key={userItem.id}>
                              <TableCell className="font-medium flex items-center gap-2">
                                <User className="w-4 h-4" />
                                {userItem.username}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">
                                  {userItem.fullName || "Chưa có"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">
                                  {userItem.email || "Chưa có"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">
                                  {userItem.phone || "Chưa có"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={userItem.role === "manager" ? "default" : "secondary"}>
                                  {userItem.role}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm">
                                    {showPasswords[userItem.id] ? userItem.password : "••••••"}
                                  </span>
                                  <button
                                    onClick={() => setShowPasswords(prev => ({
                                      ...prev,
                                      [userItem.id]: !prev[userItem.id]
                                    }))}
                                    className="p-1 hover:bg-gray-100 rounded"
                                  >
                                    {showPasswords[userItem.id] ? (
                                      <EyeOff className="w-4 h-4 text-gray-500" />
                                    ) : (
                                      <Eye className="w-4 h-4 text-gray-500" />
                                    )}
                                  </button>
                                </div>
                              </TableCell>
                              <TableCell>
                                {new Date(userItem.createdAt).toLocaleDateString("vi-VN")}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditUser(userItem)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  {user?.role === "manager" && (userItem.role === "admin" || userItem.role === "user") && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteUser(userItem)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Messages Content - For all authenticated users */}
            {activeTab === "messages" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Tin nhắn liên hệ
                    </CardTitle>
                    <CardDescription>
                      Danh sách tin nhắn từ khách hàng
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {messagesLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tên</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Số điện thoại</TableHead>
                              <TableHead>Dịch vụ</TableHead>
                              <TableHead>Tin nhắn</TableHead>
                              <TableHead>Ngày gửi</TableHead>
                              <TableHead>Thao tác</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentMessages.map((message) => (
                              <TableRow key={message.id}>
                                <TableCell className="font-medium">
                                  {message.name}
                                </TableCell>
                                <TableCell>{message.email}</TableCell>
                                <TableCell>{message.phone}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-sm">
                                    {getServiceName(message.service || "")}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-xs">
                                  <div className="truncate" title={message.message}>
                                    {message.message}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {new Date(message.createdAt).toLocaleDateString("vi-VN")}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewMessage(message)}
                                      className="text-blue-600 hover:text-blue-700"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteMessage(message)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        
                        {/* Pagination */}
                        <div className="mt-6">
                          <div className="mb-4 text-center text-sm text-muted-foreground">
                            Hiển thị {startIndex + 1}-{Math.min(endIndex, sortedMessages.length)} trong tổng số {sortedMessages.length} tin nhắn
                          </div>
                          <Pagination
                            currentPage={currentPage}
                            totalPages={Math.max(totalPages, 1)}
                            onPageChange={handlePageChange}
                            className="justify-center"
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Registration Requests Content - For managers and admins */}
            {canManageRegistrations && activeTab === "registrations" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Duyệt đăng ký tài khoản
                    </CardTitle>
                    <CardDescription>
                      Xem và duyệt các yêu cầu đăng ký tài khoản mới
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {registrationsLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : registrationRequests.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Không có yêu cầu đăng ký nào
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tên đăng nhập</TableHead>
                            <TableHead>Họ tên</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Số điện thoại</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Ngày đăng ký</TableHead>
                            <TableHead>Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {registrationRequests
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .map((request) => (
                            <TableRow key={request.id}>
                              <TableCell className="font-medium">
                                {request.username}
                              </TableCell>
                              <TableCell>{request.fullName || "-"}</TableCell>
                              <TableCell>{request.email}</TableCell>
                              <TableCell>{request.phone}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={
                                    request.status === "pending" ? "default" :
                                    request.status === "approved" ? "secondary" : 
                                    "destructive"
                                  }
                                >
                                  {request.status === "pending" ? "Chờ duyệt" :
                                   request.status === "approved" ? "Đã duyệt" :
                                   "Đã từ chối"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(request.createdAt).toLocaleDateString("vi-VN")}
                              </TableCell>
                              <TableCell>
                                {request.status === "pending" && (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleApproveRegistration(request.id)}
                                      className="text-green-600 hover:text-green-700"
                                    >
                                      <Check className="w-4 h-4" />
                                      Duyệt
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDeleteRegistration(request)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <X className="w-4 h-4" />
                                      Xóa
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Approved Accounts Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Tài khoản đã duyệt
                    </CardTitle>
                    <CardDescription>
                      Danh sách các tài khoản đã được duyệt từ yêu cầu đăng ký
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {usersLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tên đăng nhập</TableHead>
                            <TableHead>Họ tên</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Số điện thoại</TableHead>
                            <TableHead>Vai trò</TableHead>
                            <TableHead>Ngày tạo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.filter(userItem => userItem.role === "user").map((userItem) => (
                            <TableRow key={userItem.id}>
                              <TableCell className="font-medium flex items-center gap-2">
                                <User className="w-4 h-4" />
                                {userItem.username}
                              </TableCell>
                              <TableCell>
                                {userItem.fullName || "-"}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">
                                  {userItem.email || "Chưa có"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">
                                  {userItem.phone || "Chưa có"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {userItem.role}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(userItem.createdAt).toLocaleDateString("vi-VN")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    {users.filter(userItem => userItem.role === "user").length === 0 && !usersLoading && (
                      <div className="text-center py-8 text-muted-foreground">
                        Chưa có tài khoản nào được duyệt
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Exams Content - Available for all users */}
            {activeTab === "exams" && (
              <ExamManager />
            )}

            {/* Question Bank Content */}
            {activeTab === "questions" && (
              <QuestionBankManager />
            )}

            {/* Contact Info Content - Admin/Manager only */}
            {activeTab === "contact-info" && (
              <ContactInfoManager />
            )}
          </div>
        </div>

        {/* Delete User Confirmation Dialog */}
        <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && cancelDeleteUser()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Xác nhận xóa người dùng</DialogTitle>
              <DialogDescription>
                Bạn có chắc chắn muốn xóa người dùng "{deleteConfirm.user?.username}" không?
                <br />
                <span className="text-red-600 font-medium">Hành động này không thể hoàn tác.</span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cancelDeleteUser}>
                Hủy
              </Button>
              <Button variant="destructive" onClick={confirmDeleteUser}>
                Xóa người dùng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Message Detail Dialog */}
        <Dialog open={messageDetail.isOpen} onOpenChange={(open) => !open && setMessageDetail({ isOpen: false, message: null })}>
          <DialogContent className="max-w-[1000px]">
            <DialogHeader>
              <DialogTitle>Chi tiết tin nhắn</DialogTitle>
            </DialogHeader>
            {messageDetail.message && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Họ tên</label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{messageDetail.message.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{messageDetail.message.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Số điện thoại</label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{messageDetail.message.phone}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Dịch vụ quan tâm</label>
                    <Badge variant="outline" className="text-sm">
                      {getServiceName(messageDetail.message.service)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nội dung tin nhắn</label>
                  <div className="text-sm bg-gray-50 p-3 rounded min-h-[100px] whitespace-pre-wrap">
                    {messageDetail.message.message}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ngày gửi</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">
                    {new Date(messageDetail.message.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setMessageDetail({ isOpen: false, message: null })}>
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Message Confirmation Dialog */}
        <Dialog open={deleteMessageConfirm.isOpen} onOpenChange={(open) => !open && cancelDeleteMessage()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Xác nhận xóa tin nhắn</DialogTitle>
              <DialogDescription>
                Bạn có chắc chắn muốn xóa tin nhắn từ "{deleteMessageConfirm.message?.name}" không?
                <br />
                <span className="text-red-600 font-medium">Hành động này không thể hoàn tác.</span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cancelDeleteMessage}>
                Hủy
              </Button>
              <Button variant="destructive" onClick={confirmDeleteMessage}>
                Xóa tin nhắn
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Registration Confirmation Dialog */}
        <Dialog open={deleteRegistrationConfirm.isOpen} onOpenChange={(open) => !open && cancelDeleteRegistration()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Xác nhận xóa yêu cầu đăng ký</DialogTitle>
              <DialogDescription>
                Bạn có chắc chắn muốn xóa yêu cầu đăng ký của "{deleteRegistrationConfirm.registration?.username}" không?
                <br />
                <span className="text-red-600 font-medium">Hành động này không thể hoàn tác.</span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cancelDeleteRegistration}>
                Hủy
              </Button>
              <Button variant="destructive" onClick={confirmDeleteRegistration}>
                Xóa yêu cầu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default CpanelPage;