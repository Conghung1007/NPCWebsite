import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Clock, Target, CheckCircle, XCircle, RotateCcw, Home, Share2, BookOpen, MessageSquare, Headphones, FileInput } from "lucide-react";
import { type ExamAttempt, type Exam, type Question } from "@shared/schema";

interface ExamResultPageProps {
  attemptId: string;
}

export function ExamResultPage({ attemptId }: ExamResultPageProps) {
  const [, setLocation] = useLocation();

  // Fetch exam attempt details
  const { data: attempt, isLoading: attemptLoading } = useQuery<ExamAttempt>({
    queryKey: [`/api/exam-attempts/${attemptId}`],
    retry: false,
  });

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: [`/api/exams/${attempt?.examId}`],
    enabled: !!attempt,
    retry: false,
  });

  // Fetch questions with answers
  const { data: questionsWithAnswers = [], isLoading: questionsLoading } = useQuery<any[]>({
    queryKey: [`/api/exam-attempts/${attemptId}/details`],
    retry: false,
  });

  if (attemptLoading || examLoading || questionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Đang tải kết quả thi...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Không tìm thấy kết quả</h2>
            <p className="text-gray-600 mb-6">
              Kết quả thi này không tồn tại hoặc đã bị xóa.
            </p>
            <Button onClick={() => setLocation("/online-exam")}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate 4-section results
  const sections = [
    { 
      key: 'vocabulary', 
      title: 'Từ vựng', 
      icon: BookOpen, 
      color: 'text-green-600',
      score: attempt.vocabularyScore,
      timeSpent: attempt.vocabularyTimeSpent,
      timeLimit: exam.vocabularyTimeLimit
    },
    { 
      key: 'grammar', 
      title: 'Ngữ pháp', 
      icon: MessageSquare, 
      color: 'text-blue-600',
      score: attempt.grammarScore,
      timeSpent: attempt.grammarTimeSpent,
      timeLimit: exam.grammarTimeLimit
    },
    { 
      key: 'listening', 
      title: 'Nghe hiểu', 
      icon: Headphones, 
      color: 'text-yellow-600',
      score: attempt.listeningScore,
      timeSpent: attempt.listeningTimeSpent,
      timeLimit: exam.listeningTimeLimit
    },
    { 
      key: 'reading', 
      title: 'Đọc hiểu', 
      icon: FileInput, 
      color: 'text-purple-600',
      score: attempt.readingScore,
      timeSpent: attempt.readingTimeSpent,
      timeLimit: exam.readingTimeLimit
    }
  ];

  // Calculate total stats
  const totalTimeLimit = exam.vocabularyTimeLimit + exam.grammarTimeLimit + exam.listeningTimeLimit + exam.readingTimeLimit;
  const totalQuestions = questionsWithAnswers.length;
  const correctAnswers = questionsWithAnswers.filter(item => 
    item.userAnswer === item.question.correctAnswer
  ).length;
  const scorePercentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

  const totalTimeMinutes = Math.floor(attempt.totalTimeSpent / 60);
  const totalTimeSeconds = attempt.totalTimeSpent % 60;

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreBadge = (percentage: number) => {
    if (percentage >= 90) return { text: "Xuất sắc", variant: "default" as const, color: "bg-green-600" };
    if (percentage >= 80) return { text: "Tốt", variant: "secondary" as const, color: "bg-blue-600" };
    if (percentage >= 60) return { text: "Khá", variant: "outline" as const, color: "bg-yellow-600" };
    return { text: "Cần cải thiện", variant: "destructive" as const, color: "bg-red-600" };
  };

  const scoreBadge = getScoreBadge(attempt.totalScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 rounded-full ${scoreBadge.color} flex items-center justify-center`}>
              <Trophy className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Kết quả bài thi</h1>
          <h2 className="text-xl text-gray-600">{exam.title}</h2>
          <Badge variant={scoreBadge.variant} className="mt-3">
            {scoreBadge.text}
          </Badge>
        </div>

        {/* Score Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className={`text-3xl font-bold ${getScoreColor(attempt.totalScore)}`}>
                {attempt.totalScore}%
              </div>
              <p className="text-sm text-gray-600 mt-1">Điểm tổng</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600 mr-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {totalTimeMinutes}:{totalTimeSeconds.toString().padStart(2, '0')}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">Thời gian làm bài</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <Target className="w-6 h-6 text-green-600 mr-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {totalTimeLimit}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">Giới hạn (phút)</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-900">
                {new Date(attempt.completedAt).toLocaleDateString("vi-VN")}
              </div>
              <p className="text-sm text-gray-600 mt-1">Ngày thi</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Visualization */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Chi tiết kết quả
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Tỷ lệ trả lời đúng</span>
                  <span className={getScoreColor(scorePercentage)}>
                    {correctAnswers}/{totalQuestions} ({scorePercentage.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={scorePercentage} className="h-3" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-sm">
                    <strong>{correctAnswers}</strong> câu trả lời đúng
                  </span>
                </div>
                <div className="flex items-center">
                  <XCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-sm">
                    <strong>{totalQuestions - correctAnswers}</strong> câu trả lời sai
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Answers */}
        {questionsWithAnswers.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Chi tiết từng câu hỏi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {questionsWithAnswers.map((item, index) => {
                  const isCorrect = item.userAnswer === item.question.correctAnswer;
                  return (
                    <div key={item.question.id} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900">
                          Câu {index + 1}: {item.question.questionText}
                        </h4>
                        <div className="flex items-center ml-4">
                          {isCorrect ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                      </div>
                      
                      {item.question.imageUrl && (
                        <div className="mb-4">
                          <img
                            src={item.question.imageUrl}
                            alt="Question illustration"
                            className="max-w-sm h-auto rounded-lg"
                          />
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        {(item.question.options as string[]).map((option, optionIndex) => {
                          const isUserAnswer = item.userAnswer === optionIndex.toString();
                          const isCorrectAnswer = item.question.correctAnswer === optionIndex.toString();
                          
                          return (
                            <div
                              key={optionIndex}
                              className={`p-2 rounded ${
                                isCorrectAnswer
                                  ? 'bg-green-100 border border-green-300'
                                  : isUserAnswer
                                    ? 'bg-red-100 border border-red-300'
                                    : 'bg-gray-50'
                              }`}
                            >
                              <span className="font-medium">
                                {String.fromCharCode(65 + optionIndex)}.
                              </span>{' '}
                              {option}
                              {isCorrectAnswer && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Đáp án đúng
                                </Badge>
                              )}
                              {isUserAnswer && !isCorrectAnswer && (
                                <Badge variant="destructive" className="ml-2 text-xs">
                                  Bạn đã chọn
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {item.question.explanation && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Giải thích:</strong> {item.question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/online-exam">
            <Button variant="outline" className="w-full sm:w-auto">
              <Home className="w-4 h-4 mr-2" />
              Về trang chủ
            </Button>
          </Link>
          
          <Link href={`/exam/${exam.id}`}>
            <Button className="w-full sm:w-auto">
              <RotateCcw className="w-4 h-4 mr-2" />
              Thi lại
            </Button>
          </Link>
          
          <Button
            variant="outline"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `Kết quả thi: ${exam.title}`,
                  text: `Tôi vừa hoàn thành bài thi "${exam.title}" với kết quả ${scorePercentage.toFixed(1)}% (${correctAnswers}/${totalQuestions} câu đúng)`,
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                // You could add a toast notification here
              }
            }}
            className="w-full sm:w-auto"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Chia sẻ kết quả
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ExamResultPage;