import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Users, MessageSquare, Shield, User } from "lucide-react";
import { type User as UserType, type ContactRequest } from "@shared/schema";

export function CpanelPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<UserType | null>(null);
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
    } catch (error) {
      localStorage.removeItem("user");
      setLocation("/login");
    }
  }, [setLocation, toast]);

  // Fetch users (only for managers)
  const { data: users = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "manager",
  });

  // Fetch messages/contact requests
  const { data: messages = [], isLoading: messagesLoading } = useQuery<ContactRequest[]>({
    queryKey: ["/api/contact"],
    enabled: !!user,
  });

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
          <p className="text-gray-600 mt-2">
            Chào mừng {user.username} ({user.role})
          </p>
        </div>

        <Tabs defaultValue={isManager ? "users" : "messages"} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            {isManager && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Quản lý người dùng
              </TabsTrigger>
            )}
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Tin nhắn liên hệ
            </TabsTrigger>
          </TabsList>

          {/* Users Tab - Only for managers */}
          {isManager && (
            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Danh sách người dùng
                  </CardTitle>
                  <CardDescription>
                    Quản lý tất cả người dùng trong hệ thống
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
                          <TableHead>Vai trò</TableHead>
                          <TableHead>Ngày tạo</TableHead>
                          <TableHead>Trạng thái</TableHead>
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
                              <Badge variant={userItem.role === "admin" ? "default" : "secondary"}>
                                {userItem.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(userItem.createdAt).toLocaleDateString("vi-VN")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">Hoạt động</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Messages Tab - For all authenticated users */}
          <TabsContent value="messages" className="space-y-6">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}