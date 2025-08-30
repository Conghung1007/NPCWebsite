import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { useQuery } from "@tanstack/react-query";
import { Clock, Users, BookOpen, Award, Play, Lock } from "lucide-react";
import { type Exam, type User } from "@shared/schema";

export function OnlineExamPage() {
  const [user, setUser] = useState<User | null>(null);
  const [demoCurrentPage, setDemoCurrentPage] = useState(1);
  const [officialCurrentPage, setOfficialCurrentPage] = useState(1);
  const examsPerPage = 6;

  // Check for logged in user
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error("Error parsing user data:", error);
        localStorage.removeItem("user");
        setUser(null);
      }
    }
  }, []);

  // Fetch available exams
  const { data: exams = [], isLoading } = useQuery<Exam[]>({
    queryKey: ["/api/exams"],
    retry: false,
  });

  // Separate demo and official exams
  const allDemoExams = exams.filter(exam => exam.isDemo && exam.isActive);
  const allOfficialExams = exams.filter(exam => !exam.isDemo && exam.isActive);

  // Calculate pagination for demo exams
  const demoTotalPages = Math.ceil(allDemoExams.length / examsPerPage);
  const demoStartIndex = (demoCurrentPage - 1) * examsPerPage;
  const demoEndIndex = demoStartIndex + examsPerPage;
  const demoExams = allDemoExams.slice(demoStartIndex, demoEndIndex);

  // Calculate pagination for official exams
  const officialTotalPages = Math.ceil(allOfficialExams.length / examsPerPage);
  const officialStartIndex = (officialCurrentPage - 1) * examsPerPage;
  const officialEndIndex = officialStartIndex + examsPerPage;
  const officialExams = allOfficialExams.slice(officialStartIndex, officialEndIndex);

  // Pagination handlers
  const handleDemoPageChange = (page: number) => {
    setDemoCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOfficialPageChange = (page: number) => {
    setOfficialCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg text-muted-foreground">Đang tải danh sách đề thi...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Hệ thống thi thử trực tuyến
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Kiểm tra và nâng cao trình độ của bạn với các đề thi thử chuyên nghiệp. 
            Thực hành ngay với đề demo hoặc tham gia các kỳ thi chính thức.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="text-center">
            <CardContent className="pt-6">
              <BookOpen className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{exams.length}</div>
              <p className="text-sm text-gray-600">Đề thi có sẵn</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Play className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{allDemoExams.length}</div>
              <p className="text-sm text-gray-600">Đề demo miễn phí</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Award className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{allOfficialExams.length}</div>
              <p className="text-sm text-gray-600">Đề chính thức</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">1,000+</div>
              <p className="text-sm text-gray-600">Lượt thi</p>
            </CardContent>
          </Card>
        </div>

        {/* Demo Exams Section */}
        <div className="mb-12">
          <div className="flex items-center mb-6">
            <Play className="w-6 h-6 text-green-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Đề thi demo</h2>
            <Badge variant="secondary" className="ml-3">Miễn phí</Badge>
          </div>
          <p className="text-gray-600 mb-6">
            Thực hành ngay mà không cần đăng nhập. Phù hợp để làm quen với hệ thống và định dạng bài thi.
          </p>
          
          {allDemoExams.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Chưa có đề thi demo nào</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {demoExams.map((exam) => (
                <Card key={exam.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{exam.title}</CardTitle>
                    <CardDescription>{exam.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-2" />
                        <span>{exam.timeLimit} phút</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <BookOpen className="w-4 h-4 mr-2" />
                        <span>{exam.questionCount} câu hỏi</span>
                      </div>
                      <div className="flex items-center">
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Demo
                        </Badge>
                      </div>
                      <Link href={`/exam/${exam.id}`}>
                        <Button className="w-full mt-4">
                          <Play className="w-4 h-4 mr-2" />
                          Bắt đầu thi
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Demo Pagination */}
          {allDemoExams.length > 0 && (
            <div className="mt-8">
              <div className="mb-4 text-center text-sm text-muted-foreground">
                Hiển thị {demoStartIndex + 1}-{Math.min(demoEndIndex, allDemoExams.length)} trong tổng số {allDemoExams.length} đề demo
              </div>
              <Pagination
                currentPage={demoCurrentPage}
                totalPages={Math.max(demoTotalPages, 1)}
                onPageChange={handleDemoPageChange}
                className="justify-center"
              />
            </div>
          )}
        </div>

        {/* Official Exams Section */}
        <div>
          <div className="flex items-center mb-6">
            <Award className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Đề thi chính thức</h2>
            <Badge variant="secondary" className="ml-3">Cần đăng nhập</Badge>
          </div>
          <p className="text-gray-600 mb-6">
            Các đề thi chính thức với kết quả được lưu trữ và theo dõi. Cần đăng nhập để tham gia.
          </p>

          {!user && (
            <Card className="mb-6 border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Lock className="w-5 h-5 text-blue-600 mr-3" />
                    <div>
                      <p className="font-medium text-blue-900">Cần đăng nhập để thi đề chính thức</p>
                      <p className="text-sm text-blue-700">Đăng nhập để lưu kết quả và theo dõi tiến độ học tập</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link href="/register">
                      <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white">
                        Đăng ký
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        Đăng nhập
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {allOfficialExams.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Chưa có đề thi chính thức nào</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {officialExams.map((exam) => (
                <Card key={exam.id} className={`hover:shadow-lg transition-shadow ${!user ? 'opacity-75' : ''}`}>
                  <CardHeader>
                    <CardTitle className="text-lg">{exam.title}</CardTitle>
                    <CardDescription>{exam.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-2" />
                        <span>{exam.timeLimit} phút</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <BookOpen className="w-4 h-4 mr-2" />
                        <span>{exam.questionCount} câu hỏi</span>
                      </div>
                      <div className="flex items-center">
                        <Badge variant="outline" className="text-blue-600 border-blue-600">
                          Chính thức
                        </Badge>
                      </div>
                      {user ? (
                        <Link href={`/exam/${exam.id}`}>
                          <Button className="w-full mt-4">
                            <Play className="w-4 h-4 mr-2" />
                            Bắt đầu thi
                          </Button>
                        </Link>
                      ) : (
                        <Button disabled className="w-full mt-4">
                          <Lock className="w-4 h-4 mr-2" />
                          Cần đăng nhập
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Official Pagination */}
          {allOfficialExams.length > 0 && (
            <div className="mt-8">
              <div className="mb-4 text-center text-sm text-muted-foreground">
                Hiển thị {officialStartIndex + 1}-{Math.min(officialEndIndex, allOfficialExams.length)} trong tổng số {allOfficialExams.length} đề chính thức
              </div>
              <Pagination
                currentPage={officialCurrentPage}
                totalPages={Math.max(officialTotalPages, 1)}
                onPageChange={handleOfficialPageChange}
                className="justify-center"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OnlineExamPage;