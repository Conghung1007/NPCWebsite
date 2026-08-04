import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { QuestionBankManager } from "@/components/QuestionBankManager";

export default function ManageQuestions() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
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
    
    // Check if user has permission to manage questions
    if (user.role === 'user') {
      toast({
        title: "Không có quyền truy cập",
        description: "Chỉ Manager và Admin mới có thể quản lý câu hỏi.",
        variant: "destructive",
      });
      setLocation("/");
      return;
    }
  }, [isLoading, isAuthenticated, user, setLocation, toast]);

  if (!user || user.role === 'user') {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Quản lý Bộ câu hỏi
          </h1>
          <p className="text-gray-600 mt-2">
            Tạo và quản lý câu hỏi cho các bài thi
          </p>
        </div>
        
        <QuestionBankManager />
      </div>
    </div>
  );
}