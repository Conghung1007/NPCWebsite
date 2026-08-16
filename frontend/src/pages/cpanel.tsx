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
import { AdminPortalFilter } from "@/components/AdminPortalFilter";
import { AdminPortalProvider } from "@/contexts/AdminPortalContext";

import { Pagination } from "@/components/ui/pagination";
import { Users, MessageSquare, Shield, User, Plus, Edit, Eye, EyeOff, Trash2, FileText, Image, Check, X, MapPin, HelpCircle, Trophy, GraduationCap, Receipt, BarChart3 } from "lucide-react";
import { PORTAL_IDS, PORTAL_META, type PortalId } from "@/lib/portal";
import { portalBadgeLabel } from "@/components/AdminPortalFilter";
import { ExamResultsManager } from "@/components/ExamResultsManager";
import { ClassManager } from "@/components/ClassManager";
import { OrdersManager } from "@/components/OrdersManager";
import { OrderStatsManager } from "@/components/OrderStatsManager";

interface CpanelPageProps {
  tab?: string;
}

export function CpanelPage({ tab }: CpanelPageProps) {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "user" as "user" | "manager" | "admin",
    portals: [] as PortalId[],
  });
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
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const usersPerPage = 10;
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
    const validTabs = ['registrations', 'exams', 'results', 'classes', 'orders', 'stats', 'questions', 'articles', 'contact-info', 'messages', 'users'];
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
    setEditingUserId(userToEdit.id);
    setFormData({
      username: userToEdit.username,
      fullName: userToEdit.fullName || "",
      email: userToEdit.email || "",
      phone: userToEdit.phone || "",
      password: "",
      role: userToEdit.role as "user" | "manager" | "admin",
      portals: (userToEdit.portals || []).filter((p): p is PortalId =>
        (PORTAL_IDS as readonly string[]).includes(p),
      ),
    });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setIsAddingUser(false);
    setFormData({
      username: "",
      fullName: "",
      email: "",
      phone: "",
      password: "",
      role: "user",
      portals: [],
    });
    setShowFormPassword(false);
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
    
    if (!editingUserId && !formData.password) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mật khẩu cho người dùng mới",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PUT" : "POST";
      
      const payload: any = {
        username: formData.username,
        fullName: formData.fullName || null,
        email: formData.email || null,
        phone: formData.phone || null,
        role: formData.role,
        portals: formData.role === "user" ? null : formData.portals,
      };
      
      if (formData.password) {
        payload.password = formData.password;
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: "Thành công",
          description: editingUserId ? "Đã cập nhật người dùng" : "Đã thêm người dùng mới",
        });
        refetchUsers();
        handleCancelEdit();
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
    <AdminPortalProvider>
    <div className="min-h-screen bg-gray-50/50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Control Panel
          </h1>
          <p className="text-gray-600 mt-2 mb-4">
            Chào mừng {user.username} ({user.role})
          </p>
          <AdminPortalFilter className="rounded-lg border bg-white px-4 py-3 shadow-sm" />
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
                variant={activeTab === "results" ? "default" : "ghost"}
                className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                onClick={() => setLocation("/cpanel/results")}
              >
                <Trophy className="w-5 h-5" />
                Kết quả thi
              </Button>
              <Button 
                variant={activeTab === "classes" ? "default" : "ghost"}
                className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                onClick={() => setLocation("/cpanel/classes")}
              >
                <GraduationCap className="w-5 h-5" />
                Lớp học
              </Button>
              <Button 
                variant={activeTab === "orders" ? "default" : "ghost"}
                className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                onClick={() => setLocation("/cpanel/orders")}
              >
                <Receipt className="w-5 h-5" />
                Đơn hàng
              </Button>
              <Button 
                variant={activeTab === "stats" ? "default" : "ghost"}
                className="justify-start flex items-center gap-2 h-12 px-4 pl-[30px] pr-[30px]"
                onClick={() => setLocation("/cpanel/stats")}
              >
                <BarChart3 className="w-5 h-5" />
                Thống kê
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
            {canManageUsers && activeTab === "users" && (() => {
              const filteredUsers = users
                .filter(u => 
                  u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                  (u.fullName && u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
                  (u.email && u.email.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
                  (u.phone && u.phone.includes(userSearchQuery))
                )
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              
              const totalUserPages = Math.ceil(filteredUsers.length / usersPerPage);
              const startUserIndex = (userCurrentPage - 1) * usersPerPage;
              const paginatedUsers = filteredUsers.slice(startUserIndex, startUserIndex + usersPerPage);
              
              return (
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
                          Quản lý tất cả người dùng trong hệ thống ({filteredUsers.length} người dùng)
                        </CardDescription>
                      </div>
                      {!isAddingUser && !editingUserId && (
                        <Button 
                          onClick={() => {
                            setIsAddingUser(true);
                            setFormData({
                              username: "",
                              fullName: "",
                              email: "",
                              phone: "",
                              password: "",
                              role: "user",
                              portals: [],
                            });
                          }}
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Thêm người dùng
                        </Button>
                      )}
                    </div>
                    <div className="mt-4">
                      <input
                        type="text"
                        placeholder="Tìm kiếm theo tên đăng nhập, họ tên, email hoặc số điện thoại..."
                        className="w-full px-4 py-2 border rounded-md"
                        value={userSearchQuery}
                        onChange={(e) => {
                          setUserSearchQuery(e.target.value);
                          setUserCurrentPage(1);
                        }}
                      />
                    </div>
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
                            <TableHead>Portal</TableHead>
                            <TableHead>Mật khẩu</TableHead>
                            <TableHead>Ngày tạo</TableHead>
                            <TableHead>Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isAddingUser && (
                            <TableRow className="bg-green-50">
                              <TableCell>
                                <input
                                  type="text"
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  value={formData.username}
                                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                  placeholder="Tên đăng nhập"
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="text"
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  value={formData.fullName}
                                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                  placeholder="Họ tên"
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="email"
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  value={formData.email}
                                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                  placeholder="Email"
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="tel"
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  value={formData.phone}
                                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                  placeholder="Số điện thoại"
                                />
                              </TableCell>
                              <TableCell>
                                <select
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  value={formData.role}
                                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as "user" | "manager" | "admin" }))}
                                >
                                  <option value="user">user</option>
                                  <option value="manager">manager</option>
                                  <option value="admin">admin</option>
                                </select>
                              </TableCell>
                              <TableCell>
                                {formData.role === "user" ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  <div className="flex flex-col gap-1 min-w-[140px]">
                                    {PORTAL_IDS.map((id) => (
                                      <label key={id} className="flex items-center gap-1 text-xs">
                                        <input
                                          type="checkbox"
                                          checked={formData.portals.includes(id)}
                                          onChange={(e) => {
                                            setFormData((prev) => ({
                                              ...prev,
                                              portals: e.target.checked
                                                ? [...prev.portals, id]
                                                : prev.portals.filter((p) => p !== id),
                                            }));
                                          }}
                                        />
                                        {PORTAL_META[id].brand}
                                      </label>
                                    ))}
                                    <span className="text-[10px] text-muted-foreground">
                                      Trống = tất cả
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="relative">
                                  <input
                                    type={showFormPassword ? "text" : "password"}
                                    className="w-full px-2 py-1 border rounded text-sm pr-8"
                                    value={formData.password}
                                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="Mật khẩu"
                                  />
                                  <button
                                    type="button"
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                    onClick={() => setShowFormPassword(!showFormPassword)}
                                  >
                                    {showFormPassword ? <EyeOff className="w-3 h-3 text-gray-500" /> : <Eye className="w-3 h-3 text-gray-500" />}
                                  </button>
                                </div>
                              </TableCell>
                              <TableCell>-</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="default" onClick={handleSaveUser} className="h-7 px-2">
                                    <Check className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-7 px-2">
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {paginatedUsers.map((userItem) => (
                            <TableRow key={userItem.id} className={editingUserId === userItem.id ? "bg-blue-50" : ""}>
                              <TableCell className="font-medium">
                                {editingUserId === userItem.id ? (
                                  <input
                                    type="text"
                                    className="w-full px-2 py-1 border rounded text-sm"
                                    value={formData.username}
                                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    {userItem.username}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {editingUserId === userItem.id ? (
                                  <input
                                    type="text"
                                    className="w-full px-2 py-1 border rounded text-sm"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                  />
                                ) : (
                                  <span className="text-sm text-gray-600">{userItem.fullName || "Chưa có"}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {editingUserId === userItem.id ? (
                                  <input
                                    type="email"
                                    className="w-full px-2 py-1 border rounded text-sm"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                  />
                                ) : (
                                  <span className="text-sm text-gray-600">{userItem.email || "Chưa có"}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {editingUserId === userItem.id ? (
                                  <input
                                    type="tel"
                                    className="w-full px-2 py-1 border rounded text-sm"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                  />
                                ) : (
                                  <span className="text-sm text-gray-600">{userItem.phone || "Chưa có"}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {editingUserId === userItem.id ? (
                                  <select
                                    className="w-full px-2 py-1 border rounded text-sm"
                                    value={formData.role}
                                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as "user" | "manager" | "admin" }))}
                                  >
                                    <option value="user">user</option>
                                    <option value="manager">manager</option>
                                    <option value="admin">admin</option>
                                  </select>
                                ) : (
                                  <Badge variant={userItem.role === "manager" ? "default" : "secondary"}>
                                    {userItem.role}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {editingUserId === userItem.id ? (
                                  formData.role === "user" ? (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  ) : (
                                    <div className="flex flex-col gap-1 min-w-[140px]">
                                      {PORTAL_IDS.map((id) => (
                                        <label key={id} className="flex items-center gap-1 text-xs">
                                          <input
                                            type="checkbox"
                                            checked={formData.portals.includes(id)}
                                            onChange={(e) => {
                                              setFormData((prev) => ({
                                                ...prev,
                                                portals: e.target.checked
                                                  ? [...prev.portals, id]
                                                  : prev.portals.filter((p) => p !== id),
                                              }));
                                            }}
                                          />
                                          {PORTAL_META[id].brand}
                                        </label>
                                      ))}
                                      <span className="text-[10px] text-muted-foreground">
                                        Trống = tất cả
                                      </span>
                                    </div>
                                  )
                                ) : userItem.role === "user" ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : !userItem.portals?.length ? (
                                  <span className="text-xs text-muted-foreground">Tất cả</span>
                                ) : (
                                  <span className="text-xs">
                                    {userItem.portals
                                      .map((p) => portalBadgeLabel(p))
                                      .join(", ")}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {editingUserId === userItem.id ? (
                                  <div className="relative">
                                    <input
                                      type={showFormPassword ? "text" : "password"}
                                      className="w-full px-2 py-1 border rounded text-sm pr-8"
                                      value={formData.password}
                                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                      placeholder="Để trống nếu không đổi"
                                    />
                                    <button
                                      type="button"
                                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                      onClick={() => setShowFormPassword(!showFormPassword)}
                                    >
                                      {showFormPassword ? <EyeOff className="w-3 h-3 text-gray-500" /> : <Eye className="w-3 h-3 text-gray-500" />}
                                    </button>
                                  </div>
                                ) : (
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
                                )}
                              </TableCell>
                              <TableCell>
                                {new Date(userItem.createdAt).toLocaleDateString("vi-VN")}
                              </TableCell>
                              <TableCell>
                                {editingUserId === userItem.id ? (
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="default" onClick={handleSaveUser} className="h-7 px-2">
                                      <Check className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-7 px-2">
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditUser(userItem)}
                                      disabled={!!editingUserId || isAddingUser}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    {user?.role === "manager" && (userItem.role === "admin" || userItem.role === "user") && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteUser(userItem)}
                                        className="text-red-600 hover:text-red-700"
                                        disabled={!!editingUserId || isAddingUser}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    
                    {totalUserPages > 1 && (
                      <div className="mt-6">
                        <Pagination
                          currentPage={userCurrentPage}
                          totalPages={totalUserPages}
                          onPageChange={setUserCurrentPage}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
            })()}

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
                              <TableHead>Portal</TableHead>
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
                                  <Badge variant="outline">
                                    {portalBadgeLabel(message.portal)}
                                  </Badge>
                                </TableCell>
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

            {activeTab === "results" && (
              <ExamResultsManager />
            )}

            {activeTab === "classes" && (
              <ClassManager />
            )}

            {activeTab === "orders" && (
              <OrdersManager />
            )}

            {activeTab === "stats" && (
              <OrderStatsManager />
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
    </AdminPortalProvider>
  );
}

export default CpanelPage;