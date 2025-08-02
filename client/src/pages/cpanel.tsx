import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Users, MessageSquare, Shield, User, Plus, Edit, Trash2 } from "lucide-react";
import { type User as UserType, type ContactRequest } from "@shared/schema";

export function CpanelPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "", role: "admin" as "admin" | "manager" });
  const { toast } = useToast();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      toast({
        title: "Không có quyền truy cập",
        description: "Vui lòng đăng nhập để truy cập trang này.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }
    
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      // Set default active tab based on user role
      setActiveTab(parsedUser.role === "manager" ? "users" : "messages");
    } catch (error) {
      localStorage.removeItem("user");
      setLocation("/login");
    }
  }, [setLocation, toast]);

  // Fetch users (only for managers)
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "manager",
  });

  // Fetch messages/contact requests
  const { data: messages = [], isLoading: messagesLoading } = useQuery<ContactRequest[]>({
    queryKey: ["/api/contact"],
    enabled: !!user,
  });

  const handleEditUser = (userToEdit: UserType) => {
    setEditingUser(userToEdit);
    setFormData({
      username: userToEdit.username,
      password: "", // Don't show existing password
      role: userToEdit.role as "admin" | "manager"
    });
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa người dùng này?")) return;
    
    try {
      const response = await fetch(`/api/users/${userId}`, {
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
    }
  };

  const handleSaveUser = async () => {
    if (!formData.username || !formData.password) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin",
        variant: "destructive",
      });
      return;
    }

    try {
      const method = editingUser ? "PUT" : "POST";
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        toast({
          title: "Thành công",
          description: editingUser ? "Đã cập nhật người dùng" : "Đã thêm người dùng mới",
        });
        setEditingUser(null);
        setIsAddingUser(false);
        setFormData({ username: "", password: "", role: "admin" });
        refetchUsers();
      } else {
        throw new Error("Failed to save user");
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể lưu thông tin người dùng",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setIsAddingUser(false);
    setFormData({ username: "", password: "", role: "admin" });
  };

  if (!user) {
    return null; // Will redirect to login
  }

  const isManager = user.role === "manager";

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
              {isManager && (
                <Button 
                  variant={activeTab === "users" ? "default" : "ghost"}
                  className="justify-start flex items-center gap-2 h-12 px-4"
                  onClick={() => setActiveTab("users")}
                >
                  <Users className="w-5 h-5" />
                  Quản lý người dùng
                </Button>
              )}
              <Button 
                variant={activeTab === "messages" ? "default" : "ghost"}
                className="justify-start flex items-center gap-2 h-12 px-4"
                onClick={() => setActiveTab("messages")}
              >
                <MessageSquare className="w-5 h-5" />
                Tin nhắn liên hệ
              </Button>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1">

            {/* Users Content - Only for managers */}
            {isManager && activeTab === "users" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="w-5 h-5" />
                          Danh sách người dùng
                        </CardTitle>
                        <CardDescription>
                          Quản lý tất cả người dùng trong hệ thống
                        </CardDescription>
                      </div>
                      <Button 
                        onClick={() => setIsAddingUser(true)}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm người dùng
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(isAddingUser || editingUser) && (
                      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                        <h3 className="font-medium mb-4">
                          {editingUser ? "Chỉnh sửa người dùng" : "Thêm người dùng mới"}
                        </h3>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Tên đăng nhập</label>
                            <input
                              type="text"
                              value={formData.username}
                              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                              className="w-full px-3 py-2 border rounded-md"
                              placeholder="Nhập tên đăng nhập"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Mật khẩu</label>
                            <input
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className="w-full px-3 py-2 border rounded-md"
                              placeholder="Nhập mật khẩu"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Vai trò</label>
                            <select
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "manager" })}
                              className="w-full px-3 py-2 border rounded-md"
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Manager</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveUser}>
                            {editingUser ? "Cập nhật" : "Thêm"}
                          </Button>
                          <Button variant="outline" onClick={handleCancelEdit}>
                            Hủy
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
                            <TableHead>Mật khẩu</TableHead>
                            <TableHead>Vai trò</TableHead>
                            <TableHead>Ngày tạo</TableHead>
                            <TableHead>Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((userItem) => (
                            <TableRow key={userItem.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  {userItem.username}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-gray-400">••••••••</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={userItem.role === "admin" ? "default" : "secondary"}>
                                  {userItem.role}
                                </Badge>
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
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteUser(userItem.id)}
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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tên</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Số điện thoại</TableHead>
                            <TableHead>Dịch vụ</TableHead>
                            <TableHead>Tin nhắn</TableHead>
                            <TableHead>Ngày gửi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {messages.map((message) => (
                            <TableRow key={message.id}>
                              <TableCell className="font-medium">
                                {message.name}
                              </TableCell>
                              <TableCell>{message.email}</TableCell>
                              <TableCell>{message.phone}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {message.service}
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
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}